import { MOVEMENT } from '@wous/config';
import { type CollisionGrid, isBlocked } from './collision.ts';

/**
 * Movimiento compartido por el cliente (predicción) y el servidor (autoridad,
 * §14). TypeScript puro: sin reloj propio, sin DOM, sin Phaser. El tiempo
 * siempre llega como parámetro; el servidor usa el suyo.
 */

export type Vec = { x: number; y: number };
export type Facing = 'down' | 'up' | 'left' | 'right';

export type MovementConfig = {
  speedTilesPerSecond: number;
  maxStepMs: number;
  footprint: { halfWidth: number; halfHeight: number };
  deadZone: number;
};

export const DEFAULT_MOVEMENT: MovementConfig = MOVEMENT;

const EPSILON = 1e-4;

/**
 * Normaliza la intención del cliente: cada eje en [-1, 1] y magnitud total
 * ≤ 1 (en diagonal no se va más rápido). Valores no finitos cuentan como 0.
 */
export function normalizeInput(
  x: number,
  y: number,
  config: Pick<MovementConfig, 'deadZone'> = DEFAULT_MOVEMENT,
): Vec {
  const cx = Number.isFinite(x) ? Math.max(-1, Math.min(1, x)) : 0;
  const cy = Number.isFinite(y) ? Math.max(-1, Math.min(1, y)) : 0;
  const length = Math.hypot(cx, cy);
  if (length < config.deadZone) return { x: 0, y: 0 };
  if (length <= 1) return { x: cx, y: cy };
  return { x: cx / length, y: cy / length };
}

/** Hacia dónde mira el personaje según la intención; sin intención, conserva. */
export function facingFrom(input: Vec, previous: Facing): Facing {
  if (input.x === 0 && input.y === 0) return previous;
  if (Math.abs(input.x) > Math.abs(input.y)) return input.x > 0 ? 'right' : 'left';
  return input.y > 0 ? 'down' : 'up';
}

type Box = { minX: number; maxX: number; minY: number; maxY: number };

function footprintAt(p: Vec, config: MovementConfig): Box {
  const { halfWidth, halfHeight } = config.footprint;
  return {
    minX: p.x - halfWidth,
    maxX: p.x + halfWidth,
    minY: p.y - halfHeight,
    maxY: p.y + halfHeight,
  };
}

/** Tiles bloqueados que toca una caja (de izquierda a derecha, de arriba abajo). */
function blockedTiles(grid: CollisionGrid, box: Box): { tx: number; ty: number }[] {
  const out: { tx: number; ty: number }[] = [];
  const x0 = Math.floor(box.minX);
  const x1 = Math.floor(box.maxX - EPSILON);
  const y0 = Math.floor(box.minY);
  const y1 = Math.floor(box.maxY - EPSILON);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (isBlocked(grid, tx, ty)) out.push({ tx, ty });
    }
  }
  return out;
}

/** ¿La posición es válida para parar ahí (sin chocar)? */
export function canStandAt(grid: CollisionGrid, p: Vec, config: MovementConfig = DEFAULT_MOVEMENT) {
  return blockedTiles(grid, footprintAt(p, config)).length === 0;
}

/**
 * Avanza una posición con la intención dada durante `dtMs` (con tope), y la
 * resuelve contra la rejilla eje por eje: se desliza por las paredes en vez
 * de quedarse pegado. Nunca atraviesa un tile bloqueado.
 */
export function stepMovement(
  position: Vec,
  input: Vec,
  dtMs: number,
  grid: CollisionGrid,
  config: MovementConfig = DEFAULT_MOVEMENT,
): Vec {
  const dir = normalizeInput(input.x, input.y, config);
  const seconds = Math.max(0, Math.min(Number.isFinite(dtMs) ? dtMs : 0, config.maxStepMs)) / 1000;
  const distance = config.speedTilesPerSecond * seconds;
  if (distance === 0 || (dir.x === 0 && dir.y === 0)) return { ...position };

  // Pasos pequeños para que un salto grande (dt con tope) no brinque un tile delgado.
  const steps = Math.max(1, Math.ceil(distance / 0.25));
  let p = { ...position };
  for (let i = 0; i < steps; i++) {
    p = moveAxis(p, 'x', (dir.x * distance) / steps, grid, config);
    p = moveAxis(p, 'y', (dir.y * distance) / steps, grid, config);
  }
  return p;
}

function moveAxis(
  p: Vec,
  axis: 'x' | 'y',
  delta: number,
  grid: CollisionGrid,
  config: MovementConfig,
): Vec {
  if (delta === 0) return p;
  const next = { ...p, [axis]: p[axis] + delta };
  const hits = blockedTiles(grid, footprintAt(next, config));
  if (hits.length === 0) return next;

  const half = axis === 'x' ? config.footprint.halfWidth : config.footprint.halfHeight;
  if (delta > 0) {
    const wall = Math.min(...hits.map((h) => (axis === 'x' ? h.tx : h.ty)));
    return { ...p, [axis]: Math.max(p[axis], wall - half - EPSILON) };
  }
  const wall = Math.max(...hits.map((h) => (axis === 'x' ? h.tx : h.ty)));
  return { ...p, [axis]: Math.min(p[axis], wall + 1 + half + EPSILON) };
}

export function distance(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
