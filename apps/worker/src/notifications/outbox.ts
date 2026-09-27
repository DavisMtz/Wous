import type { OutboxPayload, OutboxType } from '../email/catalog.ts';
import type { EmailQueueMessage } from '../email/queue-messages.ts';
import type { Clock } from '../lib/clock.ts';
import { encryptString } from '../lib/crypto.ts';
import type { IdGenerator } from '../lib/ids.ts';
import { errorFields, type Logger } from '../lib/log.ts';

/** Etiqueta HKDF de la llave que cifra el token del outbox (ADR-0006). */
export const OUTBOX_SECRET_LABEL = 'wous/outbox-secret/v1';

export type OutboxDraft<T extends OutboxType> = {
  accountId: string | null;
  type: T;
  /** Clave natural de deduplicación (`verify:<cuenta>:<token>`), o null. */
  dedupeKey: string | null;
  payload: OutboxPayload<T>;
  /** Token en claro; se guarda cifrado y se borra al enviarse. */
  secret?: string;
  /**
   * Solo se inserta si esta condición se cumple AL ESCRIBIR, dentro del mismo
   * batch (p. ej. «la solicitud quedó pendiente y el aviso está encendido»).
   * SQL con `?` sin número: sus valores van después de los de la fila.
   */
  onlyIf?: { sql: string; bindings: unknown[] };
};

export type PreparedOutbox = { id: string; statement: D1PreparedStatement };

/**
 * Prepara la fila del outbox para ir en el MISMO batch que el cambio de
 * dominio: o se guardan los dos, o ninguno. Con `dedupe_key` repetida la
 * inserción no hace nada (no hay segundo correo). Quien necesite saber si se
 * insertó mira `meta.changes` de su resultado en el batch.
 */
export async function prepareOutbox<T extends OutboxType>(
  env: Env,
  deps: { clock: Clock; ids: IdGenerator },
  draft: OutboxDraft<T>,
): Promise<PreparedOutbox> {
  const id = deps.ids.next('outbox');
  const now = deps.clock.now();
  const secretEnc = draft.secret
    ? await encryptString(env.TOKEN_PEPPER, OUTBOX_SECRET_LABEL, draft.secret)
    : null;
  const row = [
    id,
    draft.accountId,
    draft.type,
    draft.dedupeKey,
    JSON.stringify(draft.payload),
    secretEnc,
    now,
    now,
  ];
  const columns = `INSERT INTO notification_outbox (id, account_id, type, dedupe_key, payload_json,
       secret_enc, status, attempts, available_at, created_at)`;
  const onConflict = 'ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING';
  // Con INSERT … SELECT, SQLite exige un WHERE para no confundir el ON CONFLICT con un JOIN.
  const statement = draft.onlyIf
    ? env.DB.prepare(
        `${columns}
         SELECT ?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, ? WHERE ${draft.onlyIf.sql}
         ${onConflict}`,
      ).bind(...row, ...draft.onlyIf.bindings)
    : env.DB.prepare(`${columns} VALUES (?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, ?) ${onConflict}`).bind(
        ...row,
      );
  return { id, statement };
}

/**
 * Publica los IDs en EMAIL_QUEUE y los marca QUEUED. Se llama con waitUntil,
 * DESPUÉS de responder: Brevo nunca está en el camino de la petición (§1.8).
 * Si la cola falla, la fila queda PENDING y la rescata el barrido programado.
 */
export async function dispatchOutbox(
  env: Env,
  clock: Clock,
  log: Logger,
  outboxIds: string[],
): Promise<void> {
  if (outboxIds.length === 0) return;
  try {
    await env.EMAIL_QUEUE.sendBatch(
      outboxIds.map((outboxId) => ({
        body: { v: 1, kind: 'outbox', outboxId } satisfies EmailQueueMessage,
      })),
    );
    const placeholders = outboxIds.map(() => '?').join(', ');
    await env.DB.prepare(
      `UPDATE notification_outbox SET status = 'QUEUED', queued_at = ?
        WHERE id IN (${placeholders}) AND status IN ('PENDING', 'QUEUED')`,
    )
      .bind(clock.now(), ...outboxIds)
      .run();
    log.info('email.enqueued', { count: outboxIds.length });
  } catch (err) {
    log.error('email.enqueue_failed', { count: outboxIds.length, ...errorFields(err) });
  }
}
