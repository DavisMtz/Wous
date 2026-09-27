import { RATE_LIMITS } from '@wous/config';
import type { LoginRequest } from '@wous/contracts';
import { auditStatement } from '../accounts/audit.ts';
import { normalizeEmail, normalizeUsername } from '../accounts/normalize.ts';
import { type AccountRow, findAccountByEmail, findAccountByUsername } from '../accounts/repo.ts';
import { liftSuspensionStatements } from '../accounts/suspensions.ts';
import { enforceRateLimit, identityRateKey, ipRateKey } from '../security/rate-limit.ts';
import { AuthErrors } from './errors.ts';
import {
  type NewSession,
  prepareSession,
  revokeAllSessionsStatement,
  revokeSessionStatement,
  type SessionContext,
} from './sessions.ts';
import type { UseCaseContext } from './use-case.ts';

/**
 * Estados que no pueden abrir sesión, con su código de dominio (§6). Una
 * suspensión que ya terminó y el cron todavía no levantó se levanta aquí
 * (ADR-0012): `lift`.
 */
function checkCanLogin(account: AccountRow, now: number): 'ok' | 'lift' {
  switch (account.status) {
    case 'ACTIVE':
      return 'ok';
    case 'PENDING_EMAIL':
      throw AuthErrors.emailNotVerified();
    case 'SUSPENDED': {
      const until = account.suspended_until;
      if (until !== null && until <= now) return 'lift';
      throw AuthErrors.accountSuspended(
        until === null ? undefined : Math.max(1, Math.ceil((until - now) / 1000)),
      );
    }
    case 'BANNED':
      throw AuthErrors.accountBanned();
    case 'DELETED':
      throw AuthErrors.invalidCredentials();
  }
}

/** LOGIN (§6): Turnstile, límites, hash, estado y sesión nueva. */
export async function login(
  ctx: UseCaseContext,
  input: LoginRequest,
): Promise<{ session: NewSession; account: AccountRow }> {
  const { env, deps, log } = ctx;
  const byEmail = input.login.includes('@');
  const identity = byEmail ? normalizeEmail(input.login) : normalizeUsername(input.login);

  await enforceRateLimit(
    deps.rateLimiter,
    await ipRateKey(env, ctx.request, 'login'),
    RATE_LIMITS.loginPerIp,
  );
  const human = await deps.turnstile.verify(input.turnstileToken, {
    action: 'login',
    remoteIp: ctx.remoteIp,
  });
  if (!human) throw AuthErrors.turnstileFailed();
  await enforceRateLimit(
    deps.rateLimiter,
    await identityRateKey(env, 'login', identity),
    RATE_LIMITS.loginPerAccount,
  );

  const account = byEmail
    ? await findAccountByEmail(env.DB, identity)
    : await findAccountByUsername(env.DB, identity);
  if (!account) {
    // Mismo coste que un verify real: el tiempo no revela si la cuenta existe.
    await deps.hasher.burn(input.password);
    throw AuthErrors.invalidCredentials();
  }
  if (!(await deps.hasher.verify(account.password_hash, input.password))) {
    log.info('auth.login_failed', { accountId: account.id });
    throw AuthErrors.invalidCredentials();
  }
  const now = deps.clock.now();
  const lift = checkCanLogin(account, now) === 'lift';

  const statements: D1PreparedStatement[] = lift
    ? liftSuspensionStatements(env.DB, deps, account.id, now, 'login')
    : [];
  if (deps.hasher.needsRehash(account.password_hash)) {
    const rehashed = await deps.hasher.hash(input.password);
    statements.push(
      env.DB.prepare('UPDATE accounts SET password_hash = ?, updated_at = ? WHERE id = ?').bind(
        rehashed,
        deps.clock.now(),
        account.id,
      ),
    );
  }
  const session = await prepareSession(env, deps, account.id, ctx.userAgent);
  statements.push(session.statement);
  await env.DB.batch(statements);

  if (lift) log.info('moderation.suspension_lifted', { count: 1, via: 'login' });
  log.info('auth.login_success', { accountId: account.id });
  return {
    session,
    account: lift ? { ...account, status: 'ACTIVE', suspended_until: null } : account,
  };
}

export async function logout(ctx: UseCaseContext, session: SessionContext): Promise<void> {
  await revokeSessionStatement(ctx.env.DB, session.sessionId, ctx.deps.clock.now()).run();
}

/** «Cerrar todas las sesiones» (§6): revoca todas las de la cuenta. */
export async function logoutEverywhere(
  ctx: UseCaseContext,
  session: SessionContext,
): Promise<void> {
  const { env, deps } = ctx;
  await env.DB.batch([
    revokeAllSessionsStatement(env.DB, session.account.id, deps.clock.now()),
    auditStatement(env.DB, deps, {
      actorAccountId: session.account.id,
      action: 'SESSIONS_REVOKED',
      targetType: 'account',
      targetId: session.account.id,
      reason: 'cerrar todas las sesiones',
    }),
  ]);
}
