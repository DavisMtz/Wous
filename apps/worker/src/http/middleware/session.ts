import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { AuthErrors } from '../../auth/errors.ts';
import { readSessionCookie, resolveSession, type SessionContext } from '../../auth/sessions.ts';
import type { AppHono } from '../types.ts';

/** Resuelve la sesión de la cookie (si hay) para las rutas que la necesitan. */
export const loadSession = createMiddleware<AppHono>(async (c, next) => {
  const session = await resolveSession(
    c.env,
    c.get('deps').clock,
    readSessionCookie(c),
    (promise) => c.executionCtx.waitUntil(promise),
  );
  c.set('session', session);
  await next();
});

export function requireSession(c: Context<AppHono>): SessionContext {
  const session = c.get('session');
  if (!session) throw AuthErrors.authRequired();
  return session;
}

/** Guardia de mundo: solo cuentas ACTIVE (§6). */
export function requireActiveAccount(c: Context<AppHono>): SessionContext {
  const session = requireSession(c);
  switch (session.account.status) {
    case 'ACTIVE':
      return session;
    case 'PENDING_EMAIL':
      throw AuthErrors.emailNotVerified();
    case 'SUSPENDED':
      throw AuthErrors.accountSuspended();
    case 'BANNED':
      throw AuthErrors.accountBanned();
    default:
      throw AuthErrors.accountNotActive();
  }
}
