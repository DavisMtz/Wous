import { type CollisionGrid, canStandAt, type Vec } from '@wous/game-core';
import type { MapId } from '@wous/world-data';
import { hash } from '../world-art/paint.ts';

/**
 * Las palomas de la Plaza: parvadas que picotean en el piso y vuelan cuando
 * alguien se acerca (investigacion.md §2.9). Son solo ambiente: cada teléfono
 * las ve a su modo y la sala no se entera. Aquí va lo que no depende de
 * Phaser: dónde se posa cada parvada y cuándo se asusta.
 */

export type Parvada = { id: string; x: number; y: number; n: number };

/** Sobre piso abierto, lejos de rejas y bancas: el atrio, las plazas, los andadores. */
export const PARVADAS: Partial<Record<MapId, readonly Parvada[]>> = {
  plaza: [
    { id: 'atrio', x: 74, y: 83, n: 7 },
    { id: 'atrio-poniente', x: 100, y: 64, n: 6 },
    { id: 'juarez', x: 126.5, y: 38, n: 8 },
    { id: 'andador', x: 137.2, y: 70, n: 5 },
    { id: 'kiosko', x: 168, y: 72.5, n: 6 },
    { id: 'fuente-armas', x: 153.2, y: 82.2, n: 5 },
    { id: 'ocampo', x: 24, y: 58, n: 8 },
    { id: 'danzantes', x: 30, y: 80, n: 6 },
  ],
};

/** Qué tan cerca (tiles) se deja acercar una paloma antes de volar. */
export const RADIO_SUSTO = 1.8;
/** Qué tan lejos de su centro se reparte la parvada (tiles). */
const RADIO_PARVADA = 1.5;

/**
 * Dónde se para cada paloma de una parvada: repartidas al azar (pero siempre
 * igual) alrededor de su centro, solo donde se puede estar.
 */
export function lugaresDeParvada(p: Parvada, grid: CollisionGrid): Vec[] {
  const lugares: Vec[] = [];
  for (let i = 0; lugares.length < p.n && i < p.n * 6; i++) {
    const a = hash(i, 1, p.x * 31 + p.y) * Math.PI * 2;
    const r = Math.sqrt(hash(i, 2, p.x * 31 + p.y)) * RADIO_PARVADA;
    const lugar = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * 0.8 };
    if (canStandAt(grid, lugar)) lugares.push(lugar);
  }
  return lugares;
}

/** ¿Alguien quedó demasiado cerca de alguna paloma? Devuelve a quién. */
export function quienAsusta(palomas: readonly Vec[], gente: readonly Vec[]): Vec | null {
  for (const persona of gente) {
    for (const paloma of palomas) {
      if (Math.hypot(persona.x - paloma.x, persona.y - paloma.y) < RADIO_SUSTO) return persona;
    }
  }
  return null;
}

/**
 * Hacia dónde sale volando una paloma: lejos de quien la asustó, siempre
 * hacia arriba de la pantalla (se van a las cornisas), en pixeles por segundo.
 */
export function rumboDeHuida(paloma: Vec, susto: Vec, semilla: number): Vec {
  const dx = paloma.x - susto.x;
  const dy = paloma.y - susto.y;
  const d = Math.hypot(dx, dy) || 1;
  const lado = (dx / d) * 70 + (hash(semilla, 3, 7) - 0.5) * 50;
  const arriba = -90 - hash(semilla, 4, 7) * 60 + Math.min(0, (dy / d) * 30);
  return { x: lado, y: arriba };
}
