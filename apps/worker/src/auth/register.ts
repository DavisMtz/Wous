import { AUTH, RATE_LIMITS } from '@wous/config';
import type { RegisterRequest } from '@wous/contracts';
import { auditStatement } from '../accounts/audit.ts';
import {
  isReservedUsername,
  maskEmail,
  normalizeEmail,
  normalizeUsername,
} from '../accounts/normalize.ts';
import { checkPassword, PASSWORD_PROBLEM_MESSAGES } from '../accounts/password-policy.ts';
import { findAccountByEmail, usernameExists } from '../accounts/repo.ts';
import { errorFields } from '../lib/log.ts';
import { dispatchOutbox, prepareOutbox } from '../notifications/outbox.ts';
import { enforceRateLimit, identityRateKey, ipRateKey } from '../security/rate-limit.ts';
import { AuthErrors } from './errors.ts';
import { prepareOneTimeToken } from './tokens.ts';
import type { UseCaseContext } from './use-case.ts';

/**
 * REGISTER_ACCOUNT (§6, secuencia exacta). Responde igual exista o no el
 * correo, y sin esperar a Brevo: el correo sale por outbox → cola.
 */
export async function registerAccount(ctx: UseCaseContext, input: RegisterRequest): Promise<void> {
  const { env, deps, log } = ctx;

  // 2–3. Normalización para comparar sin destruir el valor visible.
  const email = input.email.trim();
  const emailNormalized = normalizeEmail(email);
  const username = input.username.trim();
  const usernameNormalized = normalizeUsername(username);

  // 4–5. Límite por IP (también cuenta los intentos que fallan Turnstile),
  // Turnstile en servidor y límite por correo normalizado.
  await enforceRateLimit(
    deps.rateLimiter,
    await ipRateKey(env, ctx.request, 'register'),
    RATE_LIMITS.registerPerIp,
  );
  const human = await deps.turnstile.verify(input.turnstileToken, {
    action: 'register',
    remoteIp: ctx.remoteIp,
  });
  if (!human) throw AuthErrors.turnstileFailed();
  await enforceRateLimit(
    deps.rateLimiter,
    await identityRateKey(env, 'register', emailNormalized),
    RATE_LIMITS.registerPerEmail,
  );

  // 6–7. Políticas de nombre, condiciones y contraseña.
  if (input.termsVersion !== AUTH.termsVersion) throw AuthErrors.termsNotAccepted();
  if (isReservedUsername(usernameNormalized)) {
    throw AuthErrors.invalidUsername('Ese nombre está reservado. Elige otro.');
  }
  const problem = checkPassword(input.password, { username, email: emailNormalized });
  if (problem) throw AuthErrors.weakPassword(PASSWORD_PROBLEM_MESSAGES[problem]);

  // 8. Unicidad. El nombre de usuario es público: decir que está ocupado no
  // filtra nada. El correo NO: si existe, se responde igual que si no.
  if (await usernameExists(env.DB, usernameNormalized)) throw AuthErrors.usernameTaken();
  if (await findAccountByEmail(env.DB, emailNormalized)) {
    await deps.hasher.burn(input.password);
    log.info('auth.register_existing_email', { to: maskEmail(emailNormalized) });
    return;
  }

  // 9. Hash de la contraseña (Argon2id, ADR-0005).
  const passwordHash = await deps.hasher.hash(input.password);

  // 10–14. Cuenta PENDING_EMAIL + token (solo hash) + outbox, en UN batch atómico.
  const now = deps.clock.now();
  const accountId = deps.ids.next('account');
  const verification = await prepareOneTimeToken(env, deps, 'verify', accountId);
  const outbox = await prepareOutbox(env, deps, {
    accountId,
    type: 'EMAIL_VERIFY',
    dedupeKey: `verify:${accountId}:${verification.id}`,
    payload: { displayName: username, expiresMinutes: verification.ttlMinutes },
    secret: verification.token,
  });

  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO accounts (id, email, email_normalized, username, username_normalized,
           password_hash, status, terms_version, terms_accepted_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'PENDING_EMAIL', ?, ?, ?, ?)`,
      ).bind(
        accountId,
        email,
        emailNormalized,
        username,
        usernameNormalized,
        passwordHash,
        input.termsVersion,
        now,
        now,
        now,
      ),
      env.DB.prepare(
        'INSERT INTO notification_preferences (account_id, updated_at) VALUES (?, ?)',
      ).bind(accountId, now),
      verification.insert,
      outbox.statement,
      auditStatement(env.DB, deps, {
        actorAccountId: accountId,
        action: 'ACCOUNT_REGISTERED',
        targetType: 'account',
        targetId: accountId,
      }),
    ]);
  } catch (err) {
    // Carrera: otra petición ganó el mismo nombre o correo entre la
    // comprobación y el INSERT. El UNIQUE de D1 es la autoridad final.
    const message = errorFields(err).errorMessage ?? '';
    if (/username_normalized/.test(String(message))) throw AuthErrors.usernameTaken();
    if (/email_normalized/.test(String(message))) return;
    throw err;
  }

  log.info('auth.registered', { accountId });

  // 15–16. Publicar en la cola DESPUÉS de responder.
  ctx.waitUntil(dispatchOutbox(env, deps.clock, log, [outbox.id]));
}
