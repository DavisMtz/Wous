import { FRIENDS, TIME } from '@wous/config';
import { describe, expect, it } from 'vitest';
import {
  type Counts,
  canonicalPair,
  decideAccept,
  decideEnd,
  decideRequest,
  dedupeKeys,
  type FriendshipRow,
  relationOf,
} from '../src/friends/rules.ts';

const A = 'acc_01J8ZQ4Y7V3M2N6P8R0S1T2V3A';
const B = 'acc_01J8ZQ4Y7V3M2N6P8R0S1T2V3B';
const NOW = 1_790_000_000_000;
const FREE: Counts = { outgoingPending: 0, actorFriends: 0, targetFriends: 0 };

function row(patch: Partial<FriendshipRow>): FriendshipRow {
  return {
    id: 'frn_01J8ZQ4Y7V3M2N6P8R0S1T2V3W',
    account_low: A,
    account_high: B,
    requester_id: A,
    addressee_id: B,
    status: 'PENDING',
    round: 1,
    hidden: 0,
    created_at: NOW - TIME.HOUR,
    updated_at: NOW - TIME.HOUR,
    accepted_at: null,
    ended_at: null,
    ended_reason: null,
    ...patch,
  };
}

const request = (patch: Partial<Parameters<typeof decideRequest>[0]> = {}) =>
  decideRequest({
    actor: A,
    row: null,
    actorBlocksTarget: false,
    targetBlocksActor: false,
    counts: FREE,
    now: NOW,
    ...patch,
  });

describe('reglas de amistad (§20, ADR-0011)', () => {
  it('el par es el mismo sin importar quién pida', () => {
    expect(canonicalPair(A, B)).toEqual(canonicalPair(B, A));
    expect(canonicalPair(B, A)).toEqual({ low: A, high: B });
  });

  it('la clave de deduplicación cambia con la vuelta, no con el reintento', () => {
    expect(dedupeKeys.request('frn_x', 1)).toBe(dedupeKeys.request('frn_x', 1));
    expect(dedupeKeys.request('frn_x', 2)).not.toBe(dedupeKeys.request('frn_x', 1));
    expect(dedupeKeys.accepted('frn_x', 1)).not.toBe(dedupeKeys.request('frn_x', 1));
  });

  it('sin relación, pedir la crea', () => {
    expect(request()).toEqual({ kind: 'create' });
  });

  it('repetir la solicitud no escribe nada (ni otro correo)', () => {
    expect(request({ row: row({}) })).toEqual({ kind: 'already', relation: 'OUTGOING' });
    expect(request({ row: row({ status: 'ACCEPTED' }) })).toEqual({
      kind: 'already',
      relation: 'FRIENDS',
    });
  });

  it('si la otra persona ya había pedido, la cruzada acepta', () => {
    const suya = row({ requester_id: B, addressee_id: A, round: 3 });
    expect(request({ row: suya })).toEqual({ kind: 'accept', round: 3 });
  });

  it('con tu propio bloqueo se te dice; con el suyo, la respuesta es la de siempre', () => {
    expect(request({ actorBlocksTarget: true })).toEqual({
      kind: 'error',
      error: 'BLOCKED_BY_YOU',
    });
    expect(request({ targetBlocksActor: true })).toEqual({ kind: 'create' });
    expect(request({ targetBlocksActor: true, row: row({}) })).toEqual({
      kind: 'already',
      relation: 'OUTGOING',
    });
  });

  it('quien pidió la última vez espera el enfriamiento; la otra persona no', () => {
    const rechazada = row({
      status: 'REMOVED',
      ended_at: NOW - TIME.HOUR,
      ended_reason: 'REJECTED',
      round: 2,
    });
    expect(request({ row: rechazada })).toEqual({
      kind: 'error',
      error: 'COOLDOWN',
      retryAfterMs: FRIENDS.rerequestCooldownMs - TIME.HOUR,
    });
    // La misma regla aunque te tengan bloqueado: nada distingue un caso del otro.
    expect(request({ row: rechazada, targetBlocksActor: true })).toMatchObject({
      error: 'COOLDOWN',
    });
    expect(decideRequest({ ...baseFor(B), row: rechazada })).toEqual({ kind: 'renew', round: 2 });
    const vencida = { ...rechazada, ended_at: NOW - FRIENDS.rerequestCooldownMs };
    expect(request({ row: vencida })).toEqual({ kind: 'renew', round: 2 });
  });

  it('los topes: tus amistades, tus salientes y las de la otra persona al aceptar', () => {
    const full = FRIENDS.maxFriends;
    expect(request({ counts: { ...FREE, actorFriends: full } })).toMatchObject({
      limit: 'friends',
    });
    expect(
      request({ counts: { ...FREE, outgoingPending: FRIENDS.maxOutgoingPending } }),
    ).toMatchObject({ limit: 'outgoing' });
    const suya = row({ requester_id: B, addressee_id: A });
    expect(request({ row: suya, counts: { ...FREE, targetFriends: full } })).toMatchObject({
      limit: 'theirs',
    });
  });

  it('aceptar: solo quien la recibió, visible y sin bloqueo', () => {
    const pendiente = row({});
    expect(decideAccept(pendiente, B, false, FREE)).toEqual({ kind: 'accept', round: 1 });
    expect(decideAccept(pendiente, A, false, FREE)).toMatchObject({ error: 'NOT_FOUND' });
    expect(decideAccept(pendiente, B, true, FREE)).toMatchObject({ error: 'NOT_FOUND' });
    expect(decideAccept(row({ hidden: 1 }), B, false, FREE)).toMatchObject({
      error: 'NOT_FOUND',
    });
    expect(decideAccept(row({ status: 'ACCEPTED' }), B, false, FREE)).toEqual({
      kind: 'already',
      relation: 'FRIENDS',
    });
    expect(decideAccept(pendiente, 'acc_otra', false, FREE)).toMatchObject({
      error: 'NOT_FOUND',
    });
  });

  it('rechazar o quitar: cada quien lo suyo, y repetir no falla', () => {
    const pendiente = row({});
    expect(decideEnd(pendiente, B, 'reject')).toMatchObject({ kind: 'end', reason: 'REJECTED' });
    expect(decideEnd(pendiente, A, 'reject')).toMatchObject({ error: 'NOT_FOUND' });
    expect(decideEnd(pendiente, A, 'remove')).toMatchObject({ reason: 'CANCELLED' });
    expect(decideEnd(pendiente, B, 'remove')).toMatchObject({ reason: 'REJECTED' });
    expect(decideEnd(row({ status: 'ACCEPTED' }), B, 'remove')).toMatchObject({
      reason: 'REMOVED',
      from: 'ACCEPTED',
    });
    expect(decideEnd(row({ status: 'REMOVED' }), A, 'remove')).toEqual({
      kind: 'already',
      relation: 'NONE',
    });
    // Una solicitud en la sombra no existe para quien la recibe.
    expect(decideEnd(row({ hidden: 1 }), B, 'reject')).toMatchObject({ error: 'NOT_FOUND' });
    expect(decideEnd(row({ hidden: 1 }), A, 'remove')).toMatchObject({ reason: 'CANCELLED' });
  });

  it('cada quien ve la relación desde su lado; la sombra solo la ve quien pidió', () => {
    expect(relationOf(row({}), A)).toBe('OUTGOING');
    expect(relationOf(row({}), B)).toBe('INCOMING');
    expect(relationOf(row({ hidden: 1 }), B)).toBe('NONE');
    expect(relationOf(row({ hidden: 1 }), A)).toBe('OUTGOING');
    expect(relationOf(row({ status: 'ACCEPTED' }), B)).toBe('FRIENDS');
    expect(relationOf(row({ status: 'REMOVED' }), A)).toBe('NONE');
  });
});

function baseFor(actor: string) {
  return {
    actor,
    row: null,
    actorBlocksTarget: false,
    targetBlocksActor: false,
    counts: FREE,
    now: NOW,
  };
}
