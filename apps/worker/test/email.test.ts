import { createExecutionContext, createMessageBatch, getQueueResult } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../src/config.ts';
import { createBrevoProvider } from '../src/email/brevo.ts';
import { createEmailQueueHandler, processOutbox } from '../src/email/queue-consumer.ts';
import { systemClock } from '../src/lib/clock.ts';
import { createLogger } from '../src/lib/log.ts';
import { sweepOutbox } from '../src/notifications/sweeper.ts';
import {
  accountByEmail,
  deliver,
  freshIdentity,
  type OutboxRow,
  outboxOf,
  register,
} from './support.ts';

async function pendingVerifyOutbox() {
  const identity = freshIdentity();
  await register(identity);
  const account = await accountByEmail(identity.email);
  const [outbox] = await outboxOf(account?.id ?? '', 'EMAIL_VERIFY');
  if (!outbox || !account) throw new Error('sin outbox');
  return { identity, account, outbox };
}

async function reload(id: string) {
  return env.DB.prepare('SELECT * FROM notification_outbox WHERE id = ?')
    .bind(id)
    .first<OutboxRow>();
}

/** fetch falso que imita la API de Brevo y guarda lo que se le envió. */
function fakeBrevoFetch(status: number, body: unknown = { messageId: '<abc@smtp-relay.brevo>' }) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return { calls, fetchFn };
}

describe('consumidor de EMAIL_QUEUE', () => {
  it('transforma el outbox en la petición de Brevo y lo deja SENT sin el token', async () => {
    const { outbox, identity } = await pendingVerifyOutbox();
    const brevo = fakeBrevoFetch(201);
    const config = {
      ...readConfig(env),
      email: {
        ...readConfig(env).email,
        templates: { ...readConfig(env).email.templates, EMAIL_VERIFY: 7 },
      },
    };
    const provider = createBrevoProvider({
      apiKey: 'llave-de-prueba',
      sender: { name: 'Wous', email: 'wous@logidma.com' },
      fetchFn: brevo.fetchFn,
    });

    const outcome = await processOutbox(
      env,
      config,
      { clock: systemClock, provider },
      createLogger(),
      outbox.id,
    );
    expect(outcome).toEqual({ kind: 'sent', providerMessageId: '<abc@smtp-relay.brevo>' });

    const [call] = brevo.calls;
    expect(call?.url).toBe('https://api.brevo.com/v3/smtp/email');
    const headers = new Headers(call?.init.headers);
    expect(headers.get('api-key')).toBe('llave-de-prueba');
    const payload = JSON.parse(String(call?.init.body));
    expect(payload.templateId).toBe(7);
    expect(payload.to).toEqual([{ email: identity.email, name: identity.username }]);
    expect(payload.params.displayName).toBe(identity.username);
    expect(payload.params.expiresMinutes).toBe(30);
    expect(payload.params.verificationUrl).toMatch(
      /^http:\/\/localhost:5173\/verify-email\?token=[A-Za-z0-9_-]{43}$/,
    );

    const after = await reload(outbox.id);
    expect(after?.status).toBe('SENT');
    expect(after?.secret_enc).toBeNull();
    expect(after?.provider_message_id).toBe('<abc@smtp-relay.brevo>');
  });

  it('una reentrega del mismo mensaje no manda un segundo correo', async () => {
    const { outbox } = await pendingVerifyOutbox();
    expect((await deliver(outbox.id)).outcome.kind).toBe('sent');
    const second = await deliver(outbox.id);
    expect(second.outcome.kind).toBe('skipped');
    expect(second.email).toBeUndefined();
  });

  it('una caída de Brevo no rompe el registro: la fila queda para reintentar', async () => {
    const { outbox, identity } = await pendingVerifyOutbox();
    const provider = createBrevoProvider({
      apiKey: 'x',
      sender: { name: 'Wous', email: 'wous@logidma.com' },
      fetchFn: fakeBrevoFetch(503, { message: 'caído' }).fetchFn,
    });
    const config = {
      ...readConfig(env),
      email: {
        ...readConfig(env).email,
        templates: { ...readConfig(env).email.templates, EMAIL_VERIFY: 7 },
      },
    };
    const outcome = await processOutbox(
      env,
      config,
      { clock: systemClock, provider },
      createLogger(),
      outbox.id,
    );
    expect(outcome.kind).toBe('retry');

    const after = await reload(outbox.id);
    expect(after?.status).toBe('QUEUED');
    expect(after?.last_error).toContain('503');
    expect(after?.secret_enc).toBeTruthy();
    // La cuenta sigue ahí, pendiente de verificar, como si nada.
    expect((await accountByEmail(identity.email))?.status).toBe('PENDING_EMAIL');

    // Cuando Brevo vuelve, el mismo outbox sale bien.
    expect((await deliver(outbox.id)).outcome.kind).toBe('sent');
  });

  it('un 400 de Brevo es permanente: FAILED sin reintentos', async () => {
    const { outbox } = await pendingVerifyOutbox();
    const provider = createBrevoProvider({
      apiKey: 'x',
      sender: { name: 'Wous', email: 'wous@logidma.com' },
      fetchFn: fakeBrevoFetch(400, { code: 'invalid_parameter' }).fetchFn,
    });
    const base = readConfig(env);
    const config = {
      ...base,
      email: { ...base.email, templates: { ...base.email.templates, EMAIL_VERIFY: 7 } },
    };
    const outcome = await processOutbox(
      env,
      config,
      { clock: systemClock, provider },
      createLogger(),
      outbox.id,
    );
    expect(outcome.kind).toBe('failed');
    expect((await reload(outbox.id))?.status).toBe('FAILED');
  });

  it('en la DLQ el outbox queda FAILED para el runbook', async () => {
    const { outbox } = await pendingVerifyOutbox();
    const handler = createEmailQueueHandler();
    const batch = createMessageBatch<unknown>('wous-email-dlq-local', [
      {
        id: 'dlq-1',
        timestamp: new Date(),
        attempts: 1,
        body: { v: 1, kind: 'outbox', outboxId: outbox.id },
      },
    ]);
    const ctx = createExecutionContext();
    await handler(batch, env, ctx);
    const result = await getQueueResult(batch, ctx);
    expect(result.explicitAcks).toEqual(['dlq-1']);
    const after = await reload(outbox.id);
    expect(after?.status).toBe('FAILED');
    expect(after?.last_error).toContain('DLQ');
    expect(after?.secret_enc).toBeNull();
  });

  it('el consumidor pide reintento a la cola cuando el envío falla de forma transitoria', async () => {
    const { outbox } = await pendingVerifyOutbox();
    const failing = {
      name: 'caido',
      async send(): Promise<{ providerMessageId: string }> {
        const { EmailSendError } = await import('../src/email/provider.ts');
        throw new EmailSendError('temporal', false);
      },
    };
    const handler = createEmailQueueHandler({ clock: systemClock, provider: failing });
    const batch = createMessageBatch<unknown>('wous-email-local', [
      {
        id: 'q-1',
        timestamp: new Date(),
        attempts: 1,
        body: { v: 1, kind: 'outbox', outboxId: outbox.id },
      },
    ]);
    const ctx = createExecutionContext();
    await handler(batch, env, ctx);
    const result = await getQueueResult(batch, ctx);
    // El arnés no expone delaySeconds; su cálculo lo cubre retryDelaySeconds en units.
    expect(result.retryMessages.map((m) => m.msgId)).toEqual(['q-1']);
    expect(result.explicitAcks).toEqual([]);
  });

  it('no envía a direcciones marcadas como no entregables', async () => {
    const { outbox, account } = await pendingVerifyOutbox();
    await env.DB.prepare("UPDATE accounts SET email_deliverability = 'UNDELIVERABLE' WHERE id = ?")
      .bind(account.id)
      .run();
    const { outcome, email } = await deliver(outbox.id);
    expect(outcome).toEqual({ kind: 'failed', reason: 'correo marcado como no entregable' });
    expect(email).toBeUndefined();
  });

  it('respeta la lista permitida del entorno (staging)', async () => {
    const { outbox } = await pendingVerifyOutbox();
    const base = readConfig(env);
    const config = { ...base, email: { ...base.email, allowlist: ['@logidma.com'] } };
    const outcome = await processOutbox(
      env,
      config,
      { clock: systemClock },
      createLogger(),
      outbox.id,
    );
    expect(outcome.kind).toBe('failed');
  });

  it('el barrido rescata filas PENDING que nunca llegaron a la cola', async () => {
    const { outbox } = await pendingVerifyOutbox();
    await env.DB.prepare(
      "UPDATE notification_outbox SET status = 'PENDING', available_at = 1 WHERE id = ?",
    )
      .bind(outbox.id)
      .run();
    const rescued = await sweepOutbox(env, systemClock, createLogger());
    expect(rescued).toBeGreaterThanOrEqual(1);
    expect((await reload(outbox.id))?.status).toBe('QUEUED');
  });
});
