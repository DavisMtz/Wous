import { FRIENDS } from '@wous/config';

/**
 * Reglas de amistad (§20, ADR-0011) sin D1 ni reloj: reciben lo que se leyó
 * y deciden qué escribir. El caso de uso las aplica con sentencias
 * condicionadas a ese mismo estado, así que una carrera no escribe nada y se
 * vuelve a decidir con el estado nuevo.
 */

export type FriendshipStatus = 'PENDING' | 'ACCEPTED' | 'REMOVED';
export type EndedReason = 'REJECTED' | 'CANCELLED' | 'REMOVED' | 'BLOCKED';

export type FriendshipRow = {
  id: string;
  account_low: string;
  account_high: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  round: number;
  hidden: number;
  created_at: number;
  updated_at: number;
  accepted_at: number | null;
  ended_at: number | null;
  ended_reason: EndedReason | null;
};

/** El par en orden canónico: A→B y B→A son la misma fila. */
export function canonicalPair(a: string, b: string): { low: string; high: string } {
  return a < b ? { low: a, high: b } : { low: b, high: a };
}

/** Claves de deduplicación del correo: una por amistad y vuelta (ADR-0011). */
export const dedupeKeys = {
  request: (friendshipId: string, round: number) => `friend-request:${friendshipId}:${round}`,
  accepted: (friendshipId: string, round: number) => `friend-accepted:${friendshipId}:${round}`,
};

export type Counts = {
  /** Solicitudes tuyas sin contestar. */
  outgoingPending: number;
  actorFriends: number;
  targetFriends: number;
};

/** Qué tope se alcanzó: el tuyo de amistades, el de salientes o el de la otra persona. */
export type Limit = 'friends' | 'outgoing' | 'theirs';

export type RuleError =
  | { kind: 'error'; error: 'BLOCKED_BY_YOU' | 'NOT_FOUND' }
  | { kind: 'error'; error: 'LIMIT_REACHED'; limit: Limit }
  | { kind: 'error'; error: 'COOLDOWN'; retryAfterMs: number };

export type Relation = 'FRIENDS' | 'OUTGOING' | 'INCOMING' | 'NONE';

export type RequestDecision =
  | RuleError
  /** Ya estaba así: no se escribe nada ni sale otro correo. */
  | { kind: 'already'; relation: Relation }
  | { kind: 'create' }
  /** Vuelta nueva sobre una fila REMOVED. */
  | { kind: 'renew'; round: number }
  /** La otra persona ya te había pedido: la cruzada acepta. */
  | { kind: 'accept'; round: number };

export type RequestInput = {
  actor: string;
  row: FriendshipRow | null;
  /** Tú tienes bloqueada a la otra persona. */
  actorBlocksTarget: boolean;
  /** La otra persona te tiene bloqueado (no se te dice nunca). */
  targetBlocksActor: boolean;
  counts: Counts;
  now: number;
};

const limitReached = (limit: Limit) => ({ kind: 'error', error: 'LIMIT_REACHED', limit }) as const;

/** ¿Cabe una amistad más en las dos listas? */
function friendsLimit(counts: Counts): RuleError | null {
  if (counts.actorFriends >= FRIENDS.maxFriends) return limitReached('friends');
  if (counts.targetFriends >= FRIENDS.maxFriends) return limitReached('theirs');
  return null;
}

/**
 * SEND_FRIEND_REQUEST. Con un bloqueo de la otra persona las reglas son las
 * MISMAS (enfriamiento y topes incluidos): la diferencia la pone la sentencia
 * (`hidden`), y quien pide recibe la misma respuesta que con cualquiera.
 */
export function decideRequest(input: RequestInput): RequestDecision {
  const { row, counts } = input;
  if (input.actorBlocksTarget) return { kind: 'error', error: 'BLOCKED_BY_YOU' };
  if (row?.status === 'ACCEPTED') return { kind: 'already', relation: 'FRIENDS' };
  if (row?.status === 'PENDING') {
    if (row.requester_id === input.actor) return { kind: 'already', relation: 'OUTGOING' };
    // Te había pedido y luego te bloqueó: su bloqueo ya terminó esa solicitud,
    // así que esto no debería pasar. Si pasa, no se acepta nada.
    if (input.targetBlocksActor) return { kind: 'already', relation: 'NONE' };
    return friendsLimit(counts) ?? { kind: 'accept', round: row.round };
  }
  // Sin relación viva: solicitud nueva o una vuelta más.
  if (row && row.requester_id === input.actor && row.ended_at !== null) {
    const until = row.ended_at + FRIENDS.rerequestCooldownMs;
    if (input.now < until) {
      return { kind: 'error', error: 'COOLDOWN', retryAfterMs: until - input.now };
    }
  }
  if (counts.actorFriends >= FRIENDS.maxFriends) return limitReached('friends');
  if (counts.outgoingPending >= FRIENDS.maxOutgoingPending) return limitReached('outgoing');
  return row ? { kind: 'renew', round: row.round } : { kind: 'create' };
}

export type AcceptDecision =
  | RuleError
  | { kind: 'already'; relation: 'FRIENDS' }
  | { kind: 'accept'; round: number };

/** Aceptar: solo quien la recibió, visible y sin bloqueo de por medio. */
export function decideAccept(
  row: FriendshipRow | null,
  actor: string,
  blocked: boolean,
  counts: Counts,
): AcceptDecision {
  if (!row || !isParty(row, actor)) return { kind: 'error', error: 'NOT_FOUND' };
  if (row.status === 'ACCEPTED') return { kind: 'already', relation: 'FRIENDS' };
  if (row.status !== 'PENDING' || row.addressee_id !== actor || row.hidden === 1 || blocked) {
    return { kind: 'error', error: 'NOT_FOUND' };
  }
  return friendsLimit(counts) ?? { kind: 'accept', round: row.round };
}

export type EndDecision =
  | RuleError
  | { kind: 'already'; relation: 'NONE' }
  | { kind: 'end'; reason: EndedReason; from: 'PENDING' | 'ACCEPTED'; round: number };

/**
 * Rechazar (solo quien la recibió) o quitar (cualquiera de los dos: cancela
 * tu solicitud, rechaza la que te mandaron o termina la amistad). Una
 * solicitud en la sombra no existe para quien la recibe.
 */
export function decideEnd(
  row: FriendshipRow | null,
  actor: string,
  action: 'reject' | 'remove',
): EndDecision {
  if (!row || !isParty(row, actor)) return { kind: 'error', error: 'NOT_FOUND' };
  const invisible = row.status === 'PENDING' && row.addressee_id === actor && row.hidden === 1;
  if (invisible) return { kind: 'error', error: 'NOT_FOUND' };
  if (row.status === 'REMOVED') return { kind: 'already', relation: 'NONE' };
  if (action === 'reject') {
    if (row.status !== 'PENDING' || row.addressee_id !== actor) {
      return { kind: 'error', error: 'NOT_FOUND' };
    }
    return { kind: 'end', reason: 'REJECTED', from: 'PENDING', round: row.round };
  }
  if (row.status === 'ACCEPTED') {
    return { kind: 'end', reason: 'REMOVED', from: 'ACCEPTED', round: row.round };
  }
  const reason = row.requester_id === actor ? 'CANCELLED' : 'REJECTED';
  return { kind: 'end', reason, from: 'PENDING', round: row.round };
}

export function isParty(row: FriendshipRow, account: string): boolean {
  return row.requester_id === account || row.addressee_id === account;
}

/** Cómo ve la relación una de las dos personas. */
export function relationOf(row: FriendshipRow | null, viewer: string): Relation {
  if (!row || !isParty(row, viewer)) return 'NONE';
  if (row.status === 'ACCEPTED') return 'FRIENDS';
  if (row.status !== 'PENDING') return 'NONE';
  if (row.requester_id === viewer) return 'OUTGOING';
  return row.hidden === 1 ? 'NONE' : 'INCOMING';
}
