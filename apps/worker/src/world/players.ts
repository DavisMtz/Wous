import { MOVEMENT, NETWORK } from '@wous/config';
import type {
  AppearanceInput,
  Facing,
  PlayerStateView,
  PlayerView,
  RoomRef,
} from '@wous/contracts';
import {
  type CollisionGrid,
  canStandAt,
  distance,
  facingFrom,
  normalizeInput,
  stepMovement,
  type Vec,
} from '@wous/game-core';
import type { MapDef, MapId, Seat } from '@wous/world-data';

/**
 * Identidad de quien entra a una sala. La arma el Worker DESPUÉS de validar
 * Origin, sesión, cuenta y personaje; el cliente nunca la escribe (la
 * cabecera se construye de cero al reenviar al Durable Object).
 */
export type RoomIdentity = {
  characterId: string;
  accountId: string;
  sessionId: string;
  displayName: string;
  appearance: AppearanceInput;
  mapId: MapId;
  /** Instancia elegida por el directorio («01»). */
  instance: string;
  /** Turno de presencia de esta conexión (ADR-0009): el más alto es el vigente. */
  epoch: number;
  /** Punto de llegada con nombre, si vienes de un portal (lo guarda el directorio). */
  spawn?: string;
  /** Silencio de moderación vigente (epoch ms), si lo hay (ADR-0010). */
  mutedUntil?: number;
  softLimit: number;
  hardLimit: number;
};

export const IDENTITY_HEADER = 'X-Wous-Identity';

/**
 * La identidad viaja en una cabecera: se codifica en ASCII porque los nombres
 * llevan acentos («Ñandú») y una cabecera con bytes fuera de ASCII solo pasa
 * por una tolerancia del runtime.
 */
export function encodeIdentity(identity: RoomIdentity): string {
  return encodeURIComponent(JSON.stringify(identity));
}

export function decodeIdentity(header: string): RoomIdentity {
  return JSON.parse(decodeURIComponent(header)) as RoomIdentity;
}

/**
 * Estado de un jugador, guardado en el attachment de SU socket: sobrevive a
 * la hibernación de la sala sin tocar storage (ADR-0008). Tope del runtime:
 * 2048 bytes serializado (hay prueba que lo mide).
 */
export type PlayerAttachment = {
  id: string;
  acc: string;
  ses: string;
  name: string;
  look: AppearanceInput;
  x: number;
  y: number;
  f: Facing;
  /** Intención vigente, ya normalizada. */
  mx: number;
  my: number;
  /** Último input aplicado. */
  seq: number;
  /** Hora del servidor del último input aplicado (o de la entrada). */
  at: number;
  /** Última vez que llegó cualquier mensaje. */
  seen: number;
  /** Ventana de conteo de inputs (inicio) y cuántos van en ella. */
  win: number;
  n: number;
  /** Faltas de la ventana que empezó en `kw` (ver `addStrike`). */
  strikes: number;
  kw?: number;
  /** Turno de presencia (ADR-0009). */
  ep: number;
  /** Cruzando un portal: ya no camina ni vuelve a pedir otro. */
  tr?: 1;
  /** Último intento de cruzar un portal (hora del servidor). */
  pt?: number;
  /** Chat (§18): marcas de los últimos intentos (flood) y huella y hora del último aceptado. */
  cw?: number[];
  cp?: number;
  ct?: number;
  /** Último gesto (enfriamiento, §19). */
  eg?: number;
  /** Sentado en este asiento del mapa (ADR-0013). Sentado no se camina. */
  st?: string;
  /** Último cambio de sentarse o levantarse (hora del servidor). */
  sa?: number;
  /** Silencio de moderación vigente hasta (epoch ms). */
  mu?: number;
  /** Acciones sociales (bloquear, reportar): marcas de la última ventana. */
  sw?: number[];
  /** Si el socket ya no representa a nadie en la sala. */
  gone?: GoneReason;
};

/** Por qué un socket dejó de representar a alguien en la sala. */
export type GoneReason = 'left' | 'replaced' | 'stale' | 'portal';

/**
 * Una falta más (§23). Cuentan dentro de una ventana de `strikeWindowMs`:
 * pasada la ventana se olvidan, así una sesión larga no junta faltas sueltas
 * hasta que la corren. Devuelve true si con esta ya se pasó del tope.
 */
export function addStrike(att: PlayerAttachment, now: number): boolean {
  if (att.kw === undefined || now - att.kw >= NETWORK.strikeWindowMs) {
    att.kw = now;
    att.strikes = 0;
  }
  att.strikes += 1;
  return att.strikes > NETWORK.maxStrikes;
}

/** Tres decimales de tile bastan en el cable (≈0.05 px de arte). */
export function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

/**
 * Aplica un input (§14): primero avanza con la intención ANTERIOR durante el
 * tiempo del servidor transcurrido (con tope), resuelve colisión, y luego
 * adopta la intención nueva ya normalizada. El cliente nunca aporta tiempo ni
 * posición: enviar más rápido no mueve más rápido.
 */
export function applyInput(
  att: PlayerAttachment,
  input: { moveX: number; moveY: number; seq: number },
  now: number,
  grid: CollisionGrid,
  seat?: Seat,
): PlayerAttachment {
  const intent = normalizeInput(input.moveX, input.moveY);
  if (att.st !== undefined) {
    // Sentado: quieto, sigue sentado. Caminar levanta: queda de pie en la
    // salida del asiento con la intención nueva (el cliente predice lo mismo).
    if (intent.x === 0 && intent.y === 0) return { ...att, seq: input.seq, at: now };
    const exit = seat?.exit ?? { x: att.x, y: att.y };
    const { st: _seat, ...standing } = att;
    return {
      ...standing,
      x: round3(exit.x),
      y: round3(exit.y),
      f: facingFrom(intent, att.f),
      mx: round3(intent.x),
      my: round3(intent.y),
      seq: input.seq,
      at: now,
    };
  }
  const next = positionAt(att, now, grid);
  return {
    ...att,
    x: next.x,
    y: next.y,
    f: facingFrom(intent, att.f),
    mx: round3(intent.x),
    my: round3(intent.y),
    seq: input.seq,
    at: now,
  };
}

/**
 * Dónde está alguien AHORA para el servidor: su último punto más lo que avanzó
 * con la intención vigente desde entonces (con el mismo tope que un input).
 * Quien camina hacia la puerta y pide cruzar se mide aquí, no donde mandó su
 * último input.
 */
export function positionAt(att: PlayerAttachment, now: number, grid: CollisionGrid): Vec {
  const dt = Math.max(0, Math.min(now - att.at, MOVEMENT.maxStepMs));
  return stepMovement({ x: att.x, y: att.y }, { x: att.mx, y: att.my }, dt, grid);
}

/** Sentarse (ADR-0013): los pies van al asiento, mirando hacia donde mira el asiento. */
export function sitDown(att: PlayerAttachment, seat: Seat, now: number): PlayerAttachment {
  return {
    ...att,
    x: round3(seat.x),
    y: round3(seat.y),
    f: seat.facing,
    mx: 0,
    my: 0,
    at: now,
    st: seat.id,
    sa: now,
  };
}

/** Levantarse: de pie en la salida del asiento (si el asiento ya no existe, ahí mismo). */
export function standUp(
  att: PlayerAttachment,
  seat: Seat | undefined,
  now: number,
): PlayerAttachment {
  const { st: _seat, ...standing } = att;
  const exit = seat?.exit ?? { x: att.x, y: att.y };
  return { ...standing, x: round3(exit.x), y: round3(exit.y), mx: 0, my: 0, at: now, sa: now };
}

/**
 * Dónde aparece alguien: el punto del mapa si está libre; si ya hay alguien
 * encima, un lugar cercano donde se pueda estar. Nadie nace dentro de otro.
 */
export function chooseSpawn(
  base: Vec,
  occupied: Vec[],
  grid: CollisionGrid,
  random: () => number = Math.random,
): Vec {
  const free = (p: Vec) => canStandAt(grid, p) && occupied.every((o) => distance(o, p) >= 0.6);
  if (free(base)) return { ...base };
  for (let attempt = 0; attempt < 24; attempt++) {
    const radius = 0.7 + (attempt / 24) * 1.6;
    const angle = random() * Math.PI * 2;
    const p = { x: base.x + Math.cos(angle) * radius, y: base.y + Math.sin(angle) * radius };
    if (free(p)) return { x: round3(p.x), y: round3(p.y) };
  }
  return { ...base };
}

export function toPlayerView(att: PlayerAttachment, away = false): PlayerView {
  return {
    id: att.id,
    displayName: att.name,
    appearance: att.look,
    x: round3(att.x),
    y: round3(att.y),
    facing: att.f,
    moveX: att.mx,
    moveY: att.my,
    ...(away ? { away: true } : {}),
    ...(att.st !== undefined ? { seat: att.st } : {}),
  };
}

export function toStateView(att: PlayerAttachment, away = false): PlayerStateView {
  return {
    id: att.id,
    x: round3(att.x),
    y: round3(att.y),
    facing: att.f,
    moveX: att.mx,
    moveY: att.my,
    seq: att.seq,
    t: att.at,
    ...(away ? { away: true } : {}),
    ...(att.st !== undefined ? { seat: att.st } : {}),
  };
}

export function roomRef(map: MapDef, instance: string): RoomRef {
  return { mapId: map.id, instance, name: map.name, mapVersion: map.version };
}

/** Nombre del Durable Object de una instancia de sala (§13: `room:plaza:01`). */
export function roomObjectName(mapId: MapId, instance: string): string {
  return `room:${mapId}:${instance}`;
}

export function directoryObjectName(mapId: MapId): string {
  return `directory:${mapId}`;
}
