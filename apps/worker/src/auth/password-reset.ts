import { RATE_LIMITS } from '@wous/config';
import type { ForgotPasswordRequest, ResetPasswordRequest } from '@wous/contracts';
import { auditStatement } from '../accounts/audit.ts';
import { normalizeEmail } from '../accounts/normalize.ts';
import { checkPassword, PASSWORD_PROBLEM_MESSAGES } from '../accounts/password-policy.ts';
import { findAccountByEmail, findAccountById } from '../accounts/repo.ts';
import { dispatchOutbox, prepareOutbox } from '../notifications/outbox.ts';
import { enforceRateLimit, identityRateKey, ipRateKey } from '../security/rate-limit.ts';
import { AuthErrors } from './errors.ts';
import { revokeAllSessionsStatement } from './sessions.ts';
import { consumeOneTimeToken, peekOneTimeToken, prepareOneTimeToken } from './tokens.ts';
import type { UseCaseContext } from './use-case.ts';

/**
 * Solicitud de reset (§6): Turnstile obligatorio y respuesta SIEMPRE genérica.
 * Solo las cuentas activas reciben el enlace.
 */
export async function forgotPassword(
  ctx: UseCaseContext,
  input: ForgotPasswordRequest,
): Promise<void> {
  const { env, deps, log } = ctx;
  const emailNormalized = normalizeEmail(input.email);

  await enforceRateLimit(
    deps.rateLimiter,
    await ipRateKey(env, ctx.request, 'forgot'),
    RATE_LIMITS.forgotPasswordPerIp,
  );
  const human = await deps.turnstile.verify(input.turnstileToken, {
    action: 'forgot',
    remoteIp: ctx.remoteIp,
  });
  if (!human) throw AuthErrors.turnstileFailed();
  await enforceRateLimit(
    deps.rateLimiter,
    await identityRateKey(env, 'forgot', emailNormalized),
    RATE_LIMITS.forgotPasswordPerEmail,
  );

  const account = await findAccountByEmail(env.DB, emailNormalized);
  if (account?.status !== 'ACTIVE') return;

  const reset = await prepareOneTimeToken(env, deps, 'reset', account.id);
  const outbox = await prepareOutbox(env, deps, {
    accountId: account.id,
    type: 'PASSWORD_RESET',
    dedupeKey: `password-reset:${reset.id}`,
    payload: { displayName: account.username, expiresMinutes: reset.ttlMinutes },
    secret: reset.token,
  });
  await env.DB.batch([
    reset.invalidatePrevious,
    reset.insert,
    outbox.statement,
    auditStatement(env.DB, deps, {
      actorAccountId: null,
      action: 'PASSWORD_RESET_REQUESTED',
      targetType: 'account',
      targetId: account.id,
    }),
  ]);
  log.info('auth.password_reset_requested', { accountId: account.id });
  ctx.waitUntil(dispatchOutbox(env, deps.clock, log, [outbox.id]));
}

/**
 * Restablecer contraseña (§6): token de un solo uso, revoca TODAS las
 * sesiones y avisa con PASSWORD_CHANGED.
 */
export async function resetPassword(
  ctx: UseCaseContext,
  input: ResetPasswordRequest,
): Promise<void> {
  const { env, deps, log } = ctx;
  await enforceRateLimit(
    deps.rateLimiter,
    await ipRateKey(env, ctx.request, 'reset'),
    RATE_LIMITS.resetPasswordPerIp,
  );

  // Se valida la contraseña ANTES de gastar el token: un error de política no
  // obliga a pedir otro enlace.
  const pending = await peekOneTimeToken(env, deps.clock, 'reset', input.token);
  if (!pending) throw AuthErrors.tokenInvalid();
  const account = await findAccountById(env.DB, pending.accountId);
  if (account?.status !== 'ACTIVE') throw AuthErrors.tokenInvalid();

  const problem = checkPassword(input.password, {
    username: account.username,
    email: account.email_normalized,
  });
  if (problem) throw AuthErrors.weakPassword(PASSWORD_PROBLEM_MESSAGES[problem]);
  const passwordHash = await deps.hasher.hash(input.password);

  const consumed = await consumeOneTimeToken(env, deps.clock, 'reset', input.token);
  if (!consumed || consumed.accountId !== account.id) throw AuthErrors.tokenInvalid();

  const now = deps.clock.now();
  const changed = await prepareOutbox(env, deps, {
    accountId: account.id,
    type: 'PASSWORD_CHANGED',
    dedupeKey: `password-changed:${consumed.tokenId}`,
    payload: { displayName: account.username },
  });
  await env.DB.batch([
    env.DB.prepare('UPDATE accounts SET password_hash = ?, updated_at = ? WHERE id = ?').bind(
      passwordHash,
      now,
      account.id,
    ),
    revokeAllSessionsStatement(env.DB, account.id, now),
    changed.statement,
    auditStatement(env.DB, deps, {
      actorAccountId: account.id,
      action: 'PASSWORD_CHANGED',
      targetType: 'account',
      targetId: account.id,
      reason: 'reset por correo',
    }),
  ]);
  log.info('auth.password_changed', { accountId: account.id });
  ctx.waitUntil(dispatchOutbox(env, deps.clock, log, [changed.id]));
}
