import type { Clock } from '../lib/clock.ts';
import type { IdGenerator } from '../lib/ids.ts';

/** Acciones sensibles que se auditan (§8: no un log de cada movimiento). */
export type AuditAction =
  | 'ACCOUNT_REGISTERED'
  | 'EMAIL_VERIFIED'
  | 'SESSIONS_REVOKED'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_CHANGED'
  | 'EMAIL_MARKED_UNDELIVERABLE'
  | 'CHARACTER_CREATED'
  // Moderación: el script (ADR-0010) las escribe con el moderador en metadata; la
  // caseta (ADR-0012), con quien actuó en actor_account_id.
  | 'CHAT_MUTED'
  | 'CHAT_UNMUTED'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_BANNED'
  | 'ACCOUNT_REINSTATED'
  | 'REPORT_DISMISSED'
  // Caseta y alpha cerrada (ADR-0012). El rol solo lo da y lo quita el script.
  | 'STAFF_GRANTED'
  | 'STAFF_REVOKED'
  | 'INVITATION_CREATED'
  | 'INVITATION_REVOKED';

export type AuditEntry = {
  actorAccountId: string | null;
  action: AuditAction;
  targetType: 'account' | 'session' | 'character' | 'report' | 'invitation';
  targetId: string;
  reason?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

function auditValues(deps: { ids: IdGenerator; clock: Clock }, entry: AuditEntry): unknown[] {
  return [
    deps.ids.next('audit'),
    entry.actorAccountId,
    entry.action,
    entry.targetType,
    entry.targetId,
    entry.reason ?? null,
    entry.metadata ? JSON.stringify(entry.metadata) : null,
    deps.clock.now(),
  ];
}

const AUDIT_COLUMNS = `audit_log (id, actor_account_id, action, target_type, target_id, reason,
  metadata_json, created_at)`;

/** Sentencia lista para ir dentro del mismo `batch` que el cambio auditado. */
export function auditStatement(
  db: D1Database,
  deps: { ids: IdGenerator; clock: Clock },
  entry: AuditEntry,
): D1PreparedStatement {
  return db
    .prepare(`INSERT INTO ${AUDIT_COLUMNS} VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(...auditValues(deps, entry));
}

/**
 * Como `auditStatement`, pero solo escribe si se cumple `condition` (un
 * `EXISTS (…)` con sus parámetros). Va ANTES del cambio en el batch, así mira
 * el estado anterior: si el cambio no aplica (otra persona se adelantó), no
 * queda constancia de algo que no pasó.
 */
export function auditStatementIf(
  db: D1Database,
  deps: { ids: IdGenerator; clock: Clock },
  entry: AuditEntry,
  condition: { sql: string; binds: unknown[] },
): D1PreparedStatement {
  return db
    .prepare(`INSERT INTO ${AUDIT_COLUMNS} SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE ${condition.sql}`)
    .bind(...auditValues(deps, entry), ...condition.binds);
}
