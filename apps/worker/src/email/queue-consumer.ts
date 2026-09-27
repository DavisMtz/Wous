import { type AppConfig, readConfig } from '../config.ts';
import { socialNoticeProblem } from '../friends/notices.ts';
import { type Clock, systemClock } from '../lib/clock.ts';
import { decryptString } from '../lib/crypto.ts';
import { createLogger, errorFields, type Logger } from '../lib/log.ts';
import { OUTBOX_SECRET_LABEL } from '../notifications/outbox.ts';
import { createBrevoProvider } from './brevo.ts';
import { buildTemplateParams, isSocialType, OutboxType } from './catalog.ts';
import { createLogProvider } from './log-provider.ts';
import { type EmailProvider, EmailSendError } from './provider.ts';
import { EmailQueueMessage, isDeadLetterQueue } from './queue-messages.ts';

export type ConsumerDeps = {
  clock: Clock;
  /** Permite sustituir el proveedor en pruebas (Brevo se mockea, §25). */
  provider?: EmailProvider;
};

type OutboxRow = {
  id: string;
  account_id: string | null;
  type: string;
  payload_json: string;
  secret_enc: string | null;
  status: string;
  attempts: number;
};

type RecipientRow = {
  email: string;
  email_normalized: string;
  username: string;
  status: string;
  email_deliverability: string;
  friend_request_email: number | null;
  friend_accepted_email: number | null;
};

export type ProcessOutcome =
  | { kind: 'sent'; providerMessageId: string }
  | { kind: 'skipped'; reason: string }
  | { kind: 'failed'; reason: string }
  | { kind: 'retry'; reason: string; delaySeconds: number };

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Espera creciente entre reintentos: 30 s, 60 s, 120 s… hasta 15 min. */
export function retryDelaySeconds(attempts: number): number {
  return Math.min(30 * 2 ** Math.max(0, attempts - 1), 900);
}

export function isAllowedRecipient(allowlist: string[], email: string): boolean {
  if (allowlist.length === 0) return true;
  const lower = email.toLowerCase();
  return allowlist.some((entry) =>
    entry.startsWith('@') ? lower.endsWith(entry) : lower === entry,
  );
}

function providerFor(env: Env, config: AppConfig, clock: Clock, log: Logger): EmailProvider {
  if (config.email.mode === 'brevo') {
    return createBrevoProvider({
      apiKey: env.BREVO_API_KEY,
      sender: { name: config.email.fromName, email: config.email.fromEmail },
    });
  }
  return createLogProvider(env, config, clock, log);
}

async function finish(
  db: D1Database,
  id: string,
  status: 'SENT' | 'FAILED',
  now: number,
  fields: { providerMessageId?: string; error?: string },
) {
  await db
    .prepare(
      `UPDATE notification_outbox
          SET status = ?, sent_at = ?, provider_message_id = COALESCE(?, provider_message_id),
              last_error = ?, secret_enc = NULL
        WHERE id = ?`,
    )
    .bind(
      status,
      status === 'SENT' ? now : null,
      fields.providerMessageId ?? null,
      fields.error ?? null,
      id,
    )
    .run();
}

/**
 * Procesa UNA fila del outbox. Idempotente frente a reentregas de la cola:
 * si la fila ya está SENT o FAILED, no hace nada (no hay segundo correo).
 */
export async function processOutbox(
  env: Env,
  config: AppConfig,
  deps: ConsumerDeps,
  log: Logger,
  outboxId: string,
): Promise<ProcessOutcome> {
  const db = env.DB;
  const row = await db
    .prepare(
      `SELECT id, account_id, type, payload_json, secret_enc, status, attempts
         FROM notification_outbox WHERE id = ?`,
    )
    .bind(outboxId)
    .first<OutboxRow>();
  if (!row) return { kind: 'skipped', reason: 'outbox inexistente' };
  if (row.status === 'SENT' || row.status === 'FAILED') {
    return { kind: 'skipped', reason: `ya ${row.status}` };
  }

  // Reclama la fila. PROCESSING se acepta: es una reentrega tras un fallo a medias.
  const claimed = await db
    .prepare(
      `UPDATE notification_outbox SET status = 'PROCESSING', attempts = attempts + 1
        WHERE id = ? AND status IN ('PENDING', 'QUEUED', 'PROCESSING')`,
    )
    .bind(outboxId)
    .run();
  if (claimed.meta.changes !== 1) return { kind: 'skipped', reason: 'no reclamable' };
  const attempts = row.attempts + 1;
  const now = deps.clock.now();

  const fail = async (reason: string): Promise<ProcessOutcome> => {
    await finish(db, outboxId, 'FAILED', now, { error: reason });
    return { kind: 'failed', reason };
  };

  const type = OutboxType.safeParse(row.type);
  if (!type.success) return fail('tipo desconocido');
  if (!row.account_id) return fail('sin destinatario');

  const recipient = await db
    .prepare(
      `SELECT a.email, a.email_normalized, a.username, a.status, a.email_deliverability,
              p.friend_request_email, p.friend_accepted_email
         FROM accounts a LEFT JOIN notification_preferences p ON p.account_id = a.id
        WHERE a.id = ?`,
    )
    .bind(row.account_id)
    .first<RecipientRow>();
  if (!recipient || recipient.status === 'DELETED') return fail('cuenta inexistente');
  if (recipient.email_deliverability === 'UNDELIVERABLE') {
    return fail('correo marcado como no entregable');
  }
  if (isSocialType(type.data)) {
    // Los de seguridad no pasan por aquí: salen aunque los avisos estén apagados.
    const optedIn =
      type.data === 'FRIEND_REQUEST'
        ? recipient.friend_request_email !== 0
        : recipient.friend_accepted_email !== 0;
    if (!optedIn) return fail('preferencia desactivada');
    if (recipient.status !== 'ACTIVE') return fail('cuenta no activa: sin avisos sociales');
    const problem = await socialNoticeProblem(
      db,
      type.data,
      safeJson(row.payload_json),
      row.account_id,
      now,
    );
    if (problem) return fail(problem);
  }
  if (!isAllowedRecipient(config.email.allowlist, recipient.email_normalized)) {
    return fail('destinatario fuera de la lista permitida del entorno');
  }

  let secret: string | null = null;
  if (row.secret_enc) {
    try {
      secret = await decryptString(env.TOKEN_PEPPER, OUTBOX_SECRET_LABEL, row.secret_enc);
    } catch {
      return fail('token ilegible (¿rotó TOKEN_PEPPER?)');
    }
  }

  let params: ReturnType<typeof buildTemplateParams>;
  try {
    params = buildTemplateParams(type.data, JSON.parse(row.payload_json), secret, config.origin);
  } catch (err) {
    return fail(`payload inválido: ${errorFields(err).errorMessage}`);
  }

  const provider = deps.provider ?? providerFor(env, config, deps.clock, log);
  try {
    const { providerMessageId } = await provider.send({
      outboxId,
      type: type.data,
      to: { email: recipient.email, name: recipient.username },
      templateId: config.email.templates[type.data],
      params,
    });
    await finish(db, outboxId, 'SENT', now, { providerMessageId });
    return { kind: 'sent', providerMessageId };
  } catch (err) {
    const reason = errorFields(err).errorMessage?.toString().slice(0, 500) ?? 'error';
    if (err instanceof EmailSendError && err.permanent) return fail(reason);
    await db
      .prepare(
        `UPDATE notification_outbox SET status = 'QUEUED', queued_at = ?, last_error = ?
          WHERE id = ? AND status = 'PROCESSING'`,
      )
      .bind(now, reason, outboxId)
      .run();
    return { kind: 'retry', reason, delaySeconds: retryDelaySeconds(attempts) };
  }
}

/** Tras agotar reintentos: la fila queda FAILED para el runbook de correo. */
async function markDeadLettered(env: Env, outboxId: string) {
  await env.DB.prepare(
    `UPDATE notification_outbox
        SET status = 'FAILED', secret_enc = NULL,
            last_error = COALESCE(last_error, '') || ' · agotó reintentos (DLQ)'
      WHERE id = ? AND status != 'SENT'`,
  )
    .bind(outboxId)
    .run();
}

export function createEmailQueueHandler(deps: ConsumerDeps = { clock: systemClock }) {
  return async function handleEmailQueue(
    batch: MessageBatch<unknown>,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    const config = readConfig(env);
    const log = createLogger({ environment: config.env, queue: batch.queue });
    const deadLetter = isDeadLetterQueue(batch.queue);

    for (const message of batch.messages) {
      const parsed = EmailQueueMessage.safeParse(message.body);
      if (!parsed.success) {
        // Un mensaje malformado no mejora reintentando: se descarta y se registra.
        log.warn('email.queue.invalid_message', { messageId: message.id });
        message.ack();
        continue;
      }
      if (parsed.data.kind === 'probe') {
        log.info('email.queue.probe_received', { messageId: message.id, deadLetter });
        message.ack();
        continue;
      }

      const { outboxId } = parsed.data;
      if (deadLetter) {
        await markDeadLettered(env, outboxId);
        log.error('email.dead_lettered', { outboxId });
        message.ack();
        continue;
      }

      try {
        const outcome = await processOutbox(env, config, deps, log, outboxId);
        if (outcome.kind === 'retry') {
          log.warn('email.send_retry', { outboxId, reason: outcome.reason });
          message.retry({ delaySeconds: outcome.delaySeconds });
        } else {
          const event =
            outcome.kind === 'sent'
              ? 'email.sent'
              : outcome.kind === 'failed'
                ? 'email.delivery_failed'
                : 'email.skipped';
          log.info(event, {
            outboxId,
            ...(outcome.kind === 'sent' ? {} : { reason: outcome.reason }),
          });
          message.ack();
        }
      } catch (err) {
        // Error inesperado (D1 caído…): que la cola reintente.
        log.error('email.consumer_error', { outboxId, ...errorFields(err) });
        message.retry({ delaySeconds: 60 });
      }
    }
  };
}
