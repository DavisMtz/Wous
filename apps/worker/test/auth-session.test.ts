import { env } from 'cloudflare:workers';
import type { ErrorEnvelope } from '@wous/contracts';
import { describe, expect, it } from 'vitest';
import { call, postJson } from './helpers.ts';
import {
  accountByEmail,
  createVerifiedUser,
  currentSession,
  deliver,
  freshIdentity,
  freshIp,
  outboxOf,
  PASSWORD,
  register,
  sessionCookie,
  TURNSTILE_OK,
  tokenFrom,
  withIp,
} from './support.ts';

async function codeOf(res: Response) {
  return ((await res.json()) as ErrorEnvelope).error.code;
}

function login(loginId: string, password = PASSWORD, ip = freshIp()) {
  return postJson(
    '/api/v1/auth/login',
    { login: loginId, password, turnstileToken: TURNSTILE_OK },
    withIp(ip),
  );
}

async function verificationToken(email: string) {
  const account = await accountByEmail(email);
  const rows = await outboxOf(account?.id ?? '', 'EMAIL_VERIFY');
  const last = rows.at(-1);
  if (!last) throw new Error('sin outbox');
  const { email: sent } = await deliver(last.id);
  return tokenFrom(sent?.params.verificationUrl);
}

describe('verificación de correo', () => {
  it('activa la cuenta, abre sesión y encola la bienvenida', async () => {
    const identity = freshIdentity();
    await register(identity);
    const token = await verificationToken(identity.email);

    const res = await postJson('/api/v1/auth/verify-email', { token }, withIp(freshIp()));
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('Set-Cookie') ?? '';
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toContain('Path=/');

    const account = await accountByEmail(identity.email);
    expect(account?.status).toBe('ACTIVE');
    const welcome = await outboxOf(account?.id ?? '', 'WELCOME_EMAIL');
    expect(welcome).toHaveLength(1);

    const session = await currentSession(sessionCookie(res));
    expect(session.status).toBe(200);
    expect(session.body.data?.account.status).toBe('ACTIVE');
  });

  it('el token es de un solo uso', async () => {
    const identity = freshIdentity();
    await register(identity);
    const token = await verificationToken(identity.email);
    expect((await postJson('/api/v1/auth/verify-email', { token })).status).toBe(200);
    const again = await postJson('/api/v1/auth/verify-email', { token });
    expect(again.status).toBe(400);
    expect(await codeOf(again)).toBe('TOKEN_INVALID');
  });

  it('un token caducado no sirve', async () => {
    const identity = freshIdentity();
    await register(identity);
    const token = await verificationToken(identity.email);
    const account = await accountByEmail(identity.email);
    await env.DB.prepare('UPDATE email_verification_tokens SET expires_at = 1 WHERE account_id = ?')
      .bind(account?.id)
      .run();
    const res = await postJson('/api/v1/auth/verify-email', { token });
    expect(await codeOf(res)).toBe('TOKEN_INVALID');
    expect((await accountByEmail(identity.email))?.status).toBe('PENDING_EMAIL');
  });

  it('un token inventado no sirve y no revela nada', async () => {
    const res = await postJson('/api/v1/auth/verify-email', { token: 'a'.repeat(43) });
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe('TOKEN_INVALID');
  });

  it('el reenvío invalida el token anterior y respeta el cooldown', async () => {
    const identity = freshIdentity();
    await register(identity);
    const first = await verificationToken(identity.email);
    const account = await accountByEmail(identity.email);

    // Dentro del cooldown de 60 s: respuesta genérica, sin token nuevo.
    const resend = () =>
      postJson(
        '/api/v1/auth/resend-verification',
        { email: identity.email, turnstileToken: TURNSTILE_OK },
        withIp(freshIp()),
      );
    expect((await resend()).status).toBe(202);
    expect(await outboxOf(account?.id ?? '', 'EMAIL_VERIFY')).toHaveLength(1);

    // Fuera del cooldown: token nuevo y el anterior queda sin efecto.
    await env.DB.prepare(
      'UPDATE email_verification_tokens SET created_at = created_at - 120000 WHERE account_id = ?',
    )
      .bind(account?.id)
      .run();
    expect((await resend()).status).toBe(202);
    expect(await outboxOf(account?.id ?? '', 'EMAIL_VERIFY')).toHaveLength(2);
    expect(await codeOf(await postJson('/api/v1/auth/verify-email', { token: first }))).toBe(
      'TOKEN_INVALID',
    );
    const second = await verificationToken(identity.email);
    expect((await postJson('/api/v1/auth/verify-email', { token: second })).status).toBe(200);
  });

  it('el reenvío a un correo desconocido responde igual', async () => {
    const res = await postJson(
      '/api/v1/auth/resend-verification',
      { email: 'nadie@example.com', turnstileToken: TURNSTILE_OK },
      withIp(freshIp()),
    );
    expect(res.status).toBe(202);
  });
});

describe('login y sesiones', () => {
  it('una cuenta sin verificar no entra', async () => {
    const identity = freshIdentity();
    await register(identity);
    const res = await login(identity.email);
    expect(res.status).toBe(403);
    expect(await codeOf(res)).toBe('EMAIL_NOT_VERIFIED');
  });

  it('credenciales incorrectas o cuenta inexistente dan el mismo error', async () => {
    const user = await createVerifiedUser();
    const wrong = await login(user.email, 'Otra-contraseña-99');
    const ghost = await login('fantasma@example.com');
    expect(wrong.status).toBe(401);
    expect(ghost.status).toBe(401);
    expect(await codeOf(wrong)).toBe('INVALID_CREDENTIALS');
    expect(await codeOf(ghost)).toBe('INVALID_CREDENTIALS');
  });

  it('entra con correo o con nombre de usuario y la sesión se lee por cookie', async () => {
    const user = await createVerifiedUser();
    const byEmail = await login(user.email.toUpperCase());
    expect(byEmail.status).toBe(200);
    const byUsername = await login(user.username);
    expect(byUsername.status).toBe(200);

    const session = await currentSession(sessionCookie(byUsername));
    expect(session.status).toBe(200);
    expect(session.body.data?.account.username).toBe(user.username);
    expect(JSON.stringify(session.body)).not.toMatch(/password|hash|token/i);
  });

  it('sin cookie o con una inventada, la sesión es AUTH_REQUIRED', async () => {
    expect((await currentSession('')).status).toBe(401);
    const fake = await currentSession(`__Host-wous_session=${'x'.repeat(43)}`);
    expect(fake.status).toBe(401);
  });

  it('logout revoca solo la sesión actual; logout-all revoca todas', async () => {
    const user = await createVerifiedUser();
    const a = sessionCookie(await login(user.email));
    const b = sessionCookie(await login(user.email));

    const out = await call('/api/v1/auth/logout', { method: 'POST', headers: { Cookie: a } });
    expect(out.status).toBe(204);
    expect((await currentSession(a)).status).toBe(401);
    expect((await currentSession(b)).status).toBe(200);

    const all = await call('/api/v1/auth/logout-all', {
      method: 'POST',
      headers: { Cookie: b },
    });
    expect(all.status).toBe(204);
    expect((await currentSession(b)).status).toBe(401);
    expect((await currentSession(user.cookie)).status).toBe(401);
  });

  it('una sesión caducada no vale', async () => {
    const user = await createVerifiedUser();
    await env.DB.prepare('UPDATE sessions SET expires_at = 1 WHERE account_id = ?')
      .bind(user.accountId)
      .run();
    expect((await currentSession(user.cookie)).status).toBe(401);
  });

  it('una cuenta suspendida no entra aunque la contraseña sea correcta', async () => {
    const user = await createVerifiedUser();
    await env.DB.prepare("UPDATE accounts SET status = 'SUSPENDED' WHERE id = ?")
      .bind(user.accountId)
      .run();
    const res = await login(user.email);
    expect(res.status).toBe(403);
    expect(await codeOf(res)).toBe('ACCOUNT_SUSPENDED');
  });

  it('en la base solo está el hash del token de sesión', async () => {
    const user = await createVerifiedUser();
    const raw = user.cookie.split('=')[1] ?? '';
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM sessions WHERE token_hash = ?')
      .bind(raw)
      .first<{ n: number }>();
    expect(row?.n).toBe(0);
  });
});
