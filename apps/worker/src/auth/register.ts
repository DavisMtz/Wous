import { AUTH, RATE_LIMITS } from '@wous/config';
import { normalizeInvitationCode, type RegisterRequest } from '@wous/contracts';
import { auditStatement } from '../accounts/audit.ts';
import {
  isReservedUsername,
  maskEmail,
  normalizeEmail,
  normalizeUsername,
} from '../accounts/normalize.ts';
import { checkPassword, PASSWORD_PROBLEM_MESSAGES } from '../accounts/password-policy.ts';
import { findAccountByEmail, holdUsernameStatement, usernameExists } from '../accounts/repo.ts';
import {
  consumeInvitation,
  invitationCodeHash,
  releaseInvitation,
} from '../invitations/invitations.ts';
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
  const { env, deps } = ctx;

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

  // 8. Unicidad del nombre. El nombre de usuario es público: decir que está
  // ocupado no filtra nada.
  if (await usernameExists(env.DB, usernameNormalized)) throw AuthErrors.usernameTaken();

  // 8b. Alpha cerrada (ADR-0012): se gasta el cupo de la invitación después de
  // todo lo demás y ANTES de mirar el correo. Un correo ya registrado gasta el
  // cupo igual: la invitación no sirve para averiguar quién tiene cuenta.
  const invitationId = await claimInvitation(ctx, input.invitationCode);
  try {
    await openAccount(
      ctx,
      input,
      { email, emailNormalized, username, usernameNormalized },
      invitationId,
    );
  } catch (err) {
    // El alta no se hizo (nombre ganado en una carrera, D1 caída…): se devuelve el cupo.
    if (invitationId) await releaseInvitation(env.DB, invitationId);
    throw err;
  }
}

/**
 * Con registro por invitación, gasta un cupo o rechaza con INVITATION_INVALID
 * (el mismo mensaje si no existe, venció, se agotó o la revocaron). Con
 * registro abierto no hace nada.
 */
async function claimInvitation(
  ctx: UseCaseContext,
  rawCode: string | undefined,
): Promise<string | null> {
  if (ctx.config.registration !== 'invite') return null;
  const code = rawCode ? normalizeInvitationCode(rawCode) : null;
  const id = code
    ? await consumeInvitation(
        ctx.env.DB,
        await invitationCodeHash(ctx.env, code),
        ctx.deps.clock.now(),
      )
    : null;
  if (!id) {
    ctx.log.warn('auth.invitation_rejected', { reason: code ? 'not_usable' : 'missing' });
    throw AuthErrors.invitationInvalid();
  }
  return id;
}

type Identity = {
  email: string;
  emailNormalized: string;
  username: string;
  usernameNormalized: string;
};

/** 8c–16: el correo (sin revelar si existe), el hash y el alta atómica. */
async function openAccount(
  ctx: UseCaseContext,
  input: RegisterRequest,
  { email, emailNormalized, username, usernameNormalized }: Identity,
  invitationId: string | null,
): Promise<void> {
  const { env, deps, log } = ctx;

  // El correo NO es público: si existe, se responde igual que si no, y el
  // nombre queda apartado igual que si la cuenta se hubiera creado.
  if (await findAccountByEmail(env.DB, emailNormalized)) {
    await deps.hasher.burn(input.password);
    await holdUsernameStatement(env.DB, usernameNormalized, deps.clock.now()).run();
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
           password_hash, status, terms_version, terms_accepted_at, created_at, updated_at,
           invitation_id)
         VALUES (?, ?, ?, ?, ?, ?, 'PENDING_EMAIL', ?, ?, ?, ?, ?)`,
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
        invitationId,
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
        ...(invitationId ? { metadata: { invitationId } } : {}),
      }),
    ]);
  } catch (err) {
    // Carrera: otra petición ganó el mismo nombre o correo entre la
    // comprobación y el INSERT. El UNIQUE de D1 es la autoridad final.
    const message = errorFields(err).errorMessage ?? '';
    if (/username_normalized/.test(String(message))) throw AuthErrors.usernameTaken();
    // Otra petición registró el mismo correo: como si ya existiera (el cupo se
    // queda gastado y el nombre, apartado).
    if (/email_normalized/.test(String(message))) {
      await holdUsernameStatement(env.DB, usernameNormalized, now).run();
      return;
    }
    throw err;
  }

  log.info('auth.registered', { accountId });

  // 15–16. Publicar en la cola DESPUÉS de responder.
  ctx.waitUntil(dispatchOutbox(env, deps.clock, log, [outbox.id]));
}
