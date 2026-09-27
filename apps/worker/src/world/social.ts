import { SOCIAL } from '@wous/config';
import type { AppearanceInput, BlockedPerson, ReportReason } from '@wous/contracts';
import { canonicalPair } from '../friends/rules.ts';

/**
 * Bloqueos, reportes y la revisión de quien está conectado (ADR-0010). Todo
 * lo que la sala y la API leen o escriben en D1 para la seguridad social.
 */

/** Un bloqueo con dirección: «quien bloquea > a quien», por cuenta. */
export type BlockEdge = `${string}>${string}`;

export function blockEdge(blocker: string, blocked: string): BlockEdge {
  return `${blocker}>${blocked}`;
}

/**
 * Bloqueos entre una persona y un grupo, en las dos direcciones. La sala
 * pregunta solo por la gente que tiene enfrente: quien llegue después trae
 * los suyos al entrar.
 */
export async function loadBlockEdges(
  db: D1Database,
  accountId: string,
  others: readonly string[],
): Promise<BlockEdge[]> {
  if (others.length === 0) return [];
  const { results } = await db
    .prepare(
      `SELECT blocker_account_id AS a, blocked_account_id AS b FROM blocks
        WHERE (blocker_account_id = ?1 AND blocked_account_id IN (SELECT value FROM json_each(?2)))
           OR (blocked_account_id = ?1 AND blocker_account_id IN (SELECT value FROM json_each(?2)))`,
    )
    .bind(accountId, JSON.stringify(others))
    .all<{ a: string; b: string }>();
  return results.map((r) => blockEdge(r.a, r.b));
}

export type BlockResult = 'added' | 'exists' | 'limit';

/**
 * Bloquear es idempotente: repetirlo no cambia nada ni cuenta dos veces. En el
 * mismo batch, **el bloqueo gana** (ADR-0010, ADR-0011): la amistad o la
 * solicitud del par termina. Solo se salva una solicitud en la sombra de la
 * persona bloqueada: ya era invisible, y quitarla la delataría.
 */
export async function addBlock(
  db: D1Database,
  blocker: string,
  blocked: string,
  now: number,
): Promise<BlockResult> {
  const { low, high } = canonicalPair(blocker, blocked);
  const [inserted] = await db.batch([
    db
      .prepare(
        `INSERT INTO blocks (blocker_account_id, blocked_account_id, created_at)
         SELECT ?1, ?2, ?3
          WHERE (SELECT COUNT(*) FROM blocks WHERE blocker_account_id = ?1) < ?4
         ON CONFLICT DO NOTHING`,
      )
      .bind(blocker, blocked, now, SOCIAL.maxBlocksPerAccount),
    db
      .prepare(
        `UPDATE friendships
            SET status = 'REMOVED', ended_at = ?3, ended_reason = 'BLOCKED', updated_at = ?3
          WHERE account_low = ?4 AND account_high = ?5 AND status IN ('PENDING', 'ACCEPTED')
            AND (hidden = 0 OR requester_id = ?1)
            AND EXISTS (SELECT 1 FROM blocks
                         WHERE blocker_account_id = ?1 AND blocked_account_id = ?2)`,
      )
      .bind(blocker, blocked, now, low, high),
  ]);
  if (inserted?.meta.changes === 1) return 'added';
  const exists = await db
    .prepare('SELECT 1 AS x FROM blocks WHERE blocker_account_id = ? AND blocked_account_id = ?')
    .bind(blocker, blocked)
    .first();
  return exists ? 'exists' : 'limit';
}

export async function removeBlock(
  db: D1Database,
  blocker: string,
  blocked: string,
): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM blocks WHERE blocker_account_id = ? AND blocked_account_id = ?')
    .bind(blocker, blocked)
    .run();
  return result.meta.changes === 1;
}

type BlockedRow = {
  character_id: string;
  display_name: string;
  created_at: number;
  body_id: string;
  skin_tone_id: string;
  hair_id: string;
  hair_color_id: string;
  top_id: string;
  bottom_id: string;
  shoes_id: string;
  accessory_id: string | null;
};

/** A quién bloqueaste, lo más reciente primero (para la casa). */
export async function listBlocks(db: D1Database, blocker: string): Promise<BlockedPerson[]> {
  const { results } = await db
    .prepare(
      `SELECT c.id AS character_id, c.display_name, b.created_at, a.body_id, a.skin_tone_id,
              a.hair_id, a.hair_color_id, a.top_id, a.bottom_id, a.shoes_id, a.accessory_id
         FROM blocks b
         JOIN characters c ON c.account_id = b.blocked_account_id
         JOIN character_appearance a ON a.character_id = c.id
        WHERE b.blocker_account_id = ?
        ORDER BY b.created_at DESC`,
    )
    .bind(blocker)
    .all<BlockedRow>();
  return results.map((row) => ({
    characterId: row.character_id,
    displayName: row.display_name,
    blockedAt: row.created_at,
    appearance: {
      body: row.body_id,
      skinTone: row.skin_tone_id,
      hair: row.hair_id,
      hairColor: row.hair_color_id,
      top: row.top_id,
      bottom: row.bottom_id,
      shoes: row.shoes_id,
      accessory: row.accessory_id,
    } as AppearanceInput,
  }));
}

/** La cuenta dueña de un personaje (para desbloquear desde la casa). */
export async function accountOfCharacter(
  db: D1Database,
  characterId: string,
): Promise<string | null> {
  const row = await db
    .prepare('SELECT account_id FROM characters WHERE id = ?')
    .bind(characterId)
    .first<{ account_id: string }>();
  return row?.account_id ?? null;
}

// ─── Reportes ──────────────────────────────────────────────────────────────

export type NewReport = {
  id: string;
  reporterAccountId: string;
  reporterCharacterId: string;
  targetAccountId: string;
  targetCharacterId: string;
  reason: ReportReason;
  note: string | null;
  messageId: string | null;
  room: string;
  evidence: unknown;
  createdAt: number;
};

/**
 * Guarda el reporte con su evidencia. Si la misma persona ya reportó a la
 * misma persona dentro del enfriamiento, no se duplica (el reporte que ya
 * estaba sigue abierto).
 */
export async function insertReport(
  db: D1Database,
  report: NewReport,
): Promise<'created' | 'duplicate'> {
  const result = await db
    .prepare(
      `INSERT INTO reports (id, reporter_account_id, reporter_character_id, target_account_id,
         target_character_id, reason, note, message_id, room, evidence_json, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11
        WHERE NOT EXISTS (
          SELECT 1 FROM reports
           WHERE reporter_account_id = ?2 AND target_account_id = ?4 AND created_at > ?12
        )`,
    )
    .bind(
      report.id,
      report.reporterAccountId,
      report.reporterCharacterId,
      report.targetAccountId,
      report.targetCharacterId,
      report.reason,
      report.note,
      report.messageId,
      report.room,
      JSON.stringify(report.evidence),
      report.createdAt,
      report.createdAt - SOCIAL.reportCooldownMs,
    )
    .run();
  return result.meta.changes === 1 ? 'created' : 'duplicate';
}

// ─── Revisión de quien está conectado ─────────────────────────────────────

export type Standing = {
  /** Cuenta activa y sesión vigente: puede seguir en la sala. */
  allowed: boolean;
  /** Silencio de moderación vigente (epoch ms) o null. */
  mutedUntil: number | null;
};

/**
 * Lo que la sala revisa cada `SOCIAL.recheckMs` de quien tiene conectado: el
 * handshake ya exigió cuenta ACTIVE y sesión válida, pero un socket abierto
 * no se volvía a mirar nunca. Suspender, banear o cerrar sesión en todos
 * lados ahora saca a la persona en ese plazo. Una sola ida a D1 por sala.
 */
export async function reviewStanding(
  db: D1Database,
  people: readonly { accountId: string; sessionId: string }[],
  now: number,
): Promise<Map<string, Standing>> {
  const out = new Map<string, Standing>();
  if (people.length === 0) return out;
  const accounts = [...new Set(people.map((p) => p.accountId))];
  const sessions = [...new Set(people.map((p) => p.sessionId))];
  const [accountRows, sessionRows] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT id, status, chat_muted_until FROM accounts
          WHERE id IN (SELECT value FROM json_each(?))`,
      )
      .bind(JSON.stringify(accounts)),
    db
      .prepare(
        `SELECT id FROM sessions
          WHERE id IN (SELECT value FROM json_each(?)) AND revoked_at IS NULL AND expires_at > ?`,
      )
      .bind(JSON.stringify(sessions), now),
  ]);
  const status = new Map<string, { status: string; muted: number | null }>();
  for (const row of accountRows?.results ?? []) {
    status.set(String(row.id), {
      status: String(row.status),
      muted: typeof row.chat_muted_until === 'number' ? row.chat_muted_until : null,
    });
  }
  const live = new Set((sessionRows?.results ?? []).map((row) => String(row.id)));
  for (const p of people) {
    const account = status.get(p.accountId);
    out.set(`${p.accountId}|${p.sessionId}`, {
      allowed: account?.status === 'ACTIVE' && live.has(p.sessionId),
      mutedUntil: account?.muted && account.muted > now ? account.muted : null,
    });
  }
  return out;
}
