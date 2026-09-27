import type { Clock } from '../lib/clock.ts';
import type { IdGenerator } from '../lib/ids.ts';
import type { Logger } from '../lib/log.ts';
import { auditStatementIf } from './audit.ts';

/**
 * Suspensiones con fin (ADR-0012). Una cuenta SUSPENDED cuyo
 * `suspended_until` ya pasó vuelve a ACTIVE sola: la levanta el cron cada
 * cinco minutos o el login, lo que llegue primero. Solo si confirmó su
 * correo: volver a ACTIVE nunca se salta la verificación.
 */

const EXPIRED = `status = 'SUSPENDED' AND suspended_until IS NOT NULL AND suspended_until <= ?
  AND email_verified_at IS NOT NULL`;

/**
 * Levanta UNA suspensión vencida. La auditoría va primero en el batch porque
 * mira el estado anterior: si otra petición ya la levantó (o alguien volvió a
 * suspender), no se escribe nada dos veces.
 */
export function liftSuspensionStatements(
  db: D1Database,
  deps: { ids: IdGenerator; clock: Clock },
  accountId: string,
  now: number,
  via: 'login' | 'cron',
): D1PreparedStatement[] {
  return [
    auditStatementIf(
      db,
      deps,
      {
        actorAccountId: null,
        action: 'ACCOUNT_REINSTATED',
        targetType: 'account',
        targetId: accountId,
        reason: 'Terminó la suspensión.',
        metadata: { auto: true, via },
      },
      {
        sql: `EXISTS (SELECT 1 FROM accounts WHERE id = ? AND ${EXPIRED})`,
        binds: [accountId, now],
      },
    ),
    db
      .prepare(
        `UPDATE accounts SET status = 'ACTIVE', suspended_until = NULL, updated_at = ?
          WHERE id = ? AND ${EXPIRED}`,
      )
      .bind(now, accountId, now),
  ];
}

/** Cron: levanta las suspensiones vencidas, de cien en cien. */
export async function liftExpiredSuspensions(
  env: Env,
  deps: { clock: Clock; ids: IdGenerator },
  log: Logger,
): Promise<number> {
  const now = deps.clock.now();
  const { results } = await env.DB.prepare(`SELECT id FROM accounts WHERE ${EXPIRED} LIMIT 100`)
    .bind(now)
    .all<{ id: string }>();
  if (results.length === 0) return 0;
  const outcome = await env.DB.batch(
    results.flatMap((row) => liftSuspensionStatements(env.DB, deps, row.id, now, 'cron')),
  );
  // Cada cuenta son dos sentencias; la segunda es el cambio. Un evento por
  // cuenta, igual que el login: el tablero los cuenta uno a uno.
  let lifted = 0;
  results.forEach((row, i) => {
    if (outcome[i * 2 + 1]?.meta.changes !== 1) return;
    lifted += 1;
    log.info('moderation.suspension_lifted', { accountId: row.id, via: 'cron' });
  });
  return lifted;
}
