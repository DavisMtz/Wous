import { FRIENDS } from '@wous/config';
import type {
  AppearanceInput,
  FriendActionResponse,
  FriendEntry,
  FriendListResponse,
  NotificationPreferences,
  UpdateNotificationPreferences,
} from '@wous/contracts';
import type { UseCaseContext } from '../auth/use-case.ts';
import { AppError, Errors } from '../http/errors.ts';
import { dispatchOutbox, prepareOutbox } from '../notifications/outbox.ts';
import {
  type Counts,
  canonicalPair,
  decideAccept,
  decideEnd,
  decideRequest,
  dedupeKeys,
  type FriendshipRow,
  isParty,
  type Limit,
  type RuleError,
} from './rules.ts';

/**
 * Casos de uso de amistad (§20, ADR-0011). Cada escritura va condicionada al
 * estado que se leyó (estado y vuelta): si otra petición cambió la fila en
 * medio, no se escribe nada y se vuelve a decidir con lo nuevo. El correo va
 * en el MISMO batch y solo se inserta si el cambio ocurrió.
 */

/** Alguien visto desde fuera: su personaje, nunca su cuenta. */
export type Person = {
  accountId: string;
  characterId: string;
  displayName: string;
  appearance: AppearanceInput;
  status: string;
};

const LIMIT_MESSAGE: Record<Limit, string> = {
  friends: `Llegaste al tope de ${FRIENDS.maxFriends} amistades.`,
  outgoing: `Tienes ${FRIENDS.maxOutgoingPending} solicitudes sin contestar. Espera respuesta o cancela alguna.`,
  theirs: 'Esa persona ya llegó al tope de amistades.',
};

export const FriendErrors = {
  self: () => new AppError('FORBIDDEN', 403, 'No puedes mandarte solicitud a ti.'),
  gone: () => new AppError('NOT_FOUND', 404, 'Esa solicitud ya no está.'),
};

function ruleError(e: RuleError): AppError {
  switch (e.error) {
    case 'BLOCKED_BY_YOU':
      return new AppError(
        'BLOCKED_BY_YOU',
        409,
        'Tienes bloqueada a esta persona. Desbloquéala primero.',
      );
    case 'LIMIT_REACHED':
      return new AppError('LIMIT_REACHED', 409, LIMIT_MESSAGE[e.limit]);
    case 'COOLDOWN': {
      const retryAfterSeconds = Math.max(1, Math.ceil(e.retryAfterMs / 1000));
      return new AppError(
        'FRIEND_REQUEST_COOLDOWN',
        409,
        'Tu última solicitud a esta persona terminó hace poco. Espera un poco para mandarle otra.',
        { retryAfterSeconds },
      );
    }
    case 'NOT_FOUND':
      return FriendErrors.gone();
  }
}

// ─── Lecturas ──────────────────────────────────────────────────────────────

type PersonRow = {
  character_id: string;
  account_id: string;
  display_name: string;
  status: string;
  body_id: string;
  skin_tone_id: string;
  hair_id: string;
  hair_color_id: string;
  top_id: string;
  bottom_id: string;
  shoes_id: string;
  accessory_id: string | null;
};

const PERSON_COLUMNS = `c.id AS character_id, c.account_id, c.display_name,
  ap.body_id, ap.skin_tone_id, ap.hair_id, ap.hair_color_id, ap.top_id, ap.bottom_id,
  ap.shoes_id, ap.accessory_id`;

function appearanceOf(row: Omit<PersonRow, 'status' | 'account_id'>): AppearanceInput {
  return {
    body: row.body_id,
    skinTone: row.skin_tone_id,
    hair: row.hair_id,
    hairColor: row.hair_color_id,
    top: row.top_id,
    bottom: row.bottom_id,
    shoes: row.shoes_id,
    accessory: row.accessory_id,
  } as AppearanceInput;
}

function toPerson(row: PersonRow): Person {
  return {
    accountId: row.account_id,
    characterId: row.character_id,
    displayName: row.display_name,
    appearance: appearanceOf(row),
    status: row.status,
  };
}

/** La persona detrás de un personaje (o null si no existe o la cuenta se borró). */
export async function findPerson(db: D1Database, characterId: string): Promise<Person | null> {
  const row = await db
    .prepare(
      `SELECT ${PERSON_COLUMNS}, a.status FROM characters c
         JOIN accounts a ON a.id = c.account_id
         JOIN character_appearance ap ON ap.character_id = c.id
        WHERE c.id = ?`,
    )
    .bind(characterId)
    .first<PersonRow>();
  if (!row || row.status === 'DELETED') return null;
  return toPerson(row);
}

async function personByAccount(db: D1Database, accountId: string): Promise<Person | null> {
  const row = await db
    .prepare(
      `SELECT ${PERSON_COLUMNS}, a.status FROM characters c
         JOIN accounts a ON a.id = c.account_id
         JOIN character_appearance ap ON ap.character_id = c.id
        WHERE c.account_id = ?`,
    )
    .bind(accountId)
    .first<PersonRow>();
  return row ? toPerson(row) : null;
}

/** Contar por separado cada lado usa su índice (un OR no siempre lo hace). */
const COUNTS_SQL = `SELECT
  (SELECT COUNT(*) FROM friendships WHERE requester_id = ?1 AND status = 'PENDING') AS outgoing,
  (SELECT COUNT(*) FROM friendships WHERE requester_id = ?1 AND status = 'ACCEPTED')
    + (SELECT COUNT(*) FROM friendships WHERE addressee_id = ?1 AND status = 'ACCEPTED')
    AS actor_friends,
  (SELECT COUNT(*) FROM friendships WHERE requester_id = ?2 AND status = 'ACCEPTED')
    + (SELECT COUNT(*) FROM friendships WHERE addressee_id = ?2 AND status = 'ACCEPTED')
    AS target_friends`;

type PairState = {
  row: FriendshipRow | null;
  actorBlocksTarget: boolean;
  targetBlocksActor: boolean;
  counts: Counts;
};

/** La fila del par, los bloqueos entre los dos y los topes, en una ida a D1. */
async function readPair(db: D1Database, actor: string, target: string): Promise<PairState> {
  const { low, high } = canonicalPair(actor, target);
  const [rows, blocks, counts] = await db.batch<Record<string, unknown>>([
    db
      .prepare('SELECT * FROM friendships WHERE account_low = ? AND account_high = ?')
      .bind(low, high),
    db
      .prepare(
        `SELECT blocker_account_id AS blocker FROM blocks
          WHERE (blocker_account_id = ?1 AND blocked_account_id = ?2)
             OR (blocker_account_id = ?2 AND blocked_account_id = ?1)`,
      )
      .bind(actor, target),
    db.prepare(COUNTS_SQL).bind(actor, target),
  ]);
  const blockers = new Set((blocks?.results ?? []).map((r) => String(r.blocker)));
  const c = counts?.results[0] ?? {};
  return {
    row: (rows?.results[0] as FriendshipRow | undefined) ?? null,
    actorBlocksTarget: blockers.has(actor),
    targetBlocksActor: blockers.has(target),
    counts: {
      outgoingPending: Number(c.outgoing ?? 0),
      actorFriends: Number(c.actor_friends ?? 0),
      targetFriends: Number(c.target_friends ?? 0),
    },
  };
}

async function rowById(db: D1Database, friendshipId: string): Promise<FriendshipRow | null> {
  return db
    .prepare('SELECT * FROM friendships WHERE id = ?')
    .bind(friendshipId)
    .first<FriendshipRow>();
}

// ─── Escrituras ────────────────────────────────────────────────────────────

/** El aviso de solicitud sale solo si quedó pendiente, visible y con el aviso encendido. */
function requestNotice(friendshipId: string, round: number, requester: string, addressee: string) {
  return {
    sql: `EXISTS (SELECT 1 FROM friendships WHERE id = ? AND round = ? AND status = 'PENDING'
                   AND hidden = 0 AND requester_id = ?)
          AND COALESCE((SELECT friend_request_email FROM notification_preferences
                         WHERE account_id = ?), 1) = 1`,
    bindings: [friendshipId, round, requester, addressee],
  };
}

function acceptedNotice(friendshipId: string, round: number, requester: string) {
  return {
    sql: `EXISTS (SELECT 1 FROM friendships WHERE id = ? AND round = ? AND status = 'ACCEPTED')
          AND COALESCE((SELECT friend_accepted_email FROM notification_preferences
                         WHERE account_id = ?), 1) = 1`,
    bindings: [friendshipId, round, requester],
  };
}

/** Hay un bloqueo, en cualquier dirección, entre las dos personas de la fila `t`. */
function blockInRow(t: string): string {
  return `EXISTS (SELECT 1 FROM blocks
    WHERE (blocker_account_id = ${t}.requester_id AND blocked_account_id = ${t}.addressee_id)
       OR (blocker_account_id = ${t}.addressee_id AND blocked_account_id = ${t}.requester_id))`;
}

type Written = { changed: boolean; outboxId: string | null };

/** Corre el cambio y su aviso en un batch; dice si cambió la fila y si se guardó el aviso. */
async function writeWithNotice(
  db: D1Database,
  change: D1PreparedStatement,
  notice: { id: string; statement: D1PreparedStatement } | null,
): Promise<Written> {
  const results = await db.batch(notice ? [change, notice.statement] : [change]);
  const changed = (results[0]?.meta.changes ?? 0) > 0;
  const noticed = notice !== null && (results[1]?.meta.changes ?? 0) > 0;
  return { changed, outboxId: noticed && notice ? notice.id : null };
}

function entryFor(friendshipId: string, other: Person, since: number): FriendEntry {
  return {
    friendshipId,
    characterId: other.characterId,
    displayName: other.displayName,
    appearance: other.appearance,
    since,
  };
}

/** Si otra petición cambió la fila en medio, se vuelve a leer y a decidir. */
const MAX_TRIES = 3;

/**
 * SEND_FRIEND_REQUEST (§20). Idempotente: repetirla no escribe ni avisa otra
 * vez. Si la otra persona ya te había pedido, queda aceptada. Si te tiene
 * bloqueado, la respuesta es la misma que con cualquiera (ADR-0011).
 */
export async function requestFriendship(
  ctx: UseCaseContext,
  actor: Person,
  target: Person,
): Promise<FriendActionResponse> {
  const { env, deps, log } = ctx;
  const db = env.DB;
  if (actor.accountId === target.accountId) throw FriendErrors.self();

  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const state = await readPair(db, actor.accountId, target.accountId);
    const now = deps.clock.now();
    const decision = decideRequest({
      actor: actor.accountId,
      row: state.row,
      actorBlocksTarget: state.actorBlocksTarget,
      targetBlocksActor: state.targetBlocksActor,
      counts: state.counts,
      now,
    });
    const row = state.row;

    switch (decision.kind) {
      case 'error':
        throw ruleError(decision);
      case 'already': {
        if (decision.relation === 'NONE' || !row) return { relation: 'NONE', entry: null };
        const since =
          decision.relation === 'FRIENDS' ? (row.accepted_at ?? row.created_at) : row.created_at;
        return { relation: decision.relation, entry: entryFor(row.id, target, since) };
      }
      case 'create': {
        const { low, high } = canonicalPair(actor.accountId, target.accountId);
        const id = deps.ids.next('friendship');
        const insert = db
          .prepare(
            `INSERT INTO friendships (id, account_low, account_high, requester_id, addressee_id,
               status, round, hidden, created_at, updated_at)
             SELECT ?1, ?2, ?3, ?4, ?5, 'PENDING', 1,
                    EXISTS (SELECT 1 FROM blocks
                             WHERE blocker_account_id = ?5 AND blocked_account_id = ?4),
                    ?6, ?6
              WHERE NOT EXISTS (SELECT 1 FROM blocks
                                 WHERE blocker_account_id = ?4 AND blocked_account_id = ?5)
             ON CONFLICT (account_low, account_high) DO NOTHING`,
          )
          .bind(id, low, high, actor.accountId, target.accountId, now);
        const notice = await requestOutbox(ctx, id, 1, actor, target);
        const written = await writeWithNotice(db, insert, notice);
        if (!written.changed) continue;
        return sent(ctx, written, 'friends.requested', id, target, now, state.targetBlocksActor);
      }
      case 'renew': {
        const round = decision.round + 1;
        const renew = db
          .prepare(
            `UPDATE friendships
                SET requester_id = ?1, addressee_id = ?2, status = 'PENDING', round = round + 1,
                    hidden = EXISTS (SELECT 1 FROM blocks
                                      WHERE blocker_account_id = ?2 AND blocked_account_id = ?1),
                    created_at = ?3, updated_at = ?3, accepted_at = NULL, ended_at = NULL,
                    ended_reason = NULL
              WHERE id = ?4 AND status = 'REMOVED' AND round = ?5
                AND NOT EXISTS (SELECT 1 FROM blocks
                                 WHERE blocker_account_id = ?1 AND blocked_account_id = ?2)`,
          )
          .bind(actor.accountId, target.accountId, now, (row as FriendshipRow).id, decision.round);
        const id = (row as FriendshipRow).id;
        const notice = await requestOutbox(ctx, id, round, actor, target);
        const written = await writeWithNotice(db, renew, notice);
        if (!written.changed) continue;
        return sent(ctx, written, 'friends.requested', id, target, now, state.targetBlocksActor);
      }
      case 'accept': {
        // La cruzada: aceptas la solicitud que la otra persona ya te había mandado.
        const accepted = await accept(ctx, row as FriendshipRow, decision.round, actor, target);
        if (!accepted) continue;
        return accepted;
      }
    }
  }
  log.error('friends.request_contended', { accountId: actor.accountId });
  throw Errors.unavailable();
}

async function requestOutbox(
  ctx: UseCaseContext,
  friendshipId: string,
  round: number,
  actor: Person,
  target: Person,
) {
  return prepareOutbox(ctx.env, ctx.deps, {
    accountId: target.accountId,
    type: 'FRIEND_REQUEST',
    dedupeKey: dedupeKeys.request(friendshipId, round),
    payload: {
      displayName: target.displayName,
      actorDisplayName: actor.displayName,
      friendshipId,
      round,
    },
    onlyIf: requestNotice(friendshipId, round, actor.accountId, target.accountId),
  });
}

/** Tras pedir: encola el aviso (si se guardó) y responde lo mismo haya bloqueo o no. */
function sent(
  ctx: UseCaseContext,
  written: Written,
  event: string,
  friendshipId: string,
  target: Person,
  now: number,
  hidden: boolean,
): FriendActionResponse {
  if (written.outboxId) {
    ctx.waitUntil(dispatchOutbox(ctx.env, ctx.deps.clock, ctx.log, [written.outboxId]));
  }
  // `hidden` solo va al log del servidor: ni la respuesta ni la lista lo delatan.
  ctx.log.info(event, { friendshipId, hidden, noticed: written.outboxId !== null });
  return { relation: 'OUTGOING', entry: entryFor(friendshipId, target, now) };
}

/**
 * Deja la fila ACCEPTED (si sigue pendiente en esa vuelta, dirigida a quien
 * acepta y sin bloqueo) y avisa a quien pidió. null = otra petición la cambió.
 */
async function accept(
  ctx: UseCaseContext,
  row: FriendshipRow,
  round: number,
  actor: Person,
  requester: Person,
): Promise<FriendActionResponse | null> {
  const { env, deps } = ctx;
  const now = deps.clock.now();
  const change = env.DB.prepare(
    `UPDATE friendships SET status = 'ACCEPTED', accepted_at = ?1, updated_at = ?1
      WHERE id = ?2 AND status = 'PENDING' AND round = ?3 AND addressee_id = ?4
        AND NOT ${blockInRow('friendships')}`,
  ).bind(now, row.id, round, actor.accountId);
  const notice = await prepareOutbox(env, deps, {
    accountId: requester.accountId,
    type: 'FRIEND_ACCEPTED',
    dedupeKey: dedupeKeys.accepted(row.id, round),
    payload: {
      displayName: requester.displayName,
      actorDisplayName: actor.displayName,
      friendshipId: row.id,
      round,
    },
    onlyIf: acceptedNotice(row.id, round, requester.accountId),
  });
  const written = await writeWithNotice(env.DB, change, notice);
  if (!written.changed) return null;
  if (written.outboxId) {
    ctx.waitUntil(dispatchOutbox(env, deps.clock, ctx.log, [written.outboxId]));
  }
  ctx.log.info('friends.accepted', { friendshipId: row.id, noticed: written.outboxId !== null });
  return { relation: 'FRIENDS', entry: entryFor(row.id, requester, now) };
}

/** ACCEPT_FRIEND_REQUEST. Aceptar dos veces responde lo mismo y no avisa otra vez. */
export async function acceptFriendship(
  ctx: UseCaseContext,
  actor: Person,
  friendshipId: string,
): Promise<FriendActionResponse> {
  const db = ctx.env.DB;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const found = await rowById(db, friendshipId);
    if (!found || !isParty(found, actor.accountId)) throw FriendErrors.gone();
    const otherAccount =
      found.requester_id === actor.accountId ? found.addressee_id : found.requester_id;
    const other = await personByAccount(db, otherAccount);
    if (!other) throw FriendErrors.gone();
    // El mismo par, ahora con sus bloqueos y topes.
    const state = await readPair(db, actor.accountId, other.accountId);
    const blocked = state.actorBlocksTarget || state.targetBlocksActor;
    const decision = decideAccept(state.row, actor.accountId, blocked, state.counts);
    if (decision.kind === 'error') throw ruleError(decision);
    const current = state.row as FriendshipRow;
    if (decision.kind === 'already') {
      return {
        relation: 'FRIENDS',
        entry: entryFor(current.id, other, current.accepted_at ?? current.created_at),
      };
    }
    const accepted = await accept(ctx, current, decision.round, actor, other);
    if (accepted) return accepted;
  }
  throw Errors.unavailable();
}

/**
 * REJECT o REMOVE: rechazar lo que te mandaron, cancelar lo que mandaste o
 * terminar una amistad. No se avisa a nadie. Repetirlo responde lo mismo.
 */
export async function endFriendship(
  ctx: UseCaseContext,
  actor: Person,
  friendshipId: string,
  action: 'reject' | 'remove',
): Promise<FriendActionResponse> {
  const { env, deps, log } = ctx;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const row = await rowById(env.DB, friendshipId);
    const decision = decideEnd(row, actor.accountId, action);
    if (decision.kind === 'error') throw ruleError(decision);
    if (decision.kind === 'already') return { relation: 'NONE', entry: null };
    const now = deps.clock.now();
    const result = await env.DB.prepare(
      `UPDATE friendships SET status = 'REMOVED', ended_at = ?1, ended_reason = ?2, updated_at = ?1
        WHERE id = ?3 AND status = ?4 AND round = ?5`,
    )
      .bind(now, decision.reason, friendshipId, decision.from, decision.round)
      .run();
    if (result.meta.changes !== 1) continue;
    log.info('friends.ended', { friendshipId, reason: decision.reason });
    return { relation: 'NONE', entry: null };
  }
  throw Errors.unavailable();
}

// ─── Listas ────────────────────────────────────────────────────────────────

type ListRow = Omit<PersonRow, 'status' | 'account_id'> & {
  id: string;
  status: 'PENDING' | 'ACCEPTED';
  mine: number;
  created_at: number;
  accepted_at: number | null;
};

/**
 * Amigos, entrantes y salientes de una persona. Dos consultas por índice
 * (lo que pediste y lo que te pidieron) en vez de un OR. Las entrantes
 * vuelven a filtrar por bloqueos y nunca incluyen las que están en la sombra;
 * las salientes sí: quien pidió ve la suya pendiente (ADR-0011).
 */
export async function listFriends(db: D1Database, me: string): Promise<FriendListResponse> {
  const { results } = await db
    .prepare(
      `SELECT f.id, f.status, 1 AS mine, f.created_at, f.accepted_at, ${PERSON_COLUMNS}
         FROM friendships f
         JOIN characters c ON c.account_id = f.addressee_id
         JOIN character_appearance ap ON ap.character_id = c.id
        WHERE f.requester_id = ?1 AND f.status IN ('PENDING', 'ACCEPTED')
       UNION ALL
       SELECT f.id, f.status, 0 AS mine, f.created_at, f.accepted_at, ${PERSON_COLUMNS}
         FROM friendships f
         JOIN characters c ON c.account_id = f.requester_id
         JOIN character_appearance ap ON ap.character_id = c.id
        WHERE f.addressee_id = ?1 AND f.status IN ('PENDING', 'ACCEPTED')
          AND NOT (f.status = 'PENDING' AND (f.hidden = 1 OR ${blockInRow('f')}))`,
    )
    .bind(me)
    .all<ListRow>();

  const out: FriendListResponse = { friends: [], incoming: [], outgoing: [] };
  for (const row of results) {
    const entry: FriendEntry = {
      friendshipId: row.id,
      characterId: row.character_id,
      displayName: row.display_name,
      appearance: appearanceOf(row),
      since: row.status === 'ACCEPTED' ? (row.accepted_at ?? row.created_at) : row.created_at,
    };
    if (row.status === 'ACCEPTED') out.friends.push(entry);
    else if (row.mine === 1) out.outgoing.push(entry);
    else out.incoming.push(entry);
  }
  const newest = (a: FriendEntry, b: FriendEntry) => b.since - a.since;
  out.friends.sort(newest);
  out.incoming.sort(newest);
  out.outgoing.sort(newest);
  return out;
}

// ─── Avisos por correo ─────────────────────────────────────────────────────

type PreferenceRow = { friend_request_email: number; friend_accepted_email: number };

function toPreferences(row: PreferenceRow | null): NotificationPreferences {
  return {
    friendRequestEmail: row?.friend_request_email !== 0,
    friendAcceptedEmail: row?.friend_accepted_email !== 0,
  };
}

/** Los avisos sociales de la cuenta (encendidos si nunca se tocaron). */
export async function getPreferences(
  db: D1Database,
  accountId: string,
): Promise<NotificationPreferences> {
  const row = await db
    .prepare(
      `SELECT friend_request_email, friend_accepted_email FROM notification_preferences
        WHERE account_id = ?`,
    )
    .bind(accountId)
    .first<PreferenceRow>();
  return toPreferences(row);
}

/** Cambia solo lo que viene; lo demás queda como estaba. */
export async function updatePreferences(
  db: D1Database,
  accountId: string,
  patch: UpdateNotificationPreferences,
  now: number,
): Promise<NotificationPreferences> {
  const bit = (v: boolean | undefined) => (v === undefined ? null : v ? 1 : 0);
  const row = await db
    .prepare(
      `INSERT INTO notification_preferences (account_id, friend_request_email,
         friend_accepted_email, updated_at)
       VALUES (?1, COALESCE(?2, 1), COALESCE(?3, 1), ?4)
       ON CONFLICT (account_id) DO UPDATE SET
         friend_request_email = COALESCE(?2, friend_request_email),
         friend_accepted_email = COALESCE(?3, friend_accepted_email),
         updated_at = ?4
       RETURNING friend_request_email, friend_accepted_email`,
    )
    .bind(accountId, bit(patch.friendRequestEmail), bit(patch.friendAcceptedEmail), now)
    .first<PreferenceRow>();
  return toPreferences(row);
}
