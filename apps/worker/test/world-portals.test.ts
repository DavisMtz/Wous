import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { NETWORK, PORTALS } from '@wous/config';
import { WS_CLOSE, WS_PING_TEXT } from '@wous/contracts';
import { PLAZA, spawnOf } from '@wous/world-data';
import { describe, expect, it } from 'vitest';
import type { RoomDO } from '../src/durable-objects/RoomDO.ts';
import { claimPresence } from '../src/world/location.ts';
import {
  connect,
  directory,
  enterPortal,
  fakeCharacterId,
  hold,
  joinRoomDirectly,
  lastRoom,
  playerWithCharacter,
  sleep,
} from './world-support.ts';

/** Donde aparece quien sale del Café: bajo el portal, en su puerta. */
const FRENTE_AL_CAFE = spawnOf(PLAZA, 'desde-cafe');

/** Alguien que ya está frente a la puerta del Café (la Plaza lo espera ahí). */
async function frenteAlCafe(characterId: string) {
  await directory('plaza').expectArrival(characterId, 'desde-cafe', Date.now() + 30_000);
}

describe('portales (§16)', () => {
  it('Plaza → Café → Plaza: el servidor valida, la Plaza la ve irse y el Café la recibe en la puerta', async () => {
    const ana = await playerWithCharacter('Ana Puerta');
    const beto = await playerWithCharacter('Beto Puerta');
    await frenteAlCafe(ana.characterId);

    const a = (await connect(ana.cookie)).socket;
    if (!a) throw new Error('Ana no entró');
    const snapA = await a.next('ROOM_SNAPSHOT');
    expect(snapA.payload.room.mapId).toBe('plaza');
    expect(snapA.payload.players.find((p) => p.id === ana.characterId)).toMatchObject({
      x: FRENTE_AL_CAFE.x,
      y: FRENTE_AL_CAFE.y,
    });
    const b = (await connect(beto.cookie)).socket;
    if (!b) throw new Error('Beto no entró');
    await b.next('ROOM_SNAPSHOT');
    await a.next('PLAYER_JOINED', (m) => m.payload.player.id === beto.characterId);

    a.send(enterPortal('plaza-cafe'));
    const transfer = await a.next('ROOM_TRANSFER');
    expect(transfer.payload).toEqual({
      portalId: 'plaza-cafe',
      to: { mapId: 'cafe', name: 'El Café' },
    });
    expect((await a.closed).code).toBe(WS_CLOSE.TRANSFER);
    const salida = await b.next('PLAYER_LEFT', (m) => m.payload.id === ana.characterId);
    expect(salida.payload.reason).toBe('portal');
    expect(await lastRoom(ana.characterId)).toBe('cafe');

    // Vuelve a entrar sin decir nada: el servidor ya sabe que va al Café y dónde aparece.
    const a2 = (await connect(ana.cookie)).socket;
    if (!a2) throw new Error('Ana no llegó al Café');
    const cafe = await a2.next('ROOM_SNAPSHOT');
    expect(cafe.payload.room).toMatchObject({ mapId: 'cafe', name: 'El Café' });
    expect(cafe.payload.players.find((p) => p.id === ana.characterId)).toMatchObject({
      x: 11,
      y: 12.3,
      facing: 'up',
    });
    expect(cafe.payload.room.mapVersion).toBe(3);
    expect(cafe.payload.players.map((p) => p.id)).not.toContain(beto.characterId);

    // Y de regreso: la puerta del Café lleva a la Plaza, frente al Café.
    a2.send(enterPortal('cafe-plaza'));
    await a2.next('ROOM_TRANSFER', (m) => m.payload.to.mapId === 'plaza');
    expect((await a2.closed).code).toBe(WS_CLOSE.TRANSFER);
    expect(await lastRoom(ana.characterId)).toBe('plaza');

    const a3 = (await connect(ana.cookie)).socket;
    if (!a3) throw new Error('Ana no regresó');
    const plaza = await a3.next('ROOM_SNAPSHOT');
    expect(plaza.payload.room.mapId).toBe('plaza');
    expect(plaza.payload.players.find((p) => p.id === ana.characterId)).toMatchObject({
      x: FRENTE_AL_CAFE.x,
      y: FRENTE_AL_CAFE.y,
    });
    await b.next('PLAYER_JOINED', (m) => m.payload.player.id === ana.characterId);
    a3.close();
    b.close();
  });

  it('no se entra al Café pidiéndolo: ni por la URL, ni con cabeceras, ni con una puerta lejana o ajena', async () => {
    const carla = await playerWithCharacter('Carla Lejos');
    const falsa = JSON.stringify({
      characterId: carla.characterId,
      mapId: 'cafe',
      instance: '01',
      epoch: 999,
      spawn: 'desde-plaza',
    });
    const s = (
      await connect(
        carla.cookie,
        { 'X-Wous-Identity': falsa },
        '/ws/world?map=cafe&room=cafe&instance=01&spawn=desde-plaza',
      )
    ).socket;
    if (!s) throw new Error('Carla no entró');
    const snap = await s.next('ROOM_SNAPSHOT');
    expect(snap.payload.room.mapId).toBe('plaza');

    // Desde la entrada, la puerta del Café queda lejos.
    s.send(enterPortal('plaza-cafe'));
    expect((await s.next('ERROR')).payload.code).toBe('PORTAL_NOT_REACHABLE');
    // Insistir de inmediato cuenta como falta.
    s.send(enterPortal('plaza-cafe'));
    expect((await s.next('ERROR')).payload.code).toBe('RATE_LIMITED');
    await sleep(PORTALS.minIntervalMs + 50);
    // La puerta de otra sala no existe aquí, y un nombre de sala no es una puerta.
    s.send(enterPortal('cafe-plaza'));
    expect((await s.next('ERROR')).payload.code).toBe('PORTAL_NOT_FOUND');
    await sleep(PORTALS.minIntervalMs + 50);
    s.send(enterPortal('cafe'));
    expect((await s.next('ERROR')).payload.code).toBe('PORTAL_NOT_FOUND');
    // El destino no se manda: un campo de más invalida el mensaje entero.
    s.send({ v: 1, type: 'ENTER_PORTAL', payload: { portalId: 'plaza-cafe', to: 'cafe' } });
    expect((await s.next('ERROR')).payload.code).toBe('INVALID_MESSAGE');

    expect(s.received.some((m) => m.type === 'ROOM_TRANSFER')).toBe(false);
    expect(await lastRoom(carla.characterId)).toBeNull();
    s.close();
  });
});

describe('nunca en dos salas (ADR-0009)', () => {
  it('si otra conexión tomó turno antes de cruzar, el cruce no aplica y este socket se retira', async () => {
    const dani = await playerWithCharacter('Dani Turno');
    await frenteAlCafe(dani.characterId);
    const d1 = (await connect(dani.cookie)).socket;
    if (!d1) throw new Error('Dani no entró');
    await d1.next('ROOM_SNAPSHOT');

    // Otra pestaña ya leyó en D1 a dónde ir (tomó turno) y aún no llega a la sala.
    const turno = await claimPresence(env.DB, dani.characterId, dani.accountId);
    expect(turno?.mapId).toBe('plaza');

    d1.send(enterPortal('plaza-cafe'));
    expect((await d1.next('ERROR')).payload.code).toBe('CONNECTION_REPLACED');
    expect((await d1.closed).code).toBe(WS_CLOSE.REPLACED);
    expect(d1.received.some((m) => m.type === 'ROOM_TRANSFER')).toBe(false);
    expect(await lastRoom(dani.characterId)).toBeNull();

    // La otra pestaña entra a la Plaza, y es el único lugar donde está.
    const d2 = (await connect(dani.cookie)).socket;
    if (!d2) throw new Error('la otra pestaña no entró');
    expect((await d2.next('ROOM_SNAPSHOT')).payload.room.mapId).toBe('plaza');
    const cafe = await directory('cafe').occupancy();
    expect(cafe.presence[dani.characterId]).toBeUndefined();
    d2.close();
  });

  it('una conexión con turno viejo que llega tarde no desplaza a la nueva', async () => {
    const id = fakeCharacterId();
    const nueva = await joinRoomDirectly('turnos', { characterId: id, epoch: 5 });
    await nueva.socket.next('ROOM_SNAPSHOT');
    const vieja = await joinRoomDirectly('turnos', { characterId: id, epoch: 4 });
    expect((await vieja.socket.next('ERROR')).payload.code).toBe('CONNECTION_REPLACED');
    expect((await vieja.socket.closed).code).toBe(WS_CLOSE.REPLACED);
    nueva.socket.send(WS_PING_TEXT);
    await nueva.socket.next('PONG');
    nueva.socket.close();
  });
});

/** Simula una caída: el runtime entrega 1006 y el cliente no puede mandar ese código. */
async function caida(stub: DurableObjectStub<RoomDO>, characterId: string) {
  await runInDurableObject(stub, async (room: RoomDO, state) => {
    const [ws] = state.getWebSockets(characterId);
    if (!ws) throw new Error('sin socket');
    await room.webSocketClose(ws, 1006);
  });
}

describe('ventana de gracia (§17)', () => {
  it('si se le cae la conexión, los demás la ven quieta y marcada; al volver sigue donde estaba', async () => {
    const eva = fakeCharacterId();
    const uno = await joinRoomDirectly('gracia', { characterId: eva, epoch: 1, hardLimit: 5 });
    await uno.socket.next('ROOM_SNAPSHOT');
    const testigo = await joinRoomDirectly('gracia', { hardLimit: 5 });
    await testigo.socket.next('ROOM_SNAPSHOT');

    const seq = await hold(uno.socket, 1, 1, 0, 300);
    const movida = await testigo.socket.next('PLAYER_STATE', (m) =>
      m.payload.states.some((s) => s.id === eva && s.seq === seq),
    );
    const donde = movida.payload.states.find((s) => s.id === eva);
    if (!donde) throw new Error('sin estado');

    await caida(uno.stub, eva);
    const quieta = await testigo.socket.next('PLAYER_STATE', (m) =>
      m.payload.states.some((s) => s.id === eva && s.away === true),
    );
    expect(quieta.payload.states[0]).toMatchObject({ moveX: 0, moveY: 0, away: true });
    expect(
      testigo.socket.received.some((m) => m.type === 'PLAYER_LEFT' && m.payload.id === eva),
    ).toBe(false);

    // Quien llega mientras tanto también la ve, marcada.
    const nuevo = await joinRoomDirectly('gracia', { hardLimit: 5 });
    const snapNuevo = await nuevo.socket.next('ROOM_SNAPSHOT');
    expect(snapNuevo.payload.players.find((p) => p.id === eva)?.away).toBe(true);

    // Vuelve a tiempo: sigue donde estaba, sin marca, y nadie vio una salida.
    const dos = await joinRoomDirectly('gracia', { characterId: eva, epoch: 2, hardLimit: 5 });
    const snap = await dos.socket.next('ROOM_SNAPSHOT');
    const yo = snap.payload.players.find((p) => p.id === eva);
    expect(yo?.x).toBeCloseTo(donde.x, 1);
    expect(yo?.y).toBeCloseTo(donde.y, 1);
    expect(yo?.away).toBeUndefined();
    const regreso = await testigo.socket.next('PLAYER_JOINED', (m) => m.payload.player.id === eva);
    expect(regreso.payload.player.away).toBeUndefined();
    const guardados = await runInDurableObject(dos.stub, (_, state) =>
      state.storage.list({ prefix: 'ghost:' }),
    );
    expect(guardados.size).toBe(0);

    dos.socket.close();
    nuevo.socket.close();
    testigo.socket.close();
  });

  it('si no vuelve a tiempo, se va; y la sala vacía no deja alarma', async () => {
    const leo = fakeCharacterId();
    const uno = await joinRoomDirectly('sin-vuelta', { characterId: leo, epoch: 1 });
    await uno.socket.next('ROOM_SNAPSHOT');
    const testigo = await joinRoomDirectly('sin-vuelta');
    await testigo.socket.next('ROOM_SNAPSHOT');

    await caida(uno.stub, leo);
    await testigo.socket.next('PLAYER_STATE', (m) => m.payload.states.some((s) => s.away));
    // La alarma se adelanta al vencimiento del lugar guardado.
    const alarma = await runInDurableObject(uno.stub, (_, state) => state.storage.getAlarm());
    expect(alarma).not.toBeNull();
    expect(alarma ?? 0).toBeLessThanOrEqual(Date.now() + NETWORK.graceAfterDropMs + 50);

    await runInDurableObject(uno.stub, async (room: RoomDO) => {
      await (room as unknown as { reapGhosts(now: number): Promise<void> }).reapGhosts(
        Date.now() + NETWORK.graceAfterDropMs + 1000,
      );
    });
    const salida = await testigo.socket.next('PLAYER_LEFT', (m) => m.payload.id === leo);
    expect(salida.payload.reason).toBe('stale');

    // «Salir» (1000) se va en el acto: sin lugar guardado y sin alarma.
    testigo.socket.close();
    await sleep(80);
    const despues = await runInDurableObject(uno.stub, async (_, state) => ({
      alarma: await state.storage.getAlarm(),
      guardados: (await state.storage.list({ prefix: 'ghost:' })).size,
    }));
    expect(despues).toEqual({ alarma: null, guardados: 0 });
  });

  it('el lugar guardado ocupa cupo: la sala llena no se lo da a otro', async () => {
    const mia = fakeCharacterId();
    const uno = await joinRoomDirectly('cupo', { characterId: mia, epoch: 1, hardLimit: 1 });
    await uno.socket.next('ROOM_SNAPSHOT');
    await caida(uno.stub, mia);
    const otro = await joinRoomDirectly('cupo', { hardLimit: 1 });
    expect((await otro.socket.next('ERROR')).payload.code).toBe('ROOM_FULL');
    // Ella sí vuelve.
    const vuelve = await joinRoomDirectly('cupo', { characterId: mia, epoch: 2, hardLimit: 1 });
    await vuelve.socket.next('ROOM_SNAPSHOT');
    vuelve.socket.close();
  });
});

describe('llegadas por portal en el directorio', () => {
  it('se consumen una sola vez y vencen', async () => {
    const dir = env.ROOM_DIRECTORY.get(env.ROOM_DIRECTORY.idFromName('directory:llegadas'));
    const limits = { softLimit: 2, hardLimit: 3 };
    await dir.expectArrival('chr_X', 'desde-cafe', Date.now() + 30_000);
    expect((await dir.assign('chr_X', limits)).spawn).toBe('desde-cafe');
    expect((await dir.assign('chr_X', limits)).spawn).toBeUndefined();
    await dir.expectArrival('chr_Y', 'desde-cafe', Date.now() - 1);
    expect((await dir.assign('chr_Y', limits)).spawn).toBeUndefined();
    expect((await dir.occupancy()).arrivals).toEqual({});
  });
});
