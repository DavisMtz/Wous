import {
  type AccountView,
  ForgotPasswordRequest,
  LoginRequest,
  type PendingVerificationResponse,
  RegisterRequest,
  ResendVerificationRequest,
  ResetPasswordRequest,
  type SessionResponse,
  VerifyEmailRequest,
} from '@wous/contracts';
import { Hono } from 'hono';
import { login, logout, logoutEverywhere } from '../../auth/login.ts';
import { forgotPassword, resetPassword } from '../../auth/password-reset.ts';
import { registerAccount } from '../../auth/register.ts';
import { clearSessionCookie, type SessionAccount, setSessionCookie } from '../../auth/sessions.ts';
import { useCaseContext } from '../../auth/use-case.ts';
import { resendVerification, verifyEmail } from '../../auth/verify-email.ts';
import { findCharacterByAccount } from '../../characters/characters.ts';
import { readJson } from '../json.ts';
import { loadSession, requireSession } from '../middleware/session.ts';
import { ok } from '../respond.ts';
import type { AppHono } from '../types.ts';

const pending: PendingVerificationResponse = { status: 'PENDING_VERIFICATION' };

function accountView(account: SessionAccount): AccountView {
  return {
    id: account.id,
    username: account.username,
    email: account.email,
    status: account.status,
    createdAt: account.createdAt,
  };
}

async function sessionResponse(env: Env, account: SessionAccount): Promise<SessionResponse> {
  const character = await findCharacterByAccount(env.DB, account.id);
  return { account: accountView(account), hasCharacter: character !== null, character };
}

export const authRoutes = new Hono<AppHono>()
  .post('/register', async (c) => {
    await registerAccount(useCaseContext(c), await readJson(c, RegisterRequest));
    return ok(c, pending, 202);
  })

  .post('/verify-email', async (c) => {
    const ctx = useCaseContext(c);
    const { session, accountId } = await verifyEmail(ctx, await readJson(c, VerifyEmailRequest));
    setSessionCookie(c, session.token, session.expiresAt);
    const row = await c.env.DB.prepare(
      'SELECT id, email, username, status, created_at AS createdAt FROM accounts WHERE id = ?',
    )
      .bind(accountId)
      .first<SessionAccount>();
    if (!row) throw new Error('Cuenta recién verificada no encontrada');
    return ok(c, await sessionResponse(c.env, row));
  })

  .post('/resend-verification', async (c) => {
    await resendVerification(useCaseContext(c), await readJson(c, ResendVerificationRequest));
    return ok(c, pending, 202);
  })

  .post('/login', async (c) => {
    const { session, account } = await login(useCaseContext(c), await readJson(c, LoginRequest));
    setSessionCookie(c, session.token, session.expiresAt);
    return ok(
      c,
      await sessionResponse(c.env, {
        id: account.id,
        email: account.email,
        username: account.username,
        status: account.status,
        createdAt: account.created_at,
      }),
    );
  })

  .post('/logout', loadSession, async (c) => {
    const session = c.get('session');
    if (session) await logout(useCaseContext(c), session);
    clearSessionCookie(c);
    return c.body(null, 204);
  })

  .post('/logout-all', loadSession, async (c) => {
    await logoutEverywhere(useCaseContext(c), requireSession(c));
    clearSessionCookie(c);
    return c.body(null, 204);
  })

  .post('/forgot-password', async (c) => {
    await forgotPassword(useCaseContext(c), await readJson(c, ForgotPasswordRequest));
    return ok(c, pending, 202);
  })

  .post('/reset-password', async (c) => {
    await resetPassword(useCaseContext(c), await readJson(c, ResetPasswordRequest));
    // Todas las sesiones quedaron revocadas, incluida la de este navegador.
    clearSessionCookie(c);
    return ok(c, { status: 'PASSWORD_CHANGED' as const });
  })

  .get('/session', loadSession, async (c) => {
    const session = requireSession(c);
    return ok(c, await sessionResponse(c.env, session.account));
  });
