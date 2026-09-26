import { env } from 'cloudflare:workers';
import type { ErrorEnvelope } from '@wous/contracts';
import { describe, expect, it } from 'vitest';
import { accountByEmail, freshIdentity, freshIp, outboxOf, PASSWORD, register } from './support.ts';

async function codeOf(res: Response) {
  return ((await res.json()) as ErrorEnvelope).error.code;
}

describe('POST /api/v1/auth/register', () => {
  it('crea cuenta PENDING_EMAIL + token (solo hash) + outbox, sin llamar a Brevo', async () => {
    const identity = freshIdentity();
    const res = await register(identity);
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ data: { status: 'PENDING_VERIFICATION' } });

    const account = await accountByEmail(identity.email);
    expect(account?.status).toBe('PENDING_EMAIL');
    expect(account?.password_hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);

    const token = await env.DB.prepare(
      'SELECT token_hash, expires_at, created_at FROM email_verification_tokens WHERE account_id = ?',
    )
      .bind(account?.id)
      .first<{ token_hash: string; expires_at: number; created_at: number }>();
    expect(token?.token_hash).toHaveLength(43);
    expect((token?.expires_at ?? 0) - (token?.created_at ?? 0)).toBe(30 * 60 * 1000);

    const [outbox] = await outboxOf(account?.id ?? '', 'EMAIL_VERIFY');
    expect(outbox?.status).toMatch(/PENDING|QUEUED/);
    expect(outbox?.provider_message_id).toBeNull();
    expect(outbox?.secret_enc).toBeTruthy();
    // El payload guardado no lleva el enlace con token: ese va cifrado aparte.
    expect(outbox?.payload_json).not.toContain('token');

    const prefs = await env.DB.prepare(
      'SELECT marketing_email FROM notification_preferences WHERE account_id = ?',
    )
      .bind(account?.id)
      .first<{ marketing_email: number }>();
    expect(prefs?.marketing_email).toBe(0);
  });

  it('con un correo ya registrado responde igual y no crea nada', async () => {
    const identity = freshIdentity();
    await register(identity);
    const again = await register({ email: identity.email.toUpperCase() });
    expect(again.status).toBe(202);
    expect(await again.json()).toMatchObject({ data: { status: 'PENDING_VERIFICATION' } });

    const { results } = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM accounts WHERE email_normalized = ?',
    )
      .bind(identity.email.toLowerCase())
      .all<{ n: number }>();
    expect(results[0]?.n).toBe(1);
  });

  it('un nombre de usuario ocupado responde USERNAME_TAKEN', async () => {
    const identity = freshIdentity();
    await register(identity);
    const res = await register({ username: identity.username.toUpperCase() });
    expect(res.status).toBe(409);
    expect(await codeOf(res)).toBe('USERNAME_TAKEN');
  });

  it('rechaza nombres reservados, contraseñas débiles y condiciones viejas', async () => {
    expect(await codeOf(await register({ username: 'admin' }))).toBe('INVALID_USERNAME');
    expect(await codeOf(await register({ password: 'contraseña123' }))).toBe('WEAK_PASSWORD');
    const identity = freshIdentity();
    expect(
      await codeOf(await register({ ...identity, password: `xx${identity.username}xx` })),
    ).toBe('WEAK_PASSWORD');
    expect(await codeOf(await register({ termsVersion: '2020-01' }))).toBe('TERMS_NOT_ACCEPTED');
  });

  it('valida el contrato antes que nada', async () => {
    const res = await register({ email: 'no-es-correo', password: 'corta' });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.code).toBe('INVALID_REQUEST');
    expect(Object.keys(body.error.fields ?? {})).toEqual(
      expect.arrayContaining(['email', 'password']),
    );
  });

  it('sin Turnstile válido no registra', async () => {
    const identity = freshIdentity();
    const res = await register({ ...identity, turnstileToken: 'token-falso' });
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe('TURNSTILE_FAILED');
    expect(await accountByEmail(identity.email)).toBeNull();
  });

  it('limita los registros por IP con RATE_LIMITED y Retry-After', async () => {
    const ip = freshIp();
    for (let i = 0; i < 5; i++) {
      expect((await register({}, ip)).status).toBe(202);
    }
    const blocked = await register({}, ip);
    expect(blocked.status).toBe(429);
    expect(await codeOf(blocked)).toBe('RATE_LIMITED');
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0);
    // Otra IP no está afectada.
    expect((await register({}, freshIp())).status).toBe(202);
  });

  it('la contraseña nunca aparece en la base', async () => {
    const identity = freshIdentity();
    await register(identity);
    const dump = await env.DB.prepare(
      'SELECT password_hash FROM accounts WHERE email_normalized = ?',
    )
      .bind(identity.email.toLowerCase())
      .first<{ password_hash: string }>();
    expect(dump?.password_hash).not.toContain(PASSWORD);
  });
});
