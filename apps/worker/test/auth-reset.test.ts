import type { ErrorEnvelope } from '@wous/contracts';
import { describe, expect, it } from 'vitest';
import { postJson } from './helpers.ts';
import {
  createVerifiedUser,
  currentSession,
  deliver,
  freshIp,
  outboxOf,
  TURNSTILE_OK,
  tokenFrom,
  withIp,
} from './support.ts';

const NEW_PASSWORD = 'Cafe-de-la-esquina-77';

async function codeOf(res: Response) {
  return ((await res.json()) as ErrorEnvelope).error.code;
}

function forgot(email: string) {
  return postJson(
    '/api/v1/auth/forgot-password',
    { email, turnstileToken: TURNSTILE_OK },
    withIp(freshIp()),
  );
}

async function resetToken(accountId: string) {
  const rows = await outboxOf(accountId, 'PASSWORD_RESET');
  const last = rows.at(-1);
  if (!last) throw new Error('sin outbox de reset');
  const { email } = await deliver(last.id);
  return tokenFrom(email?.params.resetUrl);
}

describe('recuperación de contraseña', () => {
  it('responde siempre igual, exista o no la cuenta', async () => {
    expect((await forgot('nadie-nunca@example.com')).status).toBe(202);
    const user = await createVerifiedUser();
    expect((await forgot(user.email)).status).toBe(202);
    expect(await outboxOf(user.accountId, 'PASSWORD_RESET')).toHaveLength(1);
  });

  it('el reset cambia la contraseña, revoca TODAS las sesiones y avisa', async () => {
    const user = await createVerifiedUser();
    await forgot(user.email);
    const token = await resetToken(user.accountId);

    const res = await postJson(
      '/api/v1/auth/reset-password',
      { token, password: NEW_PASSWORD },
      withIp(freshIp()),
    );
    expect(res.status).toBe(200);
    expect((await currentSession(user.cookie)).status).toBe(401);
    expect(await outboxOf(user.accountId, 'PASSWORD_CHANGED')).toHaveLength(1);

    const login = (password: string) =>
      postJson(
        '/api/v1/auth/login',
        { login: user.email, password, turnstileToken: TURNSTILE_OK },
        withIp(freshIp()),
      );
    expect((await login(NEW_PASSWORD)).status).toBe(200);
    expect((await login('Plaza-de-noche-42')).status).toBe(401);
  });

  it('el token de reset es de un solo uso', async () => {
    const user = await createVerifiedUser();
    await forgot(user.email);
    const token = await resetToken(user.accountId);
    const body = { token, password: NEW_PASSWORD };
    expect((await postJson('/api/v1/auth/reset-password', body)).status).toBe(200);
    const again = await postJson('/api/v1/auth/reset-password', body);
    expect(await codeOf(again)).toBe('TOKEN_INVALID');
  });

  it('una contraseña débil no gasta el token', async () => {
    const user = await createVerifiedUser();
    await forgot(user.email);
    const token = await resetToken(user.accountId);
    const weak = await postJson('/api/v1/auth/reset-password', {
      token,
      password: 'password123',
    });
    expect(await codeOf(weak)).toBe('WEAK_PASSWORD');
    const ok = await postJson('/api/v1/auth/reset-password', { token, password: NEW_PASSWORD });
    expect(ok.status).toBe(200);
  });
});
