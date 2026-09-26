import { env, exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { accountByEmail, deliver, freshIdentity, outboxOf, register } from './support.ts';

function webhook(body: unknown, secret: string | null = env.BREVO_WEBHOOK_SECRET) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret !== null) headers.Authorization = `Bearer ${secret}`;
  // Sin Origin: los webhooks vienen de servidores, no de navegadores.
  return exports.default.fetch(
    new Request('http://localhost/api/v1/webhooks/brevo', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }),
  );
}

async function sentOutbox() {
  const identity = freshIdentity();
  await register(identity);
  const account = await accountByEmail(identity.email);
  const [outbox] = await outboxOf(account?.id ?? '', 'EMAIL_VERIFY');
  if (!outbox || !account) throw new Error('sin outbox');
  const { outcome } = await deliver(outbox.id);
  if (outcome.kind !== 'sent') throw new Error('no se envió');
  return { identity, account, outbox, messageId: outcome.providerMessageId };
}

describe('POST /api/v1/webhooks/brevo', () => {
  it('sin el secreto responde 401 y no guarda nada', async () => {
    expect((await webhook({ event: 'delivered' }, null)).status).toBe(401);
    expect((await webhook({ event: 'delivered' }, 'secreto-equivocado-123456')).status).toBe(401);
  });

  it('guarda el evento una sola vez aunque Brevo reintente', async () => {
    const { identity, outbox, messageId } = await sentOutbox();
    const event = {
      event: 'delivered',
      email: identity.email,
      'message-id': messageId,
      ts_event: 1_790_000_000,
    };
    expect((await webhook(event)).status).toBe(204);
    expect((await webhook(event)).status).toBe(204);

    const { results } = await env.DB.prepare(
      'SELECT event_type, outbox_id FROM email_delivery_events WHERE provider_message_id = ?',
    )
      .bind(messageId)
      .all<{ event_type: string; outbox_id: string }>();
    expect(results).toEqual([{ event_type: 'delivered', outbox_id: outbox.id }]);
    expect((await accountByEmail(identity.email))?.email_deliverability).toBe('OK');
  });

  it('un hard bounce marca el correo como no entregable y audita', async () => {
    const { identity, account, messageId } = await sentOutbox();
    const res = await webhook([
      { event: 'hard_bounce', email: identity.email, 'message-id': messageId, ts_event: 1 },
    ]);
    expect(res.status).toBe(204);
    expect((await accountByEmail(identity.email))?.email_deliverability).toBe('UNDELIVERABLE');
    const audit = await env.DB.prepare(
      "SELECT reason FROM audit_log WHERE target_id = ? AND action = 'EMAIL_MARKED_UNDELIVERABLE'",
    )
      .bind(account.id)
      .first<{ reason: string }>();
    expect(audit?.reason).toBe('hard_bounce');
  });

  it('ignora aperturas y clics (no se rastrean)', async () => {
    const { identity, messageId } = await sentOutbox();
    await webhook({ event: 'opened', email: identity.email, 'message-id': messageId, ts: 5 });
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM email_delivery_events WHERE event_type = 'opened'",
    ).first<{ n: number }>();
    expect(row?.n).toBe(0);
  });

  it('rechaza un cuerpo que no cumple el esquema', async () => {
    const res = await webhook({ sin_evento: true });
    expect(res.status).toBe(400);
  });
});
