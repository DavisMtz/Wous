import { runInDurableObject } from 'cloudflare:test';
import { SEATS } from '@wous/config';
import { CAFE, PLAZA, seatOf, spawnOf } from '@wous/world-data';
import { describe, expect, it } from 'vitest';
import type { RoomDO } from '../src/durable-objects/RoomDO.ts';
import type { PlayerAttachment } from '../src/world/players.ts';
import { joinRoomDirectly, sleep, type TestSocket } from './world-support.ts';

/**
 * Asientos (ADR-0013). Sentarse lo decide la sala: el asiento existe en su
 * mapa, lo alcanzas desde donde ELLA te tiene y está libre. Se prueba en el
 * Café, cuyas sillas son asientos.
 */

const sit = (seatId: string) => ({ v: 1, type: 'SIT', payload: { seatId } });
const stand = { v: 1, type: 'STAND', payload: {} };
const input = (seq: number, moveX: number, moveY: number) => ({
  v: 1,
  type: 'PLAYER_INPUT',
  seq,
  payload: { moveX, moveY },
});

const silla = seatOf(CAFE, 'mesa-3-izquierda');
const otra = seatOf(CAFE, 'mesa-3-derecha');
if (!silla || !otra) throw new Error('El Café perdió sus sillas');

type Stub = Awaited<ReturnType<typeof joinRoomDirectly>>['stub'];

/** Pone a alguien en un punto (como si hubiera caminado hasta ahí). */
async function llevar(stub: Stub, characterId: string, x: number, y: number): Promise<void> {
  await runInDurableObject(stub, async (_room: RoomDO, state) => {
    for (const ws of state.getWebSockets(characterId)) {
      const att = ws.deserializeAttachment() as PlayerAttachment;
      ws.serializeAttachment({ ...att, x, y, mx: 0, my: 0, at: Date.now() });
    }
  });
}

/** El último estado que la sala repartió de alguien. */
async function estadoDe(socket: TestSocket, id: string, cumple: (s: EstadoVisto) => boolean) {
  const m = await socket.next('PLAYER_STATE', (msg) =>
    msg.payload.states.some((s) => s.id === id && cumple(s)),
  );
  return m.payload.states.find((s) => s.id === id && cumple(s)) as EstadoVisto;
}
type EstadoVisto = { x: number; y: number; facing: string; seat?: string };

describe('asientos (ADR-0013)', () => {
  it('se sienta cerca de un asiento libre, los demás lo ven sentado y caminar lo levanta en la salida', async () => {
    const a = await joinRoomDirectly('sillas-1', { mapId: 'cafe' });
    const b = await joinRoomDirectly('sillas-1', {
      mapId: 'cafe',
      accountId: 'acc_01J8ZQ4Y7V3M2N6P8R0S1T2V3X',
    });
    await a.socket.next('ROOM_SNAPSHOT');
    await b.socket.next('ROOM_SNAPSHOT');
    const idA = a.identity.characterId;

    // Desde la puerta, la silla queda lejos.
    a.socket.send(sit(silla.id));
    expect((await a.socket.next('ERROR')).payload).toMatchObject({
      code: 'SEAT_NOT_REACHABLE',
      about: 'SIT',
    });

    await sleep(SEATS.minIntervalMs + 20);
    await llevar(a.stub, idA, silla.exit.x, silla.exit.y);
    a.socket.send(sit(silla.id));
    const sentada = await estadoDe(b.socket, idA, (s) => s.seat === silla.id);
    expect(sentada).toMatchObject({ x: silla.x, y: silla.y, facing: silla.facing });

    // Quien llega después la ve sentada desde el primer snapshot.
    const c = await joinRoomDirectly('sillas-1', {
      mapId: 'cafe',
      accountId: 'acc_01J8ZQ4Y7V3M2N6P8R0S1T2V3Y',
    });
    const snap = await c.socket.next('ROOM_SNAPSHOT');
    expect(snap.payload.players.find((p) => p.id === idA)?.seat).toBe(silla.id);

    // Sentada, un input quieto no la mueve; caminar la deja de pie en la salida.
    a.socket.send(input(1, 0, 0));
    await sleep(120);
    a.socket.send(input(2, -1, 0));
    const dePie = await estadoDe(b.socket, idA, (s) => s.seat === undefined);
    expect(dePie.x).toBeCloseTo(silla.exit.x, 2);
    expect(dePie.y).toBeCloseTo(silla.exit.y, 2);
    a.socket.close();
    b.socket.close();
    c.socket.close();
  });

  it('un asiento ocupado no se comparte, ni con quien se desconectó; levantarse lo libera', async () => {
    const a = await joinRoomDirectly('sillas-2', { mapId: 'cafe' });
    const b = await joinRoomDirectly('sillas-2', {
      mapId: 'cafe',
      accountId: 'acc_01J8ZQ4Y7V3M2N6P8R0S1T2V3X',
    });
    await a.socket.next('ROOM_SNAPSHOT');
    await b.socket.next('ROOM_SNAPSHOT');
    const idA = a.identity.characterId;
    const idB = b.identity.characterId;
    await llevar(a.stub, idA, silla.exit.x, silla.exit.y);
    await llevar(b.stub, idB, silla.exit.x, silla.exit.y + 0.3);

    a.socket.send(sit(silla.id));
    await estadoDe(b.socket, idA, (s) => s.seat === silla.id);
    b.socket.send(sit(silla.id));
    expect((await b.socket.next('ERROR')).payload.code).toBe('SEAT_TAKEN');

    // Levantarse con STAND: de pie en la salida, y el asiento queda libre.
    a.socket.send(stand);
    const dePie = await estadoDe(b.socket, idA, (s) => s.seat === undefined);
    expect(dePie.x).toBeCloseTo(silla.exit.x, 2);
    await sleep(SEATS.minIntervalMs + 20);
    b.socket.send(sit(silla.id));
    await estadoDe(a.socket, idB, (s) => s.seat === silla.id);

    // Se le cae la conexión sentada: la sala le guarda el lugar Y el asiento.
    await sleep(SEATS.minIntervalMs + 20);
    await runInDurableObject(b.stub, async (room: RoomDO, state) => {
      const [ws] = state.getWebSockets(idB);
      if (!ws) throw new Error('sin socket');
      await room.webSocketClose(ws, 1006);
    });
    await a.socket.next('PLAYER_STATE', (m) =>
      m.payload.states.some((s) => s.id === idB && s.away === true && s.seat === silla.id),
    );
    await sleep(SEATS.minIntervalMs + 20);
    a.socket.send(sit(silla.id));
    expect((await a.socket.next('ERROR')).payload.code).toBe('SEAT_TAKEN');
    a.socket.close();
  });

  it('un lugar guardado que ya no cabe en el mapa (de otra versión) entra por el spawn', async () => {
    const primera = await joinRoomDirectly('guardado-viejo');
    await primera.socket.next('ROOM_SNAPSHOT');
    const id = primera.identity.characterId;
    const cae = async (stub: Stub) =>
      runInDurableObject(stub, async (room: RoomDO, state) => {
        const [ws] = state.getWebSockets(id);
        if (!ws) throw new Error('sin socket');
        await room.webSocketClose(ws, 1006);
      });

    // Un lugar que sí cabe se respeta al volver dentro de la ventana de gracia.
    await llevar(primera.stub, id, 49, 30);
    await cae(primera.stub);
    const segunda = await joinRoomDirectly('guardado-viejo', { characterId: id, epoch: 1 });
    const snap = await segunda.socket.next('ROOM_SNAPSHOT');
    expect(snap.payload.players.find((p) => p.id === id)).toMatchObject({ x: 49, y: 30 });

    // Como si viniera del mapa anterior: su lugar cae dentro de la Catedral.
    await llevar(segunda.stub, id, 66, 50);
    await cae(segunda.stub);
    const tercera = await joinRoomDirectly('guardado-viejo', { characterId: id, epoch: 2 });
    const otra = await tercera.socket.next('ROOM_SNAPSHOT');
    const yo = otra.payload.players.find((p) => p.id === id);
    const entrada = spawnOf(PLAZA, 'entrada');
    expect(Math.hypot((yo?.x ?? 0) - entrada.x, (yo?.y ?? 0) - entrada.y)).toBeLessThan(2);
    tercera.socket.close();
  });

  it('un asiento de otra sala no existe aquí, y pedirlo con prisa cuenta como falta', async () => {
    const a = await joinRoomDirectly('sillas-3', { mapId: 'cafe' });
    await a.socket.next('ROOM_SNAPSHOT');
    await llevar(a.stub, a.identity.characterId, otra.exit.x, otra.exit.y);
    a.socket.send(sit('banca-que-no-existe'));
    expect((await a.socket.next('ERROR')).payload.code).toBe('SEAT_NOT_FOUND');
    a.socket.send(sit(otra.id));
    expect((await a.socket.next('ERROR')).payload.code).toBe('RATE_LIMITED');
    // La posición no se manda: un campo de más invalida el mensaje entero.
    await sleep(SEATS.minIntervalMs + 20);
    a.socket.send({ v: 1, type: 'SIT', payload: { seatId: otra.id, x: otra.x, y: otra.y } });
    expect((await a.socket.next('ERROR')).payload.code).toBe('INVALID_MESSAGE');
    a.socket.close();
  });
});
