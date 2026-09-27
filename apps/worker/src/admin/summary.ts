import { TIME } from '@wous/config';
import type { AdminRoomOccupancy, AdminSummary } from '@wous/contracts';
import { getMap, MAP_IDS } from '@wous/world-data';
import type { AppConfig } from '../config.ts';
import type { Logger } from '../lib/log.ts';
import { directoryObjectName } from '../world/players.ts';

/**
 * El tablero de la caseta (ADR-0012): lo que vive en D1 y en los directorios
 * de sala, ahora mismo. Los contadores que viven en los logs (logins,
 * errores, latencias) se consultan con scripts/observabilidad.
 */

type Row = Record<string, unknown>;

function count(row: Row | undefined, key: string): number {
  const value = row?.[key];
  return typeof value === 'number' ? value : 0;
}

/** Quién está conectado, por sala e instancia, según los directorios. */
async function population(env: Env, log: Logger): Promise<AdminSummary['population']> {
  const rooms: AdminRoomOccupancy[] = [];
  await Promise.all(
    MAP_IDS.map(async (mapId) => {
      try {
        const directory = env.ROOM_DIRECTORY.get(
          env.ROOM_DIRECTORY.idFromName(directoryObjectName(mapId)),
        );
        const state = await directory.occupancy();
        const name = getMap(mapId)?.name ?? mapId;
        for (const [instance, info] of Object.entries(state.instances)) {
          rooms.push({ mapId, name, instance, count: info.count, updatedAt: info.updatedAt });
        }
      } catch (err) {
        // Un directorio que no contesta no tumba el tablero entero.
        log.warn('admin.occupancy_failed', { map: mapId, error: String(err) });
      }
    }),
  );
  rooms.sort((a, b) =>
    a.mapId === b.mapId ? a.instance.localeCompare(b.instance) : a.mapId.localeCompare(b.mapId),
  );
  return { total: rooms.reduce((sum, r) => sum + r.count, 0), rooms };
}

export async function adminSummary(
  env: Env,
  config: AppConfig,
  now: number,
  log: Logger,
): Promise<AdminSummary> {
  const db = env.DB;
  const day = now - TIME.DAY;
  const week = now - 7 * TIME.DAY;
  const startOfDayUtc = Math.floor(now / TIME.DAY) * TIME.DAY;

  const [accounts, sessions, activity, reports, email, inFlight, invitations] = await db.batch<Row>(
    [
      db
        .prepare(
          `SELECT COUNT(*) AS total,
                  SUM(status = 'ACTIVE') AS active,
                  SUM(status = 'PENDING_EMAIL') AS pending,
                  SUM(status = 'SUSPENDED') AS suspended,
                  SUM(status = 'BANNED') AS banned,
                  SUM(created_at > ?1) AS new_day,
                  SUM(created_at > ?2) AS new_week,
                  SUM(chat_muted_until > ?3) AS muted,
                  SUM(email_deliverability = 'UNDELIVERABLE') AS undeliverable,
                  SUM(invitation_id IS NOT NULL AND created_at > ?2) AS invited_week
             FROM accounts`,
        )
        .bind(day, week, now),
      db
        .prepare('SELECT COUNT(*) AS n FROM sessions WHERE expires_at > ? AND revoked_at IS NULL')
        .bind(now),
      // `last_seen_at` se escribe cada 15 minutos como mucho: alcanza para «usó Wous hoy».
      db
        .prepare(
          `SELECT COUNT(DISTINCT CASE WHEN last_seen_at > ?1 THEN account_id END) AS day,
                  COUNT(DISTINCT account_id) AS week
             FROM sessions WHERE last_seen_at > ?2`,
        )
        .bind(day, week),
      db
        .prepare(`SELECT SUM(status = 'OPEN') AS open, SUM(created_at > ?) AS week FROM reports`)
        .bind(week),
      db
        .prepare(
          `SELECT SUM(status = 'SENT' AND sent_at >= ?1) AS sent_today,
                  SUM(status = 'FAILED' AND created_at > ?2) AS failed_week
             FROM notification_outbox WHERE created_at > ?2 OR sent_at >= ?1`,
        )
        .bind(startOfDayUtc, week),
      db.prepare(
        `SELECT COUNT(*) AS n FROM notification_outbox
          WHERE status IN ('PENDING', 'QUEUED', 'PROCESSING')`,
      ),
      db
        .prepare(
          `SELECT COUNT(*) AS active, SUM(max_uses - uses) AS uses_left FROM invitations
            WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)
              AND uses < max_uses`,
        )
        .bind(now),
    ],
  );

  const a = accounts?.results[0];
  return {
    generatedAt: now,
    environment: config.env,
    registration: config.registration,
    population: await population(env, log),
    accounts: {
      total: count(a, 'total'),
      active: count(a, 'active'),
      pendingEmail: count(a, 'pending'),
      suspended: count(a, 'suspended'),
      banned: count(a, 'banned'),
      newLast24h: count(a, 'new_day'),
      newLast7d: count(a, 'new_week'),
    },
    activity: {
      sessionsActive: count(sessions?.results[0], 'n'),
      accountsLast24h: count(activity?.results[0], 'day'),
      accountsLast7d: count(activity?.results[0], 'week'),
    },
    moderation: {
      openReports: count(reports?.results[0], 'open'),
      reportsLast7d: count(reports?.results[0], 'week'),
      mutedNow: count(a, 'muted'),
    },
    email: {
      sentToday: count(email?.results[0], 'sent_today'),
      failedLast7d: count(email?.results[0], 'failed_week'),
      inFlight: count(inFlight?.results[0], 'n'),
      undeliverable: count(a, 'undeliverable'),
    },
    invitations: {
      active: count(invitations?.results[0], 'active'),
      usesLeft: count(invitations?.results[0], 'uses_left'),
      accountsLast7d: count(a, 'invited_week'),
    },
  };
}
