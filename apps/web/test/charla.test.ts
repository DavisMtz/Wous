import type { ServerMessage } from '@wous/contracts';
import { describe, expect, it } from 'vitest';
import { ChatLog } from '../src/game/network/chat-log.ts';
import { RoomState } from '../src/game/network/room-state.ts';
import { WorldConnection } from '../src/game/network/world-connection.ts';
import { wrapText } from '../src/game/phaser/globo.ts';

const ANA = 'chr_01J8ZQ4Y7V3M2N6P8R0S1T2V3A';
const BETO = 'chr_01J8ZQ4Y7V3M2N6P8R0S1T2V3B';
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

function snapshot(
  mapId: string,
  instance: string,
  name: string,
  blocked?: string[],
): ServerMessage {
  const player = (id: string) => ({
    id,
    displayName: id === ANA ? 'Ana' : 'Beto',
    appearance: LOOK,
    x: 10,
    y: 10,
    facing: 'down' as const,
    moveX: 0,
    moveY: 0,
  });
  return {
    v: 1,
    type: 'ROOM_SNAPSHOT',
    payload: {
      room: { mapId, instance, name, mapVersion: 1 },
      selfId: ANA,
      players: [player(ANA), player(BETO)],
      serverTime: 1000,
      ...(blocked ? { blocked } : {}),
    },
  };
}

let n = 0;
function dicho(from: string, text: string): ServerMessage {
  n += 1;
  return {
    v: 1,
    type: 'CHAT_MESSAGE',
    payload: {
      message: {
        id: `msg_01J8ZQ4Y7V3M2N6P8R0S1T${String(n).padStart(4, '0')}`,
        from,
        name: from === ANA ? 'Ana' : 'Beto',
        text,
        at: 1000 + n,
      },
    },
  };
}

describe('registro del chat', () => {
  it('guarda lo dicho, marca lo tuyo y no repite un mensaje', () => {
    const log = new ChatLog(() => 5000);
    log.apply(snapshot('plaza', '01', 'La Plaza'));
    const hola = dicho(BETO, 'hola');
    expect(log.apply(hola)).toBe(true);
    expect(log.apply(hola)).toBe(false);
    log.apply(dicho(ANA, 'qué tal'));
    expect(log.entries.map((e) => (e.kind === 'line' ? [e.line.text, e.mine] : e.kind))).toEqual([
      ['hola', false],
      ['qué tal', true],
    ]);
  });

  it('al cambiar de sala deja un separador; lo de antes queda de otra sala', () => {
    const log = new ChatLog(() => 5000);
    log.apply(snapshot('plaza', '01', 'La Plaza'));
    log.apply(dicho(BETO, 'nos vemos adentro'));
    const antes = log.entries;
    expect(log.apply(snapshot('cafe', '01', 'El Café'))).toBe(true);
    expect(log.entries).not.toBe(antes);
    expect(log.entries.at(-1)).toMatchObject({ kind: 'room', name: 'El Café', room: 'cafe:01' });
    expect(log.entries[0]).toMatchObject({ kind: 'line', room: 'plaza:01' });
    expect(log.currentRoom).toBe('cafe:01');
    // Volver a entrar a la misma sala (reconexión) no deja separador.
    expect(log.apply(snapshot('cafe', '01', 'El Café'))).toBe(false);
  });
});

describe('globos', () => {
  const medida = (s: string) => Array.from(s).length * 10;

  it('corta por palabras y, si una no cabe, por letras', () => {
    expect(wrapText('hola que tal amiga', 90, medida)).toEqual(['hola que', 'tal amiga']);
    expect(wrapText('supercalifragilístico', 60, medida)).toEqual([
      'superc',
      'alifra',
      'gilíst',
      'ico',
    ]);
  });

  it('más de cuatro renglones terminan en «…» (el texto completo está en el chat)', () => {
    const renglones = wrapText('uno dos tres cuatro cinco seis siete ocho', 50, medida);
    expect(renglones).toHaveLength(4);
    expect(renglones[3]?.endsWith('…')).toBe(true);
  });
});

describe('estado de la sala: plática', () => {
  it('lo dicho y los gestos quedan para la escena, una vez', () => {
    const room = new RoomState();
    room.apply(snapshot('plaza', '01', 'La Plaza'), 1000);
    room.apply(dicho(BETO, 'hola'), 1010);
    room.apply({ v: 1, type: 'EMOTE_PLAYED', payload: { id: BETO, emote: 'wave' } }, 1020);
    expect(room.takeSaid().map((l) => l.text)).toEqual(['hola']);
    expect(room.takeSaid()).toEqual([]);
    expect(room.takeGestures()).toEqual([{ id: BETO, emote: 'wave' }]);
    expect(room.takeGestures()).toEqual([]);
  });

  it('a quién bloqueaste llega en el snapshot y en cada confirmación', () => {
    const room = new RoomState();
    let cambios = 0;
    room.subscribe(() => {
      cambios += 1;
    });
    room.apply(snapshot('plaza', '01', 'La Plaza', [BETO]), 1000);
    expect(room.blocked.has(BETO)).toBe(true);
    room.apply(
      { v: 1, type: 'PLAYER_BLOCKED', payload: { characterId: BETO, blocked: false } },
      1100,
    );
    expect(room.blocked.has(BETO)).toBe(false);
    const antes = cambios;
    // La misma confirmación otra vez no cambia nada.
    room.apply(
      { v: 1, type: 'PLAYER_BLOCKED', payload: { characterId: BETO, blocked: false } },
      1200,
    );
    expect(cambios).toBe(antes);
  });

  it('los errores dicen qué pedido los causó', () => {
    const room = new RoomState();
    room.apply(snapshot('plaza', '01', 'La Plaza'), 1000);
    room.apply(
      {
        v: 1,
        type: 'ERROR',
        payload: {
          code: 'RATE_LIMITED',
          message: 'Vas muy rápido.',
          about: 'CHAT_SEND',
          retryAfterMs: 4000,
        },
      },
      1100,
    );
    expect(room.takeErrors()).toEqual([
      { code: 'RATE_LIMITED', about: 'CHAT_SEND', retryAfterMs: 4000 },
    ]);
  });
});

describe('conexión: plática', () => {
  it('el chat, los gestos, los reportes y los bloqueos van como intención, nunca como texto ajeno', () => {
    const sent: string[] = [];
    const socket = {
      readyState: 0,
      send: (data: string) => sent.push(data),
      close: () => {},
      onopen: null as ((ev: unknown) => void) | null,
      onmessage: null,
      onclose: null,
      onerror: null,
    };
    const conn = new WorldConnection({
      url: 'ws://localhost/ws/world',
      onMessage: () => {},
      onStatus: () => {},
      createSocket: () => socket,
      timers: {
        setTimeout: () => 0,
        clearTimeout: () => {},
        setInterval: () => 0,
        clearInterval: () => {},
      },
    });
    // Sin conexión abierta no se encola nada: se avisa con false.
    expect(conn.chat('hola')).toBe(false);
    conn.start();
    socket.readyState = 1;
    socket.onopen?.({});
    expect(conn.chat('hola')).toBe(true);
    conn.emote('heart');
    conn.report({ characterId: BETO, reason: 'SPAM' });
    conn.block(BETO, true);
    conn.block(BETO, false);
    expect(sent.map((s) => JSON.parse(s))).toEqual([
      { v: 1, type: 'CHAT_SEND', payload: { text: 'hola' } },
      { v: 1, type: 'EMOTE_PLAY', payload: { emote: 'heart' } },
      { v: 1, type: 'REPORT_PLAYER', payload: { characterId: BETO, reason: 'SPAM' } },
      { v: 1, type: 'BLOCK_PLAYER', payload: { characterId: BETO } },
      { v: 1, type: 'UNBLOCK_PLAYER', payload: { characterId: BETO } },
    ]);
  });
});
