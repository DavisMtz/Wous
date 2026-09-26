import { AUTH, RATE_LIMITS, TIME } from '@wous/config';
import type { ResendVerificationRequest, VerifyEmailRequest } from '@wous/contracts';
import { auditStatement } from '../accounts/audit.ts';
import { normalizeEmail } from '../accounts/normalize.ts';
import { findAccountByEmail, findAccountById } from '../accounts/repo.ts';
import { dispatchOutbox, prepareOutbox } from '../notifications/outbox.ts';
import { enforceRateLimit, ipRateKey } from '../security/rate-limit.ts';
import { AuthErrors } from './errors.ts';
import { type NewSession, prepareSession } from './sessions.ts';
import { consumeOneTimeToken, prepareOneTimeToken } from './tokens.ts';
import type { UseCaseContext } from './use-case.ts';

/**
 * VERIFY_EMAIL (§6). Llega por POST desde la página /verify-email: nunca se
 * consume con un GET, porque los escáneres de correo visitan los enlaces.
 */
export async function verifyEmail(
  ctx: UseCaseContext,
  input: VerifyEmailRequest,
): Promise<{ session: NewSession; accountId: string }> {
  const { env, deps, log } = ctx;
  await enforceRateLimit(
    deps.rateLimiter,
    await ipRateKey(env, ctx.request, 'verify'),
    RATE_LIMITS.verifyEmailPerIp,
  );

  // 1–3. Hash, busca vigente y lo marca usado en UNA sentencia (single-use).
  const consumed = await consumeOneTimeToken(env, deps.clock, 'verify', input.token);
  if (!consumed) throw AuthErrors.tokenInvalid();

  const account = await findAccountById(env.DB, consumed.accountId);
  if (account?.status !== 'PENDING_EMAIL') throw AuthErrors.tokenInvalid();

  // 4–7. Activa, audita, encola la bienvenida y abre sesión: un solo batch.
  const now = deps.clock.now();
  const session = await prepareSession(env, deps, account.id, ctx.userAgent);
  const welcome = await prepareOutbox(env, deps, {
    accountId: account.id,
    type: 'WELCOME_EMAIL',
    dedupeKey: `welcome:${account.id}`,
    payload: { displayName: account.username },
  });
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE accounts SET status = 'ACTIVE', email_verified_at = ?, updated_at = ?
        WHERE id = ? AND status = 'PENDING_EMAIL'`,
    ).bind(now, now, account.id),
    auditStatement(env.DB, deps, {
      actorAccountId: account.id,
      action: 'EMAIL_VERIFIED',
      targetType: 'account',
      targetId: account.id,
    }),
    welcome.statement,
    session.statement,
  ]);

  log.info('auth.email_verified', { accountId: account.id });
  ctx.waitUntil(dispatchOutbox(env, deps.clock, log, [welcome.id]));
  return { session, accountId: account.id };
}

/**
 * Reenvío de verificación (§6): cooldown de 60 s, tope diario y respuesta
 * genérica. Solo el token más reciente sigue siendo válido.
 */
export async function resendVerification(
  ctx: UseCaseContext,
  input: ResendVerificationRequest,
): Promise<void> {
  const { env, deps, log } = ctx;
  await enforceRateLimit(
    deps.rateLimiter,
    await ipRateKey(env, ctx.request, 'resend'),
    RATE_LIMITS.resendVerificationPerIp,
  );
  const human = await deps.turnstile.verify(input.turnstileToken, {
    action: 'resend',
    remoteIp: ctx.remoteIp,
  });
  if (!human) throw AuthErrors.turnstileFailed();

  const account = await findAccountByEmail(env.DB, normalizeEmail(input.email));
  if (account?.status !== 'PENDING_EMAIL') return;

  const now = deps.clock.now();
  const recent = await env.DB.prepare(
    `SELECT COUNT(*) AS n, MAX(created_at) AS last FROM email_verification_tokens
      WHERE account_id = ? AND created_at > ?`,
  )
    .bind(account.id, now - TIME.DAY)
    .first<{ n: number; last: number | null }>();
  if (recent?.last && now - recent.last < AUTH.resendVerificationCooldownMs) {
    log.info('auth.resend_cooldown', { accountId: account.id });
    return;
  }
  if ((recent?.n ?? 0) >= AUTH.resendVerificationMaxPerDay) {
    log.warn('auth.resend_daily_cap', { accountId: account.id });
    return;
  }

  const verification = await prepareOneTimeToken(env, deps, 'verify', account.id);
  const outbox = await prepareOutbox(env, deps, {
    accountId: account.id,
    type: 'EMAIL_VERIFY',
    dedupeKey: `verify:${account.id}:${verification.id}`,
    payload: { displayName: account.username, expiresMinutes: verification.ttlMinutes },
    secret: verification.token,
  });
  await env.DB.batch([verification.invalidatePrevious, verification.insert, outbox.statement]);
  ctx.waitUntil(dispatchOutbox(env, deps.clock, log, [outbox.id]));
}
