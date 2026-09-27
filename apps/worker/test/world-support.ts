import { env } from 'cloudflare:workers';
import type { AppearanceInput, CharacterView, ServerMessage } from '@wous/contracts';
import { expect } from 'vitest';
import { IDENTITY_HEADER, type RoomIdentity } from '../src/world/players.ts';
import { call, postJson } from './helpers.ts';
import { createVerifiedUser } from './support.ts';

export const APPEARANCE: AppearanceInput = {
  body: 'a',
  skinTone: 'piel-3',
  hair: 'corto',
  hairColor: 'negro',
  top: 'playera.rosa',
  bottom: 'pantalon.mezclilla',
  shoes: 'tenis.blanco',
  accessory: null,
};

/** Cuenta verificada con personaje: lo mínimo para entrar al mundo. */
export async function playerWithCharacter(displayName: string) {
  const user = await createVerifiedUser();
  const res = await postJson(
    '/api/v1/characters',
    { displayName, appearance: APPEARANCE },
    { headers: { Cookie: user.cookie } },
  );
  expect(res.status).toBe(201);
  const { data } = (await res.json()) as { data: CharacterView };
  return { ...user, characterId: data.id, displayName: data.displayName };
}

export type TestSocket = {
  ws: WebSocket;
  received: ServerMessage[];
  /** Espera el siguiente mensaje de ese tipo (y que cumpla el filtro). */
  next<T extends ServerMessage['type']>(
    type: T,
    where?: (m: Extract<ServerMessage, { type: T }>) => boolean,
    timeoutMs?: number,
  ): Promise<Extract<ServerMessage, { type: T }>>;
  send(message: unknown): void;
  closed: Promise<{ code: number; reason: string }>;
  close(): void;
};

export function wrap(ws: WebSocket): TestSocket {
  ws.accept();
  const received: ServerMessage[] = [];
  const listeners = new Set<() => void>();
  ws.addEventListener('message', (event) => {
    received.push(JSON.parse(String(event.data)) as ServerMessage);
    for (const l of listeners) l();
  });
  const closed = new Promise<{ code: number; reason: string }>((resolve) => {
    ws.addEventListener('close', (event) => resolve({ code: event.code, reason: event.reason }));
  });
  let cursor = 0;
  return {
    ws,
    received,
    closed,
    send: (message) => ws.send(typeof message === 'string' ? message : JSON.stringify(message)),
    close: () => {
      try {
        ws.close(1000, 'fin');
      } catch {
        // Ya cerrado.
      }
    },
    next(type, where, timeoutMs = 8000) {
      return new Promise((resolve, reject) => {
        const find = () => {
          for (let i = cursor; i < received.length; i++) {
            const m = received[i] as ServerMessage;
            if (m.type === type && (!where || where(m as never))) {
              cursor = i + 1;
              listeners.delete(find);
              clearTimeout(timer);
              resolve(m as never);
              return;
            }
          }
        };
        const timer = setTimeout(() => {
          listeners.delete(find);
          reject(
            new Error(`No llegó ${type} (recibidos: ${received.map((m) => m.type).join(', ')})`),
          );
        }, timeoutMs);
        listeners.add(find);
        find();
      });
    },
  };
}

/** Entra al mundo por el Worker completo, como el navegador. */
export async function connect(
  cookie: string,
  headers: Record<string, string> = {},
  path = '/ws/world',
) {
  const res = await call(path, {
    headers: { Upgrade: 'websocket', Cookie: cookie, ...headers },
  });
  if (res.status !== 101 || !res.webSocket) return { res, socket: null };
  return { res, socket: wrap(res.webSocket) };
}

let fakeCounter = 0;
/** ID de personaje con forma válida para pruebas que hablan directo con la sala. */
export function fakeCharacterId(): string {
  fakeCounter += 1;
  return `chr_01J8ZQ4Y7V3M2N6P8R0S1T${String(fakeCounter)
    .padStart(4, '0')
    .replace(/[ILOU]/g, 'X')}`;
}

/** Entra directo a una instancia (sin Worker): identidad y límites a la medida. */
export async function joinRoomDirectly(roomName: string, overrides: Partial<RoomIdentity> = {}) {
  const identity: RoomIdentity = {
    characterId: fakeCharacterId(),
    accountId: 'acc_01J8ZQ4Y7V3M2N6P8R0S1T2V3W',
    sessionId: 'ses_01J8ZQ4Y7V3M2N6P8R0S1T2V3W',
    displayName: 'Prueba',
    appearance: APPEARANCE,
    mapId: 'plaza',
    instance: roomName,
    epoch: 0,
    softLimit: 2,
    hardLimit: 3,
    ...overrides,
  };
  const stub = env.ROOM.get(env.ROOM.idFromName(`room:${identity.mapId}:${roomName}`));
  const res = await stub.fetch(
    new Request('https://sala.wous.internal/entrar', {
      headers: { Upgrade: 'websocket', [IDENTITY_HEADER]: JSON.stringify(identity) },
    }),
  );
  if (!res.webSocket) throw new Error(`La sala respondió ${res.status}`);
  return { identity, stub, socket: wrap(res.webSocket) };
}

/** El directorio de una sala lógica (para anotar llegadas o mirar la ocupación). */
export function directory(mapId: string) {
  return env.ROOM_DIRECTORY.get(env.ROOM_DIRECTORY.idFromName(`directory:${mapId}`));
}

/** La sala lógica guardada en D1 para un personaje. */
export async function lastRoom(characterId: string): Promise<string | null> {
  const row = await env.DB.prepare('SELECT last_room_id FROM characters WHERE id = ?')
    .bind(characterId)
    .first<{ last_room_id: string | null }>();
  return row?.last_room_id ?? null;
}

export const enterPortal = (portalId: string) => ({
  v: 1,
  type: 'ENTER_PORTAL',
  payload: { portalId },
});

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Mantiene una dirección mandando inputs a 12 Hz, como el cliente. */
export async function hold(
  socket: TestSocket,
  firstSeq: number,
  moveX: number,
  moveY: number,
  ms: number,
): Promise<number> {
  let seq = firstSeq;
  const end = Date.now() + ms;
  while (Date.now() < end) {
    socket.send({ v: 1, type: 'PLAYER_INPUT', seq, payload: { moveX, moveY } });
    seq += 1;
    await sleep(80);
  }
  socket.send({ v: 1, type: 'PLAYER_INPUT', seq, payload: { moveX: 0, moveY: 0 } });
  return seq;
}
