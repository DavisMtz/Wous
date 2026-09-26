import { z } from 'zod';
import { AppearanceInput } from '../domain/appearance.ts';
import { CharacterId } from '../domain/ids.ts';
import { WS_PROTOCOL_VERSION, WsErrorCode, wsEnvelope } from './protocol.ts';

/**
 * Mensajes del mundo en tiempo real (§12). El cliente manda INTENCIÓN, nunca
 * posición: los payloads son objetos estrictos, así que un `x`/`y` colado en
 * PLAYER_INPUT invalida el mensaje entero (§14).
 */

/**
 * Texto EXACTO del ping y su respuesta. El Durable Object los contesta con la
 * auto-respuesta de Hibernation, que compara byte a byte: sin `id`, sin `seq`,
 * mismo orden de claves. Enviar otra forma despierta a la sala sin necesidad.
 */
export const WS_PING_TEXT = `{"v":${WS_PROTOCOL_VERSION},"type":"PING"}`;
export const WS_PONG_TEXT = `{"v":${WS_PROTOCOL_VERSION},"type":"PONG"}`;

/** Códigos de cierre propios (4000–4999). El cliente decide por el código. */
export const WS_CLOSE = {
  /** La sesión ya no vale (se volvió a validar al conectar o expiró). */
  SESSION_ENDED: 4001,
  /** La instancia está llena; el cliente puede reintentar (el directorio elegirá otra). */
  ROOM_FULL: 4003,
  /** Mensajes inválidos o fuera de ritmo repetidos. */
  POLICY: 4008,
  /** El mismo personaje se conectó desde otra pestaña o dispositivo. */
  REPLACED: 4009,
  /** Sin señales de vida (ni ping ni mensajes) dentro de la ventana. */
  STALE: 4010,
} as const;
export type WsCloseCode = (typeof WS_CLOSE)[keyof typeof WS_CLOSE];

/** Tamaño máximo de un mensaje del cliente, en caracteres. */
export const WS_MAX_CLIENT_MESSAGE = 1024;

export const Facing = z.enum(['down', 'up', 'left', 'right']);
export type Facing = z.infer<typeof Facing>;

const Axis = z.number().min(-1).max(1);
/** Coordenada en tiles, con tres decimales en el cable. */
const Coord = z.number().min(-1).max(10_000);
const Seq = z
  .number()
  .int()
  .nonnegative()
  .max(2 ** 31);

// ─── Cliente → servidor ────────────────────────────────────────────────────

export const PlayerInputMessage = wsEnvelope(
  'PLAYER_INPUT',
  z.strictObject({ moveX: Axis, moveY: Axis }),
).extend({ seq: Seq });
export type PlayerInputMessage = z.infer<typeof PlayerInputMessage>;

export const PingMessage = z.object({ v: z.literal(WS_PROTOCOL_VERSION), type: z.literal('PING') });

export const ClientMessage = z.discriminatedUnion('type', [PlayerInputMessage, PingMessage]);
export type ClientMessage = z.infer<typeof ClientMessage>;

// ─── Servidor → cliente ────────────────────────────────────────────────────

export const RoomRef = z.object({
  mapId: z.string().max(40),
  /** Instancia de la sala lógica («01», «02»…). */
  instance: z.string().max(10),
  name: z.string().max(60),
  mapVersion: z.number().int(),
});
export type RoomRef = z.infer<typeof RoomRef>;

/** Lo que otros ven de un personaje. Nunca la cuenta, el correo ni la sesión. */
export const PlayerView = z.object({
  id: CharacterId,
  displayName: z.string().max(40),
  appearance: AppearanceInput,
  x: Coord,
  y: Coord,
  facing: Facing,
  moveX: Axis,
  moveY: Axis,
});
export type PlayerView = z.infer<typeof PlayerView>;

/** Estado autoritativo tras procesar un input. `seq` es el último input aplicado. */
export const PlayerStateView = z.object({
  id: CharacterId,
  x: Coord,
  y: Coord,
  facing: Facing,
  moveX: Axis,
  moveY: Axis,
  seq: Seq,
  /** Hora del servidor en que se calculó este estado (para interpolar). */
  t: z.number().int(),
});
export type PlayerStateView = z.infer<typeof PlayerStateView>;

export const RoomSnapshotMessage = wsEnvelope(
  'ROOM_SNAPSHOT',
  z.object({
    room: RoomRef,
    selfId: CharacterId,
    players: z.array(PlayerView),
    serverTime: z.number().int(),
  }),
);

export const PlayerJoinedMessage = wsEnvelope('PLAYER_JOINED', z.object({ player: PlayerView }));

export const PlayerLeftMessage = wsEnvelope(
  'PLAYER_LEFT',
  z.object({ id: CharacterId, reason: z.enum(['left', 'stale', 'replaced']) }),
);

/** Estados agrupados: la sala junta los cambios y los manda por lotes (ADR-0008). */
export const PlayerStateMessage = wsEnvelope(
  'PLAYER_STATE',
  z.object({ states: z.array(PlayerStateView), serverTime: z.number().int() }),
);

export const PongMessage = z.object({ v: z.literal(WS_PROTOCOL_VERSION), type: z.literal('PONG') });

export const ErrorMessage = wsEnvelope(
  'ERROR',
  z.object({ code: WsErrorCode, message: z.string().max(200) }),
);

export const ServerMessage = z.discriminatedUnion('type', [
  RoomSnapshotMessage,
  PlayerJoinedMessage,
  PlayerLeftMessage,
  PlayerStateMessage,
  PongMessage,
  ErrorMessage,
]);
export type ServerMessage = z.infer<typeof ServerMessage>;
export type ServerMessageOf<T extends ServerMessage['type']> = Extract<ServerMessage, { type: T }>;
