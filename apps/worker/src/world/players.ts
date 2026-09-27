import { MOVEMENT } from '@wous/config';
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
import type { MapDef, MapId } from '@wous/world-data';

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
  softLimit: number;
  hardLimit: number;
};

export const IDENTITY_HEADER = 'X-Wous-Identity';

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
  strikes: number;
  /** Turno de presencia (ADR-0009). */
  ep: number;
  /** Cruzando un portal: ya no camina ni vuelve a pedir otro. */
  tr?: 1;
  /** Último intento de cruzar un portal (hora del servidor). */
  pt?: number;
  /** Si el socket ya no representa a nadie en la sala. */
  gone?: GoneReason;
};

/** Por qué un socket dejó de representar a alguien en la sala. */
export type GoneReason = 'left' | 'replaced' | 'stale' | 'portal';

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
): PlayerAttachment {
  const next = positionAt(att, now, grid);
  const intent = normalizeInput(input.moveX, input.moveY);
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
