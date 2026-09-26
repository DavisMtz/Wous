import { env } from 'cloudflare:workers';
import type { SessionResponse } from '@wous/contracts';
import { expect } from 'vitest';
import { readConfig } from '../src/config.ts';
import type { EmailProvider, OutgoingEmail } from '../src/email/provider.ts';
import { type ConsumerDeps, processOutbox } from '../src/email/queue-consumer.ts';
import { systemClock } from '../src/lib/clock.ts';
import { createLogger } from '../src/lib/log.ts';
import { call, postJson } from './helpers.ts';

/** Token que devuelven las llaves de prueba de Turnstile (el local lo acepta). */
export const TURNSTILE_OK = 'XXXX.DUMMY.TOKEN.XXXX';
export const PASSWORD = 'Plaza-de-noche-42';

let ipCounter = 0;
/** Una IP distinta por prueba: los límites por IP no se pisan entre pruebas. */
export function freshIp(): string {
  ipCounter += 1;
  return `198.51.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`;
}

let userCounter = 0;
export function freshIdentity() {
  userCounter += 1;
  const tag = `${Date.now().toString(36)}${userCounter}`;
  return { email: `persona.${tag}@example.com`, username: `persona_${tag}`.slice(0, 20) };
}

export function withIp(ip: string): RequestInit {
  return { headers: { 'CF-Connecting-IP': ip } };
}

export function register(
  body: Partial<{
    email: string;
    username: string;
    password: string;
    turnstileToken: string;
    termsVersion: string;
  }>,
  ip = freshIp(),
) {
  const identity = freshIdentity();
  return postJson(
    '/api/v1/auth/register',
    {
      email: identity.email,
      username: identity.username,
      password: PASSWORD,
      turnstileToken: TURNSTILE_OK,
      termsVersion: '2026-01',
      ...body,
    },
    withIp(ip),
  );
}

export type OutboxRow = {
  id: string;
  account_id: string;
  type: string;
  status: string;
  attempts: number;
  dedupe_key: string | null;
  payload_json: string;
  secret_enc: string | null;
  provider_message_id: string | null;
  last_error: string | null;
};

export async function outboxOf(accountId: string, type: string) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM notification_outbox WHERE account_id = ? AND type = ? ORDER BY created_at, id',
  )
    .bind(accountId, type)
    .all<OutboxRow>();
  return results;
}

export async function accountByEmail(email: string) {
  return env.DB.prepare('SELECT * FROM accounts WHERE email_normalized = ?')
    .bind(email.toLowerCase())
    .first<{ id: string; status: string; email_deliverability: string; password_hash: string }>();
}

/** Proveedor que captura el correo en vez de enviarlo (Brevo se mockea, §25). */
export function captureProvider() {
  const sent: OutgoingEmail[] = [];
  const provider: EmailProvider = {
    name: 'captura',
    async send(email) {
      sent.push(email);
      return { providerMessageId: `<prueba-${email.outboxId}@wous.test>` };
    },
  };
  return { sent, provider };
}

export async function deliver(outboxId: string, deps: Partial<ConsumerDeps> = {}) {
  const capture = captureProvider();
  const outcome = await processOutbox(
    env,
    readConfig(env),
    { clock: systemClock, provider: capture.provider, ...deps },
    createLogger({ prueba: true }),
    outboxId,
  );
  return { outcome, email: capture.sent[0] };
}

export function tokenFrom(url: string | number | undefined): string {
  const token = new URL(String(url)).searchParams.get('token');
  if (!token) throw new Error('El enlace no trae token');
  return token;
}

export function sessionCookie(res: Response): string {
  const header = res.headers.get('Set-Cookie') ?? '';
  const match = /__Host-wous_session=([^;]*)/.exec(header);
  if (!match?.[1]) throw new Error(`Sin cookie de sesión: ${header}`);
  return `__Host-wous_session=${match[1]}`;
}

/** Registro + correo + verificación: una cuenta ACTIVE con su cookie. */
export async function createVerifiedUser() {
  const identity = freshIdentity();
  const res = await register(identity);
  expect(res.status).toBe(202);
  const account = await accountByEmail(identity.email);
  if (!account) throw new Error('No se creó la cuenta');
  const [outbox] = await outboxOf(account.id, 'EMAIL_VERIFY');
  if (!outbox) throw new Error('No se creó el outbox');
  const { email } = await deliver(outbox.id);
  const token = tokenFrom(email?.params.verificationUrl);
  const verified = await postJson('/api/v1/auth/verify-email', { token }, withIp(freshIp()));
  expect(verified.status).toBe(200);
  return { ...identity, accountId: account.id, cookie: sessionCookie(verified) };
}

export async function currentSession(cookie: string) {
  const res = await call('/api/v1/auth/session', { headers: { Cookie: cookie } });
  return { status: res.status, body: (await res.json()) as { data?: SessionResponse } };
}
