import { z } from 'zod';
import { auditStatement } from '../accounts/audit.ts';
import { normalizeEmail } from '../accounts/normalize.ts';
import type { Clock } from '../lib/clock.ts';
import { sha256Base64url, timingSafeEqualStrings } from '../lib/crypto.ts';
import type { IdGenerator } from '../lib/ids.ts';
import type { Logger } from '../lib/log.ts';

/** Un evento transaccional de Brevo (solo los campos que usamos). */
const BrevoEvent = z
  .object({
    event: z.string().max(40),
    email: z.string().max(320).optional(),
    'message-id': z.string().max(300).optional(),
    ts_event: z.number().optional(),
    ts_epoch: z.number().optional(),
    ts: z.number().optional(),
    reason: z.string().optional(),
  })
  .loose();
export const BrevoWebhookPayload = z.union([BrevoEvent, z.array(BrevoEvent).max(100)]);
type BrevoEvent = z.infer<typeof BrevoEvent>;

/** Aperturas y clics no hacen falta para operar: no se guardan (§7). */
const IGNORED_EVENTS = new Set(['opened', 'unique_opened', 'click', 'proxy_open']);

/** Eventos que dicen que la dirección no sirve: se deja de insistir. */
const UNDELIVERABLE_EVENTS = new Set(['hard_bounce', 'invalid_email']);
/**
 * Pasajeros o reversibles. `blocked` es Brevo negándose a enviar porque la
 * dirección está en SU lista de bloqueo (p. ej. por un rebote viejo de otro
 * proyecto de la cuenta): esa lista se puede levantar, así que no se marca
 * como perdida para siempre y el reenvío que pida la persona se intenta.
 */
const SOFT_EVENTS = new Set(['soft_bounce', 'deferred', 'blocked']);

/**
 * Autenticación del webhook: secreto de alta entropía en `Authorization:
 * Bearer …` o en `X-Wous-Webhook-Secret`, comparado en tiempo constante.
 */
export function isAuthorizedWebhook(request: Request, secret: string): boolean {
  const bearer = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const header = request.headers.get('X-Wous-Webhook-Secret');
  const provided = bearer ?? header;
  if (!provided || secret.length < 16) return false;
  return timingSafeEqualStrings(provided, secret);
}

function occurredAt(event: BrevoEvent, now: number): number {
  if (event.ts_epoch) return Math.round(event.ts_epoch);
  const seconds = event.ts_event ?? event.ts;
  return seconds ? seconds * 1000 : now;
}

export type WebhookDeps = { clock: Clock; ids: IdGenerator };

/**
 * Guarda un resumen del evento y actualiza la entregabilidad de la cuenta.
 * Devuelve false si el evento ya se había recibido (reintento del proveedor).
 */
export async function recordBrevoEvent(
  env: Env,
  deps: WebhookDeps,
  log: Logger,
  event: BrevoEvent,
): Promise<'ignored' | 'duplicate' | 'recorded'> {
  const type = event.event.toLowerCase();
  if (IGNORED_EVENTS.has(type)) return 'ignored';

  const now = deps.clock.now();
  const at = occurredAt(event, now);
  const messageId = event['message-id'] ?? null;
  const email = event.email ? normalizeEmail(event.email) : null;
  const providerEventId = await sha256Base64url(`${messageId}|${type}|${at}|${email}`);

  const outbox = messageId
    ? await env.DB.prepare('SELECT id FROM notification_outbox WHERE provider_message_id = ?')
        .bind(messageId)
        .first<{ id: string }>()
    : null;

  const inserted = await env.DB.prepare(
    `INSERT INTO email_delivery_events (id, outbox_id, provider_message_id, provider_event_id,
       event_type, occurred_at, created_at, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (provider_event_id) DO NOTHING`,
  )
    .bind(
      deps.ids.next('deliveryEvent'),
      outbox?.id ?? null,
      messageId,
      providerEventId,
      type,
      at,
      now,
      event.reason ? JSON.stringify({ reason: event.reason.slice(0, 200) }) : null,
    )
    .run();
  if (inserted.meta.changes === 0) return 'duplicate';

  if (!email) return 'recorded';

  // Solo toca la entregabilidad del correo. Nunca saldo, inventario, rol ni permisos.
  if (UNDELIVERABLE_EVENTS.has(type)) {
    const account = await env.DB.prepare(
      `UPDATE accounts SET email_deliverability = 'UNDELIVERABLE', updated_at = ?
        WHERE email_normalized = ? AND email_deliverability != 'UNDELIVERABLE'
        RETURNING id`,
    )
      .bind(now, email)
      .first<{ id: string }>();
    if (account) {
      await auditStatement(env.DB, deps, {
        actorAccountId: null,
        action: 'EMAIL_MARKED_UNDELIVERABLE',
        targetType: 'account',
        targetId: account.id,
        reason: type,
      }).run();
      log.warn('email.marked_undeliverable', { accountId: account.id, event: type });
    }
  } else if (SOFT_EVENTS.has(type)) {
    await env.DB.prepare(
      `UPDATE accounts SET email_deliverability = 'SOFT_BOUNCE', updated_at = ?
        WHERE email_normalized = ? AND email_deliverability IN ('UNKNOWN', 'OK')`,
    )
      .bind(now, email)
      .run();
  } else if (type === 'delivered') {
    await env.DB.prepare(
      `UPDATE accounts SET email_deliverability = 'OK', updated_at = ?
        WHERE email_normalized = ? AND email_deliverability IN ('UNKNOWN', 'SOFT_BOUNCE')`,
    )
      .bind(now, email)
      .run();
  }
  return 'recorded';
}
