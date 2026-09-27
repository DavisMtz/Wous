import { env } from 'cloudflare:workers';
import { EMAIL, FRIENDS, RATE_LIMITS, TIME } from '@wous/config';
import type {
  ErrorEnvelope,
  FriendActionResponse,
  FriendListResponse,
  NotificationPreferences,
} from '@wous/contracts';
import { describe, expect, it } from 'vitest';
import { call, postJson } from './helpers.ts';
import {
  createVerifiedUser,
  deliver,
  freshIp,
  type OutboxRow,
  outboxOf,
  TURNSTILE_OK,
  withIp,
} from './support.ts';
import { connect, playerWithCharacter, sleep, type TestSocket } from './world-support.ts';

/** Varias cuentas con Argon2 real: en un equipo cargado tarda más que el tope de 5 s. */
const PESADA = 60_000;

type Player = Awaited<ReturnType<typeof playerWithCharacter>>;

const as = (p: Player | { cookie: string }) => ({ headers: { Cookie: p.cookie } });

async function data<T>(res: Response): Promise<T> {
  const body = (await res.json()) as { data?: T; error?: unknown };
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(body)}`);
  return body.data as T;
}

async function codeOf(res: Response) {
  return ((await res.json()) as ErrorEnvelope).error;
}

const ask = (from: Player, to: Player) =>
  postJson('/api/v1/friends/request', { characterId: to.characterId }, as(from));
const act = (who: Player, friendshipId: string, action: 'accept' | 'reject' | 'remove') =>
  postJson(`/api/v1/friends/${friendshipId}/${action}`, {}, as(who));
const listOf = async (who: Player) =>
  data<FriendListResponse>(await call('/api/v1/friends', as(who)));
const block = (who: Player, target: Player) =>
  postJson(`/api/v1/users/${target.characterId}/block`, {}, as(who));
const unblock = (who: Player, target: Player) =>
  call(`/api/v1/blocks/${target.characterId}`, { ...as(who), method: 'DELETE' });

async function friendshipRows(a: Player, b: Player) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM friendships WHERE (requester_id = ?1 AND addressee_id = ?2)
        OR (requester_id = ?2 AND addressee_id = ?1)`,
  )
    .bind(a.accountId, b.accountId)
    .all<{ id: string; status: string; round: number; hidden: number; ended_reason: string }>();
  return results;
}

/** Como si la vuelta hubiera terminado hace más del enfriamiento. */
async function ageEnd(friendshipId: string) {
  await env.DB.prepare('UPDATE friendships SET ended_at = ? WHERE id = ?')
    .bind(Date.now() - FRIENDS.rerequestCooldownMs - TIME.MINUTE, friendshipId)
    .run();
}

async function pair(nameA: string, nameB: string) {
  return Promise.all([playerWithCharacter(nameA), playerWithCharacter(nameB)]);
}

/** Los dos en la MISMA instancia de la plaza (si no, lo que se prueba no significa nada). */
async function enterTogether(a: Player, b: Player) {
  const sa = (await connect(a.cookie)).socket;
  if (!sa) throw new Error('no entró');
  await sa.next('ROOM_SNAPSHOT');
  const sb = (await connect(b.cookie)).socket;
  if (!sb) throw new Error('no entró');
  const snapshot = await sb.next('ROOM_SNAPSHOT');
  expect(snapshot.payload.players.map((p) => p.id)).toContain(a.characterId);
  return { sa, sb };
}

async function leave(...sockets: TestSocket[]) {
  for (const s of sockets) s.close();
  await Promise.all(sockets.map((s) => s.closed));
}

describe('amistades (§20, ADR-0011)', () => {
  it(
    'pedir crea UNA relación y UN aviso aunque se repita o se mande a la vez',
    async () => {
      const [ana, beto] = await pair('Ana Amiga', 'Beto Amigo');
      const answers = await Promise.all([ask(ana, beto), ask(ana, beto), ask(ana, beto)]);
      const bodies = await Promise.all(answers.map((r) => data<FriendActionResponse>(r)));
      const ids = new Set(bodies.map((b) => b.entry?.friendshipId));
      expect(bodies.every((b) => b.relation === 'OUTGOING')).toBe(true);
      expect(ids.size).toBe(1);
      expect(bodies[0]?.entry).toMatchObject({
        characterId: beto.characterId,
        displayName: 'Beto Amigo',
      });

      // Y otra vez, ya en calma.
      expect((await data<FriendActionResponse>(await ask(ana, beto))).relation).toBe('OUTGOING');
      expect(await friendshipRows(ana, beto)).toHaveLength(1);
      const notices = await outboxOf(beto.accountId, 'FRIEND_REQUEST');
      expect(notices).toHaveLength(1);
      const payload = JSON.parse(notices[0]?.payload_json ?? '{}');
      expect(payload).toMatchObject({ displayName: 'Beto Amigo', actorDisplayName: 'Ana Amiga' });

      // Cada quien la ve de su lado.
      const deAna = await listOf(ana);
      const deBeto = await listOf(beto);
      expect(deAna.outgoing.map((e) => e.characterId)).toEqual([beto.characterId]);
      expect(deAna.incoming).toEqual([]);
      expect(deBeto.incoming.map((e) => e.characterId)).toEqual([ana.characterId]);
      expect(deBeto.incoming[0]?.appearance.body).toBe('a');

      // El correo sale con su enlace a la lista de amigos.
      const { outcome, email } = await deliver(notices[0]?.id ?? '');
      expect(outcome.kind).toBe('sent');
      expect(email?.params).toMatchObject({
        displayName: 'Beto Amigo',
        actorDisplayName: 'Ana Amiga',
        friendsUrl: 'http://localhost:5173/friends',
      });
    },
    PESADA,
  );

  it(
    'la solicitud cruzada acepta y avisa una sola vez a quien pidió primero',
    async () => {
      const [ana, beto] = await pair('Ana Cruce', 'Beto Cruce');
      await data(await ask(ana, beto));
      const cruce = await Promise.all([ask(beto, ana), ask(beto, ana)]);
      for (const res of cruce) {
        expect((await data<FriendActionResponse>(res)).relation).toBe('FRIENDS');
      }
      expect(await outboxOf(ana.accountId, 'FRIEND_ACCEPTED')).toHaveLength(1);
      expect(await outboxOf(ana.accountId, 'FRIEND_REQUEST')).toHaveLength(0);
      const rows = await friendshipRows(ana, beto);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe('ACCEPTED');
      expect((await listOf(ana)).friends.map((e) => e.characterId)).toEqual([beto.characterId]);
      expect((await listOf(beto)).friends.map((e) => e.characterId)).toEqual([ana.characterId]);
    },
    PESADA,
  );

  it(
    'aceptar dos veces responde lo mismo y avisa una vez; solo acepta quien la recibió',
    async () => {
      const [ana, beto] = await pair('Ana Acepta', 'Beto Acepta');
      const { entry } = await data<FriendActionResponse>(await ask(ana, beto));
      const id = entry?.friendshipId ?? '';
      expect((await codeOf(await act(ana, id, 'accept'))).code).toBe('NOT_FOUND');
      const twice = await Promise.all([act(beto, id, 'accept'), act(beto, id, 'accept')]);
      for (const res of twice) {
        expect((await data<FriendActionResponse>(res)).relation).toBe('FRIENDS');
      }
      const notices = await outboxOf(ana.accountId, 'FRIEND_ACCEPTED');
      expect(notices).toHaveLength(1);
      const { email } = await deliver(notices[0]?.id ?? '');
      expect(email?.params).toMatchObject({
        displayName: 'Ana Acepta',
        actorDisplayName: 'Beto Acepta',
      });
    },
    PESADA,
  );

  it(
    'rechazar no avisa y enfría a quien pidió, no a quien rechazó',
    async () => {
      const [ana, beto] = await pair('Ana Rechazo', 'Beto Rechazo');
      const { entry } = await data<FriendActionResponse>(await ask(ana, beto));
      const id = entry?.friendshipId ?? '';
      expect((await data<FriendActionResponse>(await act(beto, id, 'reject'))).relation).toBe(
        'NONE',
      );
      // Repetirlo no falla.
      expect((await data<FriendActionResponse>(await act(beto, id, 'reject'))).relation).toBe(
        'NONE',
      );
      expect((await listOf(ana)).outgoing).toEqual([]);
      expect((await listOf(beto)).incoming).toEqual([]);

      const otraVez = await ask(ana, beto);
      expect(otraVez.status).toBe(409);
      const error = await codeOf(otraVez);
      expect(error.code).toBe('FRIEND_REQUEST_COOLDOWN');
      expect(error.retryAfterSeconds).toBeGreaterThan(FRIENDS.rerequestCooldownMs / 1000 - 60);

      // Quien rechazó puede cambiar de opinión: vuelta 2, con su aviso.
      expect((await data<FriendActionResponse>(await ask(beto, ana))).relation).toBe('OUTGOING');
      const [row] = await friendshipRows(ana, beto);
      expect(row?.round).toBe(2);
      const notices = await outboxOf(ana.accountId, 'FRIEND_REQUEST');
      expect(notices.map((n) => n.dedupe_key)).toEqual([`friend-request:${id}:2`]);
    },
    PESADA,
  );

  it(
    'cancelar la propia: la otra persona deja de verla y, tras el enfriamiento, otra vuelta avisa',
    async () => {
      const [ana, beto] = await pair('Ana Cancela', 'Beto Cancela');
      const { entry } = await data<FriendActionResponse>(await ask(ana, beto));
      const id = entry?.friendshipId ?? '';
      await data(await act(ana, id, 'remove'));
      expect((await listOf(beto)).incoming).toEqual([]);

      // El aviso que esperaba en la cola ya no sale.
      const [first] = await outboxOf(beto.accountId, 'FRIEND_REQUEST');
      const stale = await deliver(first?.id ?? '');
      expect(stale.outcome).toEqual({ kind: 'failed', reason: 'la amistad ya cambió' });

      await ageEnd(id);
      expect((await data<FriendActionResponse>(await ask(ana, beto))).entry?.friendshipId).toBe(id);
      const notices = await outboxOf(beto.accountId, 'FRIEND_REQUEST');
      expect(notices.map((n) => n.dedupe_key)).toEqual([
        `friend-request:${id}:1`,
        `friend-request:${id}:2`,
      ]);
      expect((await deliver(notices[1]?.id ?? '')).outcome.kind).toBe('sent');
    },
    PESADA,
  );

  it(
    'quitar una amistad la saca de las dos listas',
    async () => {
      const [ana, beto] = await pair('Ana Quita', 'Beto Quita');
      await data(await ask(ana, beto));
      const { entry } = await data<FriendActionResponse>(await ask(beto, ana));
      await data(await act(beto, entry?.friendshipId ?? '', 'remove'));
      expect((await listOf(ana)).friends).toEqual([]);
      expect((await listOf(beto)).friends).toEqual([]);
      const [row] = await friendshipRows(ana, beto);
      expect(row).toMatchObject({ status: 'REMOVED', ended_reason: 'REMOVED' });
    },
    PESADA,
  );

  it(
    'bloquear desde la lista termina la amistad; con tu bloqueo, pedir te lo dice',
    async () => {
      const [ana, beto] = await pair('Ana Bloquea', 'Beto Bloqueado');
      await data(await ask(ana, beto));
      await data(await ask(beto, ana));
      expect((await block(ana, beto)).status).toBe(200);
      // Repetirlo no falla.
      expect((await block(ana, beto)).status).toBe(200);
      const [row] = await friendshipRows(ana, beto);
      expect(row).toMatchObject({ status: 'REMOVED', ended_reason: 'BLOCKED' });
      expect((await listOf(ana)).friends).toEqual([]);
      expect((await listOf(beto)).friends).toEqual([]);

      const res = await ask(ana, beto);
      expect(res.status).toBe(409);
      expect((await codeOf(res)).code).toBe('BLOCKED_BY_YOU');
    },
    PESADA,
  );

  it(
    'pedirle a quien te bloqueó se ve enviada, pero no le llega ni le avisa (ADR-0011)',
    async () => {
      const [ana, beto] = await pair('Ana Sombra', 'Beto Sombra');
      await data(await block(beto, ana));

      const res = await ask(ana, beto);
      const body = await data<FriendActionResponse>(res);
      expect(body.relation).toBe('OUTGOING');
      const id = body.entry?.friendshipId ?? '';
      // Repetirla responde igual que con cualquiera.
      expect((await data<FriendActionResponse>(await ask(ana, beto))).relation).toBe('OUTGOING');
      expect((await listOf(ana)).outgoing.map((e) => e.friendshipId)).toEqual([id]);
      expect((await listOf(beto)).incoming).toEqual([]);
      expect(await outboxOf(beto.accountId, 'FRIEND_REQUEST')).toHaveLength(0);
      expect((await codeOf(await act(beto, id, 'accept'))).code).toBe('NOT_FOUND');
      expect((await codeOf(await act(beto, id, 'reject'))).code).toBe('NOT_FOUND');

      // Desbloquear no la saca de la sombra.
      expect((await unblock(beto, ana)).status).toBe(200);
      expect((await listOf(beto)).incoming).toEqual([]);

      // Si ahora es Beto quien pide, la cruzada acepta la de Ana: los dos lo quieren.
      expect((await data<FriendActionResponse>(await ask(beto, ana))).relation).toBe('FRIENDS');
      expect(await outboxOf(ana.accountId, 'FRIEND_ACCEPTED')).toHaveLength(1);
      expect((await listOf(beto)).friends.map((e) => e.characterId)).toEqual([ana.characterId]);
    },
    PESADA,
  );

  it(
    'bloquear en la sala también termina la amistad (el bloqueo gana)',
    async () => {
      const [ana, beto] = await pair('Ana Sala', 'Beto Sala');
      await data(await ask(ana, beto));
      await data(await ask(beto, ana));
      const { sa, sb } = await enterTogether(ana, beto);
      sa.send({ v: 1, type: 'BLOCK_PLAYER', payload: { characterId: beto.characterId } });
      await sa.next('PLAYER_BLOCKED');
      const [row] = await friendshipRows(ana, beto);
      expect(row).toMatchObject({ status: 'REMOVED', ended_reason: 'BLOCKED' });
      await leave(sa, sb);
    },
    PESADA,
  );

  it(
    'bloquear por HTTP con la plaza abierta aplica en la sala en el acto',
    async () => {
      const [ana, beto] = await pair('Ana Pestaña', 'Beto Pestaña');
      const { sa, sb } = await enterTogether(ana, beto);

      // Antes del bloqueo, se oyen.
      sb.send({ v: 1, type: 'CHAT_SEND', payload: { text: '¿me oyes?' } });
      await sa.next('CHAT_MESSAGE');

      expect((await block(ana, beto)).status).toBe(200);
      const aviso = await sa.next('PLAYER_BLOCKED');
      expect(aviso.payload).toEqual({ characterId: beto.characterId, blocked: true });

      sb.send({ v: 1, type: 'CHAT_SEND', payload: { text: 'ya no me oyes' } });
      const eco = await sb.next('CHAT_MESSAGE', (m) => m.payload.message.text === 'ya no me oyes');
      await sleep(150);
      expect(
        sa.received.some(
          (m) => m.type === 'CHAT_MESSAGE' && m.payload.message.id === eco.payload.message.id,
        ),
      ).toBe(false);
      await leave(sa, sb);
    },
    PESADA,
  );

  it(
    'sin personaje no hay amistades; a ti no te puedes pedir',
    async () => {
      const sinPersonaje = await createVerifiedUser();
      const res = await call('/api/v1/friends', { headers: { Cookie: sinPersonaje.cookie } });
      expect(res.status).toBe(403);
      expect((await codeOf(res)).code).toBe('CHARACTER_REQUIRED');

      const ana = await playerWithCharacter('Ana Sola');
      const self = await ask(ana, ana);
      expect(self.status).toBe(403);
      const nadie = await postJson(
        '/api/v1/friends/request',
        { characterId: 'chr_01J8ZQ4Y7V3M2N6P8R0S1T2V3W' },
        as(ana),
      );
      expect(nadie.status).toBe(404);
      const colado = await postJson(
        '/api/v1/friends/request',
        { characterId: ana.characterId, accountId: 'acc_x' },
        as(ana),
      );
      expect(colado.status).toBe(400);
    },
    PESADA,
  );

  it(
    'las solicitudes tienen tope por hora para cada cuenta',
    async () => {
      const [ana, beto] = await pair('Ana Prisa', 'Beto Prisa');
      for (let i = 0; i < RATE_LIMITS.friendRequestsPerAccount.limit; i++) {
        expect((await ask(ana, beto)).status).toBe(200);
      }
      const res = await ask(ana, beto);
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).not.toBeNull();
      expect(await outboxOf(beto.accountId, 'FRIEND_REQUEST')).toHaveLength(1);
    },
    PESADA,
  );
});

describe('avisos por correo (§7, DoD de la Fase 8)', () => {
  const prefsOf = async (p: Player) =>
    data<NotificationPreferences>(await call('/api/v1/preferences', as(p)));
  const setPrefs = (p: Player, body: unknown) => postJson('/api/v1/preferences', body, as(p));

  it(
    'vienen encendidos, se cambian por partes y no aceptan campos de más',
    async () => {
      const ana = await playerWithCharacter('Ana Avisos');
      expect(await prefsOf(ana)).toEqual({ friendRequestEmail: true, friendAcceptedEmail: true });
      expect(await data(await setPrefs(ana, { friendAcceptedEmail: false }))).toEqual({
        friendRequestEmail: true,
        friendAcceptedEmail: false,
      });
      expect(await prefsOf(ana)).toEqual({ friendRequestEmail: true, friendAcceptedEmail: false });
      expect((await setPrefs(ana, {})).status).toBe(400);
      expect((await setPrefs(ana, { marketingEmail: true })).status).toBe(400);
    },
    PESADA,
  );

  it(
    'apagado impide el correo social pero no los de seguridad',
    async () => {
      const [ana, beto] = await pair('Ana Apaga', 'Beto Apaga');
      await data(await setPrefs(beto, { friendRequestEmail: false }));
      await data(await ask(ana, beto));
      expect(await outboxOf(beto.accountId, 'FRIEND_REQUEST')).toHaveLength(0);
      expect((await listOf(beto)).incoming).toHaveLength(1);

      // Con los avisos apagados, recuperar la contraseña sale igual.
      const forgot = await postJson(
        '/api/v1/auth/forgot-password',
        { email: beto.email, turnstileToken: TURNSTILE_OK },
        withIp(freshIp()),
      );
      expect(forgot.status).toBe(202);
      const [reset] = await outboxOf(beto.accountId, 'PASSWORD_RESET');
      expect((await deliver(reset?.id ?? '')).outcome.kind).toBe('sent');

      // Encendido al pedir y apagado antes de salir: tampoco sale.
      await data(await setPrefs(ana, { friendAcceptedEmail: false }));
      const incoming = (await listOf(beto)).incoming[0];
      await data(await act(beto, incoming?.friendshipId ?? '', 'accept'));
      expect(await outboxOf(ana.accountId, 'FRIEND_ACCEPTED')).toHaveLength(0);
    },
    PESADA,
  );

  it(
    'si se apaga con el aviso ya en la cola, no sale',
    async () => {
      const [ana, beto] = await pair('Ana Cola', 'Beto Cola');
      await data(await ask(ana, beto));
      const [notice] = await outboxOf(beto.accountId, 'FRIEND_REQUEST');
      await data(await setPrefs(beto, { friendRequestEmail: false }));
      const { outcome } = await deliver(notice?.id ?? '');
      expect(outcome).toEqual({ kind: 'failed', reason: 'preferencia desactivada' });
    },
    PESADA,
  );

  it(
    'una persona recibe como mucho el tope diario de avisos sociales',
    async () => {
      const [ana, beto] = await pair('Ana Tope', 'Beto Tope');
      // Lo que ya le llegó hoy de otras cuentas.
      const now = Date.now();
      const filler = Array.from({ length: EMAIL.socialPerRecipientPerDay }, (_, i) =>
        env.DB.prepare(
          `INSERT INTO notification_outbox (id, account_id, type, payload_json, status, attempts,
             available_at, created_at, sent_at)
           VALUES (?, ?, 'FRIEND_REQUEST', '{}', 'SENT', 1, ?, ?, ?)`,
        ).bind(`obx_tope_${beto.accountId}_${i}`, beto.accountId, now, now, now - i * TIME.MINUTE),
      );
      await env.DB.batch(filler);
      await data(await ask(ana, beto));
      const rows = await outboxOf(beto.accountId, 'FRIEND_REQUEST');
      const nuevo = rows.find((r: OutboxRow) => r.status === 'PENDING');
      const { outcome } = await deliver(nuevo?.id ?? '');
      expect(outcome).toEqual({ kind: 'failed', reason: 'tope diario de avisos sociales' });
    },
    PESADA,
  );
});
