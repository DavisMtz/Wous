import { EMAIL, TIME } from '@wous/config';
import type { Clock } from '../lib/clock.ts';
import type { Logger } from '../lib/log.ts';
import { dispatchOutbox } from './outbox.ts';

/**
 * Barrido programado (cron): rescata filas del outbox que no llegaron a la
 * cola (PENDING viejas) o que se perdieron en ella (QUEUED sin movimiento en
 * una hora). Así una caída de la cola o de Brevo no pierde correos.
 */
export async function sweepOutbox(env: Env, clock: Clock, log: Logger): Promise<number> {
  const now = clock.now();
  const { results } = await env.DB.prepare(
    `SELECT id FROM notification_outbox
      WHERE (status = 'PENDING' AND available_at <= ?)
         OR (status = 'QUEUED' AND queued_at <= ?)
      ORDER BY available_at
      LIMIT ?`,
  )
    .bind(now - EMAIL.sweepPendingAfterMs, now - TIME.HOUR, EMAIL.sweepBatchSize)
    .all<{ id: string }>();

  const ids = results.map((r) => r.id);
  if (ids.length > 0) {
    log.warn('email.sweep_rescued', { count: ids.length });
    await dispatchOutbox(env, clock, log, ids);
  }
  return ids.length;
}

/**
 * Limpieza de filas caducadas hace más de una semana. Borra en tandas por la
 * clave primaria (cada tanda lee a lo sumo 500 filas por el índice).
 */
export async function purgeExpired(env: Env, clock: Clock, log: Logger): Promise<void> {
  const cutoff = clock.now() - 7 * TIME.DAY;
  const results = await env.DB.batch([
    env.DB.prepare(
      'DELETE FROM sessions WHERE id IN (SELECT id FROM sessions WHERE expires_at < ? LIMIT 500)',
    ).bind(cutoff),
    env.DB.prepare(
      `DELETE FROM email_verification_tokens WHERE id IN
         (SELECT id FROM email_verification_tokens WHERE expires_at < ? LIMIT 500)`,
    ).bind(cutoff),
    env.DB.prepare(
      `DELETE FROM password_reset_tokens WHERE id IN
         (SELECT id FROM password_reset_tokens WHERE expires_at < ? LIMIT 500)`,
    ).bind(cutoff),
  ]);
  const deleted = results.reduce((sum, r) => sum + (r.meta.changes ?? 0), 0);
  if (deleted > 0) log.info('maintenance.purged', { deleted });
}
