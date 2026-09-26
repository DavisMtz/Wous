import type { Clock } from '../lib/clock.ts';
import type { IdGenerator } from '../lib/ids.ts';

/** Acciones sensibles que se auditan (§8: no un log de cada movimiento). */
export type AuditAction =
  | 'ACCOUNT_REGISTERED'
  | 'EMAIL_VERIFIED'
  | 'LOGIN_SUCCEEDED'
  | 'SESSIONS_REVOKED'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_CHANGED'
  | 'EMAIL_MARKED_UNDELIVERABLE';

export type AuditEntry = {
  actorAccountId: string | null;
  action: AuditAction;
  targetType: 'account' | 'session' | 'character';
  targetId: string;
  reason?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

/** Sentencia lista para ir dentro del mismo `batch` que el cambio auditado. */
export function auditStatement(
  db: D1Database,
  deps: { ids: IdGenerator; clock: Clock },
  entry: AuditEntry,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO audit_log (id, actor_account_id, action, target_type, target_id, reason,
         metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      deps.ids.next('audit'),
      entry.actorAccountId,
      entry.action,
      entry.targetType,
      entry.targetId,
      entry.reason ?? null,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
      deps.clock.now(),
    );
}
