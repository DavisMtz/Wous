import { NETWORK } from '@wous/config';
import { type ServerMessage, WS_CLOSE, WS_PING_TEXT } from '@wous/contracts';
import { collisionGrid, PLAZA } from '@wous/world-data';
import { describe, expect, it } from 'vitest';
import { RoomState } from '../src/game/network/room-state.ts';
import {
  type ConnectionStatus,
  type EndReason,
  type SessionCheck,
  type SocketLike,
  WorldConnection,
} from '../src/game/network/world-connection.ts';

class FakeSocket implements SocketLike {
  readyState = 0;
  sent: string[] = [];
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
  }
  abrir() {
    this.readyState = 1;
    this.onopen?.({});
  }
  cerrar(code: number) {
    this.readyState = 3;
    this.onclose?.({ code, reason: '' });
  }
}

function harness(check: SessionCheck = 'ok') {
  const sockets: FakeSocket[] = [];
  const statuses: [ConnectionStatus, EndReason | undefined][] = [];
  const timeouts: { fn: () => void; ms: number }[] = [];
  const intervals: { fn: () => void; ms: number }[] = [];
  const conn = new WorldConnection({
    url: 'ws://localhost/ws/world',
    onMessage: () => {},
    onStatus: (s, r) => statuses.push([s, r]),
    createSocket: () => {
      const s = new FakeSocket();
      sockets.push(s);
      return s;
    },
    checkSession: async () => check,
    random: () => 1,
    timers: {
      setTimeout: (fn, ms) => timeouts.push({ fn, ms }),
      clearTimeout: () => {},
      setInterval: (fn, ms) => intervals.push({ fn, ms }),
      clearInterval: () => {},
    },
  });
  return { conn, sockets, statuses, timeouts, intervals };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('conexión con la sala', () => {
  it('abre, manda solo intención y mantiene vivo con el ping exacto', () => {
    const h = harness();
    h.conn.start();
    expect(h.statuses.at(-1)?.[0]).toBe('CONNECTING');
    // Antes de abrir no se manda nada.
    expect(h.conn.send({ seq: 1, moveX: 1, moveY: 0, interact: true })).toBe(false);
    h.sockets[0]?.abrir();
    expect(h.conn.current).toBe('ONLINE');
    expect(h.conn.send({ seq: 2, moveX: 1, moveY: 0, interact: true })).toBe(true);
    expect(JSON.parse(h.sockets[0]?.sent[0] ?? '')).toEqual({
      v: 1,
      type: 'PLAYER_INPUT',
      seq: 2,
      payload: { moveX: 1, moveY: 0 },
    });
    expect(h.intervals[0]?.ms).toBe(NETWORK.pingIntervalMs);
    h.intervals[0]?.fn();
    expect(h.sockets[0]?.sent.at(-1)).toBe(WS_PING_TEXT);
  });

  it('una caída reconecta con espera creciente', async () => {
    const h = harness();
    h.conn.start();
    h.sockets[0]?.abrir();
    h.sockets[0]?.cerrar(1006);
    await flush();
    expect(h.conn.current).toBe('RECONNECTING');
    expect(h.timeouts[0]?.ms).toBe(NETWORK.reconnect.baseMs);
    h.timeouts[0]?.fn();
    h.sockets[1]?.cerrar(1006);
    await flush();
    expect(h.timeouts[1]?.ms).toBe(NETWORK.reconnect.baseMs * 2);
    h.timeouts[1]?.fn();
    h.sockets[2]?.abrir();
    expect(h.conn.current).toBe('ONLINE');
  });

  it('otra pestaña o la sesión vencida terminan sin reintentar', async () => {
    const otra = harness();
    otra.conn.start();
    otra.sockets[0]?.abrir();
    otra.sockets[0]?.cerrar(WS_CLOSE.REPLACED);
    await flush();
    expect(otra.statuses.at(-1)).toEqual(['ENDED', 'REPLACED']);
    expect(otra.timeouts).toHaveLength(0);

    const vencida = harness('auth');
    vencida.conn.start();
    vencida.sockets[0]?.cerrar(1006); // nunca abrió: se pregunta por la sesión
    await flush();
    expect(vencida.statuses.at(-1)).toEqual(['ENDED', 'AUTH_REQUIRED']);
  });

  it('salir cierra y no reintenta', async () => {
    const h = harness();
    h.conn.start();
    h.sockets[0]?.abrir();
    h.conn.stop();
    expect(h.conn.current).toBe('OFFLINE');
    expect(h.timeouts).toHaveLength(0);
  });
});

const ID_A = 'chr_01J8ZQ4Y7V3M2N6P8R0S1T2V3A';
const ID_B = 'chr_01J8ZQ4Y7V3M2N6P8R0S1T2V3B';
const LOOK = {
  body: 'a',
  skinTone: 'piel-3',
  hair: 'corto',
  hairColor: 'negro',
  top: 'playera.rosa',
  bottom: 'pantalon.mezclilla',
  shoes: 'tenis.blanco',
  accessory: null,
} as const;

function snapshot(serverTime: number): ServerMessage {
  const player = (id: string, x: number) => ({
    id,
    displayName: id === ID_A ? 'Ana' : 'Beto',
    appearance: LOOK,
    x,
    y: 20,
    facing: 'down' as const,
    moveX: 0,
    moveY: 0,
  });
  return {
    v: 1,
    type: 'ROOM_SNAPSHOT',
    payload: {
      room: { mapId: 'plaza', instance: '01', name: 'La Plaza', mapVersion: 1 },
      selfId: ID_A,
      players: [player(ID_A, 10), player(ID_B, 12)],
      serverTime,
    },
  };
}

describe('estado de la sala', () => {
  const grid = collisionGrid(PLAZA);

  it('el snapshot separa a quien juega de los demás', () => {
    const room = new RoomState();
    room.apply(snapshot(5000), 1000);
    expect(room.takeSpawn()?.x).toBe(10);
    expect([...room.remotes.keys()]).toEqual([ID_B]);
  });

  it('interpola a los remotos ~100 ms en el pasado', () => {
    const room = new RoomState();
    room.apply(snapshot(5000), 1000); // local = servidor − 4000
    const estado = (t: number, x: number): ServerMessage => ({
      v: 1,
      type: 'PLAYER_STATE',
      payload: {
        states: [{ id: ID_B, x, y: 20, facing: 'right', moveX: 1, moveY: 0, seq: 1, t }],
        serverTime: t,
      },
    });
    room.apply(estado(5100, 12.5), 1100);
    room.apply(estado(5200, 13), 1200);
    const remoto = room.remotes.get(ID_B);
    if (!remoto) throw new Error('sin remoto');
    // A las 1250 locales se dibuja la hora 5150 del servidor: a medio camino.
    const r = room.render(remoto, 1250, grid);
    expect(r?.x).toBeCloseTo(12.75, 3);
    expect(r?.moving).toBe(true);
    expect(r?.facing).toBe('right');
  });

  it('los estados propios quedan para corregir la predicción', () => {
    const room = new RoomState();
    room.apply(snapshot(5000), 1000);
    room.apply(
      {
        v: 1,
        type: 'PLAYER_STATE',
        payload: {
          states: [
            { id: ID_A, x: 10.4, y: 20, facing: 'right', moveX: 0, moveY: 0, seq: 7, t: 5100 },
          ],
          serverTime: 5100,
        },
      },
      1100,
    );
    expect(room.takeSelfStates()).toEqual([{ x: 10.4, y: 20, seq: 7 }]);
    expect(room.takeSelfStates()).toEqual([]);
  });

  it('quien se va desaparece', () => {
    const room = new RoomState();
    room.apply(snapshot(5000), 1000);
    const v = room.version;
    room.apply({ v: 1, type: 'PLAYER_LEFT', payload: { id: ID_B, reason: 'left' } }, 1100);
    expect(room.remotes.size).toBe(0);
    expect(room.version).toBeGreaterThan(v);
  });
});
