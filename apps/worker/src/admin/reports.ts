import { MODERATION } from '@wous/config';
import type {
  AdminReportDetail,
  AdminReportFilter,
  AdminReportSummary,
  ReportReason,
  ReportStatus,
} from '@wous/contracts';
import { z } from 'zod';
import { auditStatementIf } from '../accounts/audit.ts';
import type { Clock } from '../lib/clock.ts';
import type { IdGenerator } from '../lib/ids.ts';
import { peopleByAccount } from './people.ts';

/**
 * Reportes en la caseta (ADR-0012). La evidencia es la que guardó la sala al
 * reportar (ADR-0010): lo que repartió, nunca lo que dijo el cliente.
 */

type ReportRow = {
  id: string;
  created_at: number;
  reason: ReportReason;
  status: ReportStatus;
  room: string;
  target_account_id: string;
  reporter_account_id: string;
  message_text: string | null;
  open_against: number;
};

const SUMMARY_COLUMNS = `r.id, r.created_at, r.reason, r.status, r.room, r.target_account_id,
  r.reporter_account_id, json_extract(r.evidence_json, '$.message.text') AS message_text,
  (SELECT COUNT(*) FROM reports o
    WHERE o.target_account_id = r.target_account_id AND o.status = 'OPEN') AS open_against`;

async function summaries(
  db: D1Database,
  rows: readonly ReportRow[],
): Promise<AdminReportSummary[]> {
  const people = await peopleByAccount(
    db,
    rows.flatMap((r) => [r.target_account_id, r.reporter_account_id]),
  );
  return rows.flatMap((row) => {
    const target = people.get(row.target_account_id);
    const reporter = people.get(row.reporter_account_id);
    if (!target || !reporter) return [];
    return [
      {
        id: row.id,
        createdAt: row.created_at,
        reason: row.reason,
        status: row.status,
        room: row.room,
        target,
        reporter,
        messageText: typeof row.message_text === 'string' ? row.message_text : null,
        openAgainstTarget: row.open_against,
      },
    ];
  });
}

/** Los reportes (abiertos o todos), lo más reciente primero. */
export async function listReports(
  db: D1Database,
  filter: AdminReportFilter,
): Promise<AdminReportSummary[]> {
  const where = filter === 'open' ? `WHERE r.status = 'OPEN'` : '';
  const { results } = await db
    .prepare(`SELECT ${SUMMARY_COLUMNS} FROM reports r ${where} ORDER BY r.created_at DESC LIMIT ?`)
    .bind(MODERATION.reportListLimit)
    .all<ReportRow>();
  return summaries(db, results);
}

/** Lo más reciente contra una persona (para su ficha). */
export async function reportsAgainst(
  db: D1Database,
  accountId: string,
  limit: number,
): Promise<AdminReportSummary[]> {
  const { results } = await db
    .prepare(
      `SELECT ${SUMMARY_COLUMNS} FROM reports r
        WHERE r.target_account_id = ? ORDER BY r.created_at DESC LIMIT ?`,
    )
    .bind(accountId, limit)
    .all<ReportRow>();
  return summaries(db, results);
}

/** La evidencia guardada (versión 1, ADR-0010), leída con tolerancia. */
const StoredLine = z.object({
  id: z.string(),
  from: z.string(),
  name: z.string(),
  text: z.string(),
  at: z.number(),
});
const StoredEvidence = z.object({
  capturedAt: z.number(),
  message: StoredLine.nullable(),
  requestedMessageId: z.string().optional(),
  targetMessages: z.array(StoredLine),
  context: z.array(StoredLine),
});

function parseEvidence(json: string, fallbackAt: number): AdminReportDetail['evidence'] {
  let raw: unknown = null;
  try {
    raw = JSON.parse(json);
  } catch {
    // Evidencia ilegible: se muestra vacía antes que romper la caseta.
  }
  const parsed = StoredEvidence.safeParse(raw);
  if (!parsed.success) {
    return {
      capturedAt: fallbackAt,
      message: null,
      messageExpired: false,
      targetMessages: [],
      context: [],
    };
  }
  const e = parsed.data;
  return {
    capturedAt: e.capturedAt,
    message: e.message,
    messageExpired: e.message === null && e.requestedMessageId !== undefined,
    targetMessages: e.targetMessages,
    context: e.context,
  };
}

type DetailRow = ReportRow & {
  note: string | null;
  evidence_json: string;
  resolved_at: number | null;
  resolution: string | null;
};

export async function reportDetail(db: D1Database, id: string): Promise<AdminReportDetail | null> {
  const row = await db
    .prepare(
      `SELECT ${SUMMARY_COLUMNS}, r.note, r.evidence_json, r.resolved_at, r.resolution
         FROM reports r WHERE r.id = ?`,
    )
    .bind(id)
    .first<DetailRow>();
  if (!row) return null;
  const [summary] = await summaries(db, [row]);
  if (!summary) return null;
  return {
    ...summary,
    note: row.note,
    evidence: parseEvidence(row.evidence_json, row.created_at),
    resolvedAt: row.resolved_at,
    resolution: row.resolution,
  };
}

/**
 * Descartar un reporte abierto. Repetirlo (o descartar uno ya atendido) no
 * cambia nada ni deja otra fila en la bitácora.
 */
export async function dismissReport(
  env: Env,
  deps: { clock: Clock; ids: IdGenerator },
  actor: { accountId: string; username: string },
  id: string,
  reason: string,
): Promise<boolean> {
  const now = deps.clock.now();
  const [, update] = await env.DB.batch([
    auditStatementIf(
      env.DB,
      deps,
      {
        actorAccountId: actor.accountId,
        action: 'REPORT_DISMISSED',
        targetType: 'report',
        targetId: id,
        reason,
        metadata: { via: 'caseta' },
      },
      { sql: `EXISTS (SELECT 1 FROM reports WHERE id = ? AND status = 'OPEN')`, binds: [id] },
    ),
    env.DB.prepare(
      `UPDATE reports SET status = 'DISMISSED', resolved_at = ?, resolution = ?
        WHERE id = ? AND status = 'OPEN'`,
    ).bind(now, `Descartado · @${actor.username}`, id),
  ]);
  return update?.meta.changes === 1;
}
