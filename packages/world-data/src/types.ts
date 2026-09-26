import type { Facing } from '@wous/game-core';

/**
 * Esquema de un mapa (§15). El mapa visual (Phaser) y el autoritativo
 * (servidor) salen de estos mismos datos versionados.
 */

export const MAP_IDS = ['plaza', 'cafe'] as const;
export type MapId = (typeof MAP_IDS)[number];

/** Tipos de suelo. Los marcados en BLOCKING_GROUND no se pisan. */
export type GroundKind =
  | 'fachada'
  | 'banqueta'
  | 'adoquin'
  | 'ladrillo'
  | 'pasto'
  | 'seto'
  | 'calle'
  | 'duela'
  | 'pared';

export const BLOCKING_GROUND: ReadonlySet<GroundKind> = new Set([
  'fachada',
  'seto',
  'calle',
  'pared',
]);

export type ObjectKind =
  | 'kiosko'
  | 'puesto'
  | 'banca'
  | 'jacaranda'
  | 'farol'
  | 'papel-picado'
  | 'fachada-cafe'
  | 'mesa'
  | 'barra'
  | 'maceta'
  | 'tapete';

/** Objetos que se dibujan pero no estorban (van encima o son solo decoración). */
export const NON_SOLID: ReadonlySet<ObjectKind> = new Set([
  'papel-picado',
  'fachada-cafe',
  'tapete',
]);

export type MapObject = {
  id: string;
  kind: ObjectKind;
  /** Huella en tiles: esquina superior izquierda, ancho y alto. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Variación visual (color de lona, flor de la maceta…). No afecta la colisión. */
  variant?: string;
};

export type SpawnPoint = { x: number; y: number; facing: Facing };

export type Portal = {
  id: string;
  /** Centro del portal en tiles. */
  x: number;
  y: number;
  /** Distancia máxima (tiles) desde los pies para poder usarlo (§16). */
  reach: number;
  to: { map: MapId; spawn: string };
  /** Texto del botón contextual («Entrar al Café»). */
  label: string;
};

export type MapDef = {
  id: MapId;
  version: number;
  name: string;
  width: number;
  height: number;
  /** Suelo fila por fila (width × height). */
  ground: GroundKind[];
  objects: MapObject[];
  spawns: Record<string, SpawnPoint>;
  /** Spawn para quien llega sin venir de un portal. */
  defaultSpawn: string;
  portals: Portal[];
};
