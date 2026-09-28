import { MODERATION, TIME } from '@wous/config';
import {
  AccountId,
  type AccountStatus,
  type AdminAccountDetail,
  type AdminAuditEntry,
  type AdminPerson,
  CharacterId,
  type EmailDeliverability,
  type SanctionRequest,
  type StaffRole,
} from '@wous/contracts';
import { type AuditAction, auditStatementIf } from '../accounts/audit.ts';
import { normalizeEmail, normalizeUsername } from '../accounts/normalize.ts';
import { revokeAllSessionsStatement } from '../auth/sessions.ts';
import type { UseCaseContext } from '../auth/use-case.ts';
import { AppError } from '../http/errors.ts';
import { roomOf } from '../world/whereabouts.ts';
import { PERSON_COLUMNS, PERSON_FROM, type PersonRow, toAdminPerson } from './people.ts';
import { reportsAgainst } from './reports.ts';

/**
 * Personas en la caseta (ADR-0012): buscar, ver su ficha y sancionar. Toda
 * sanción deja fila en la bitácora con quien actuó, y aplica en la sala de la
 * persona en el acto (la sala vuelve a leer D1).
 */

export type Actor = { accountId: string; username: string };

// ─── Buscar ──────────────────────────────────────────────────────────────

/**
 * Por `acc_…`, `chr_…`, correo exacto, o un nombre: prefijo del usuario
 * (`@ana` o `ana`, por su índice) o parte del nombre del personaje.
 */
export async function searchAccounts(db: D1Database, raw: string): Promise<AdminPerson[]> {
  const q = raw.normalize('NFC').trim();
  if (q.length < 2 || q.length > 254) return [];
  let where: string;
  let binds: unknown[];
  if (AccountId.safeParse(q).success) {
    where = 'a.id = ?';
    binds = [q];
  } else if (CharacterId.safeParse(q).success) {
    where = 'c.id = ?';
    binds = [q];
  } else if (/^[^@\s]+@[^@\s]+$/.test(q)) {
    where = 'a.email_normalized = ?';
    binds = [normalizeEmail(q)];
  } else {
    const name = q.replace(/^@/, '');
    const user = normalizeUsername(name);
    // instr y no LIKE: D1 rechaza patrones LIKE de más de 50 bytes, e instr no
    // necesita escapar nada. lower() solo toca ASCII, igual que LIKE.
    where = `(a.username_normalized >= ? AND a.username_normalized < ?)
      OR instr(lower(c.display_name), lower(?)) > 0`;
    binds = [user, `${user}￿`, name];
  }
  const { results } = await db
    .prepare(
      `SELECT ${PERSON_COLUMNS} ${PERSON_FROM} WHERE ${where} ORDER BY a.created_at DESC LIMIT ?`,
    )
    .bind(...binds, MODERATION.searchLimit)
    .all<PersonRow>();
  return results.map(toAdminPerson);
}

// ─── Ficha ───────────────────────────────────────────────────────────────

type DetailRow = PersonRow & {
  email: string;
  email_verified_at: number | null;
  email_deliverability: EmailDeliverability;
  created_at: number;
  chat_muted_until: number | null;
  suspended_until: number | null;
  staff_role: StaffRole | null;
  invitation_id: string | null;
  invitation_label: string | null;
};

type AuditRow = {
  id: string;
  action: string;
  reason: string | null;
  created_at: number;
  metadata_json: string | null;
  actor_username: string | null;
};

/** Quién hizo algo: `@usuario` desde la caseta, el moderador del script o nadie (el sistema). */
function auditActor(row: AuditRow): string | null {
  if (row.actor_username) return `@${row.actor_username}`;
  if (!row.metadata_json) return null;
  try {
    const meta = JSON.parse(row.metadata_json) as { moderador?: unknown };
    return typeof meta.moderador === 'string' ? meta.moderador : null;
  } catch {
    return null;
  }
}

function numberOr(value: unknown, fallback: number | null): number | null {
  return typeof value === 'number' ? value : fallback;
}

export async function accountDetail(
  db: D1Database,
  accountId: string,
  now: number,
): Promise<AdminAccountDetail | null> {
  const [accountRes, sessionsRes, countsRes, auditRes] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT ${PERSON_COLUMNS}, a.email, a.email_verified_at, a.email_deliverability,
                a.created_at, a.chat_muted_until, a.suspended_until, st.role AS staff_role,
                i.id AS invitation_id, i.label AS invitation_label
           ${PERSON_FROM}
           LEFT JOIN staff st ON st.account_id = a.id
           LEFT JOIN invitations i ON i.id = a.invitation_id
          WHERE a.id = ?`,
      )
      .bind(accountId),
    db
      .prepare(
        `SELECT SUM(revoked_at IS NULL AND expires_at > ?) AS active, MAX(last_seen_at) AS seen
           FROM sessions WHERE account_id = ?`,
      )
      .bind(now, accountId),
    db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM reports WHERE target_account_id = ?1) AS against,
                (SELECT COUNT(*) FROM reports
                  WHERE target_account_id = ?1 AND status = 'OPEN') AS open_against,
                (SELECT COUNT(*) FROM reports WHERE reporter_account_id = ?1) AS made`,
      )
      .bind(accountId),
    db
      .prepare(
        `SELECT l.id, l.action, l.reason, l.created_at, l.metadata_json,
                actor.username AS actor_username
           FROM audit_log l LEFT JOIN accounts actor ON actor.id = l.actor_account_id
          WHERE l.target_type = 'account' AND l.target_id = ?
          ORDER BY l.created_at DESC LIMIT ?`,
      )
      .bind(accountId, MODERATION.auditEntries),
  ]);
  const row = accountRes?.results[0] as DetailRow | undefined;
  if (!row) return null;
  const sessions = sessionsRes?.results[0] ?? {};
  const counts = countsRes?.results[0] ?? {};
  const audit: AdminAuditEntry[] = ((auditRes?.results ?? []) as AuditRow[]).map((entry) => ({
    id: entry.id,
    action: entry.action,
    reason: entry.reason,
    at: entry.created_at,
    actor: auditActor(entry),
  }));

  return {
    person: toAdminPerson(row),
    email: row.email,
    emailVerifiedAt: row.email_verified_at,
    emailDeliverability: row.email_deliverability,
    createdAt: row.created_at,
    chatMutedUntil:
      row.chat_muted_until !== null && row.chat_muted_until > now ? row.chat_muted_until : null,
    suspendedUntil: row.status === 'SUSPENDED' ? row.suspended_until : null,
    staffRole: row.staff_role,
    invitation:
      row.invitation_id && row.invitation_label
        ? { id: row.invitation_id, label: row.invitation_label }
        : null,
    sessions: {
      active: numberOr(sessions.active, 0) ?? 0,
      lastSeenAt: numberOr(sessions.seen, null),
    },
    reports: {
      against: numberOr(counts.against, 0) ?? 0,
      openAgainst: numberOr(counts.open_against, 0) ?? 0,
      made: numberOr(counts.made, 0) ?? 0,
    },
    recentReports: await reportsAgainst(db, accountId, 10),
    audit,
  };
}

// ─── Sanciones ───────────────────────────────────────────────────────────

export const SanctionErrors = {
  self: () => new AppError('FORBIDDEN', 403, 'No puedes sancionar tu propia cuenta.'),
  staff: () =>
    new AppError(
      'FORBIDDEN',
      403,
      'Esa persona atiende la caseta: primero hay que quitarle el rol con el script.',
    ),
  invalidState: (message: string) => new AppError('INVALID_STATE', 409, message),
  reportMismatch: () => {
    const message = 'Ese reporte no es sobre esta persona.';
    return new AppError('INVALID_REQUEST', 400, message, { fields: { reportId: message } });
  },
};

function hoursText(hours: number): string {
  if (hours % 24 === 0) {
    const days = hours / 24;
    return days === 1 ? '1 día' : `${days} días`;
  }
  return hours === 1 ? '1 hora' : `${hours} horas`;
}

/** Cómo queda escrito en el reporte que se cierra con esta acción. */
function resolutionOf(input: SanctionRequest): string {
  switch (input.action) {
    case 'MUTE':
      return `Silencio de ${hoursText(input.hours ?? 0)}`;
    case 'UNMUTE':
      return 'Se quitó el silencio';
    case 'SUSPEND':
      return input.hours ? `Suspensión de ${hoursText(input.hours)}` : 'Suspensión indefinida';
    case 'REINSTATE':
      return 'Cuenta reactivada';
    case 'BAN':
      return 'Cuenta cerrada';
    case 'END_SESSIONS':
      return 'Sesiones cerradas';
  }
}

type Target = {
  id: string;
  status: AccountStatus;
  chat_muted_until: number | null;
  character_id: string | null;
  staff_role: StaffRole | null;
};

/**
 * Lo que cambia cada acción. `guard` es la condición (sobre el estado
 * anterior) para que aplique: la misma decide si se escribe la bitácora, así
 * dos personas en la caseta a la vez no dejan constancia de algo que no pasó.
 * `null` = la cuenta ya estaba así.
 */
type Plan = {
  audit: AuditAction;
  guard: { sql: string; binds: unknown[] };
  statements: D1PreparedStatement[];
  metadata: Record<string, string | number | boolean | null>;
  /** Hay que avisarle a su sala (silencio o salida). */
  notifyRoom: boolean;
};

function planSanction(
  db: D1Database,
  target: Target,
  input: SanctionRequest,
  now: number,
): Plan | null {
  const id = target.id;
  const exists = (extra: string, ...binds: unknown[]) => ({
    sql: `EXISTS (SELECT 1 FROM accounts WHERE id = ? ${extra})`,
    binds: [id, ...binds],
  });
  switch (input.action) {
    case 'MUTE': {
      const until = now + (input.hours ?? 0) * TIME.HOUR;
      // Nunca acorta: si ya tiene un silencio igual o más largo, no cambia nada.
      // Para acortarlo, primero se quita y luego se pone el nuevo.
      if (target.chat_muted_until !== null && target.chat_muted_until >= until) return null;
      const shorter = 'AND (chat_muted_until IS NULL OR chat_muted_until < ?)';
      return {
        audit: 'CHAT_MUTED',
        guard: exists(shorter, until),
        statements: [
          db
            .prepare(
              `UPDATE accounts SET chat_muted_until = ?, updated_at = ? WHERE id = ? ${shorter}`,
            )
            .bind(until, now, id, until),
        ],
        metadata: { hours: input.hours ?? null, until },
        notifyRoom: true,
      };
    }
    case 'UNMUTE':
      if (target.chat_muted_until === null || target.chat_muted_until <= now) return null;
      return {
        audit: 'CHAT_UNMUTED',
        guard: exists('AND chat_muted_until > ?', now),
        statements: [
          db
            .prepare(
              `UPDATE accounts SET chat_muted_until = NULL, updated_at = ?
                WHERE id = ? AND chat_muted_until > ?`,
            )
            .bind(now, id, now),
        ],
        metadata: {},
        notifyRoom: true,
      };
    case 'SUSPEND': {
      if (target.status === 'BANNED')
        throw SanctionErrors.invalidState('Esa cuenta ya está cerrada.');
      if (target.status === 'PENDING_EMAIL') {
        throw SanctionErrors.invalidState(
          'Esa cuenta no ha confirmado su correo: si es abuso, ciérrala.',
        );
      }
      if (target.status === 'DELETED')
        throw SanctionErrors.invalidState('Esa cuenta ya no existe.');
      const until = input.hours ? now + input.hours * TIME.HOUR : null;
      return {
        audit: 'ACCOUNT_SUSPENDED',
        guard: exists(`AND status IN ('ACTIVE', 'SUSPENDED')`),
        statements: [
          db
            .prepare(
              `UPDATE accounts SET status = 'SUSPENDED', suspended_until = ?, updated_at = ?
                WHERE id = ? AND status IN ('ACTIVE', 'SUSPENDED')`,
            )
            .bind(until, now, id),
          revokeAllSessionsStatement(db, id, now),
        ],
        metadata: { hours: input.hours ?? null, until },
        notifyRoom: true,
      };
    }
    case 'REINSTATE':
      if (target.status === 'ACTIVE') return null;
      if (target.status !== 'SUSPENDED') {
        throw SanctionErrors.invalidState('Solo se reactiva una cuenta suspendida.');
      }
      return {
        audit: 'ACCOUNT_REINSTATED',
        guard: exists(`AND status = 'SUSPENDED'`),
        statements: [
          // Sin correo confirmado vuelve a esperar la confirmación: reactivar
          // nunca se salta la verificación.
          db
            .prepare(
              `UPDATE accounts SET status = CASE WHEN email_verified_at IS NULL
                  THEN 'PENDING_EMAIL' ELSE 'ACTIVE' END,
                  suspended_until = NULL, updated_at = ?
                WHERE id = ? AND status = 'SUSPENDED'`,
            )
            .bind(now, id),
        ],
        metadata: {},
        notifyRoom: false,
      };
    case 'BAN':
      if (target.status === 'BANNED') return null;
      if (target.status === 'DELETED')
        throw SanctionErrors.invalidState('Esa cuenta ya no existe.');
      return {
        audit: 'ACCOUNT_BANNED',
        guard: exists(`AND status NOT IN ('BANNED', 'DELETED')`),
        statements: [
          db
            .prepare(
              `UPDATE accounts SET status = 'BANNED', suspended_until = NULL, updated_at = ?
                WHERE id = ? AND status NOT IN ('BANNED', 'DELETED')`,
            )
            .bind(now, id),
          revokeAllSessionsStatement(db, id, now),
        ],
        metadata: {},
        notifyRoom: true,
      };
    case 'END_SESSIONS':
      return {
        audit: 'SESSIONS_REVOKED',
        guard: {
          sql: `EXISTS (SELECT 1 FROM sessions
                         WHERE account_id = ? AND revoked_at IS NULL AND expires_at > ?)`,
          binds: [id, now],
        },
        statements: [revokeAllSessionsStatement(db, id, now)],
        metadata: {},
        notifyRoom: true,
      };
  }
}

/**
 * Aplica una sanción. `null` si la cuenta no existe; `changed: false` si ya
 * estaba así (repetir no escribe nada, pero sí cierra los reportes pedidos).
 */
export async function sanction(
  ctx: UseCaseContext,
  actor: Actor,
  accountId: string,
  input: SanctionRequest,
): Promise<{ changed: boolean } | null> {
  const { env, deps, log } = ctx;
  const db = env.DB;
  const now = deps.clock.now();
  const target = await db
    .prepare(
      `SELECT a.id, a.status, a.chat_muted_until, c.id AS character_id, st.role AS staff_role
         FROM accounts a
         LEFT JOIN characters c ON c.account_id = a.id
         LEFT JOIN staff st ON st.account_id = a.id
        WHERE a.id = ?`,
    )
    .bind(accountId)
    .first<Target>();
  if (!target) return null;
  if (target.id === actor.accountId) throw SanctionErrors.self();
  if (target.staff_role) throw SanctionErrors.staff();
  if (input.reportId) {
    const report = await db
      .prepare('SELECT 1 AS x FROM reports WHERE id = ? AND target_account_id = ?')
      .bind(input.reportId, accountId)
      .first();
    if (!report) throw SanctionErrors.reportMismatch();
  }

  const plan = planSanction(db, target, input, now);
  const statements: D1PreparedStatement[] = [];
  if (plan) {
    statements.push(
      auditStatementIf(
        db,
        deps,
        {
          actorAccountId: actor.accountId,
          action: plan.audit,
          targetType: 'account',
          targetId: accountId,
          reason: input.reason,
          metadata: {
            via: 'caseta',
            ...plan.metadata,
            ...(input.reportId ? { reportId: input.reportId } : {}),
          },
        },
        plan.guard,
      ),
      ...plan.statements,
    );
  }
  // Cada reporte que se cierra deja su fila en la bitácora, con la misma
  // condición que su cambio (aunque la sanción ya estuviera puesta).
  const resolution = `${resolutionOf(input)} · @${actor.username}`;
  for (const reportId of await reportsToClose(db, accountId, input)) {
    statements.push(
      auditStatementIf(
        db,
        deps,
        {
          actorAccountId: actor.accountId,
          action: 'REPORT_ACTIONED',
          targetType: 'report',
          targetId: reportId,
          reason: input.reason,
          metadata: { via: 'caseta', sanction: input.action },
        },
        {
          sql: `EXISTS (SELECT 1 FROM reports WHERE id = ? AND status = 'OPEN')`,
          binds: [reportId],
        },
      ),
      db
        .prepare(
          `UPDATE reports SET status = 'ACTIONED', resolved_at = ?, resolution = ?
            WHERE id = ? AND status = 'OPEN'`,
        )
        .bind(now, resolution, reportId),
    );
  }
  const results = statements.length > 0 ? await db.batch(statements) : [];
  // La bitácora va primero y con la misma condición que el cambio: si se escribió, cambió.
  const changed = plan !== null && results[0]?.meta.changes === 1;

  log.info('admin.sanction', {
    actorId: actor.accountId,
    targetId: accountId,
    action: input.action,
    changed,
  });
  if (changed && plan?.notifyRoom && target.character_id) {
    await recheckRoom(ctx, target.character_id);
  }
  return { changed };
}

/** El reporte que motivó la acción y, si se pidió, los demás abiertos contra esa persona. */
async function reportsToClose(
  db: D1Database,
  accountId: string,
  input: SanctionRequest,
): Promise<string[]> {
  const ids = new Set<string>();
  if (input.reportId) ids.add(input.reportId);
  if (input.closeOpenReports) {
    const { results } = await db
      .prepare(
        `SELECT id FROM reports WHERE target_account_id = ? AND status = 'OPEN'
          ORDER BY created_at LIMIT ?`,
      )
      .bind(accountId, MODERATION.closeReportsMax)
      .all<{ id: string }>();
    for (const row of results) ids.add(row.id);
  }
  return [...ids];
}

/** Que su sala lo vuelva a revisar ya. Si falla, la revisión del minuto es la red. */
async function recheckRoom(ctx: UseCaseContext, characterId: string): Promise<void> {
  try {
    const room = await roomOf(ctx.env, characterId);
    await room?.recheck();
  } catch (err) {
    ctx.log.warn('admin.recheck_failed', { characterId, error: String(err) });
  }
}
