import {
  blockRect,
  type CollisionGrid,
  canStandAt,
  createGrid,
  distance,
  setBlocked,
  type Vec,
} from '@wous/game-core';
import { CAFE } from './maps/cafe.ts';
import { PLAZA } from './maps/plaza.ts';
import {
  BLOCKING_GROUND,
  type MapDef,
  type MapId,
  NON_SOLID,
  type Portal,
  type SpawnPoint,
} from './types.ts';

export * from './types.ts';
export { CAFE, PLAZA };

export const MAPS: Readonly<Record<MapId, MapDef>> = { plaza: PLAZA, cafe: CAFE };

/** El mapa donde entra quien llega por primera vez. */
export const STARTING_MAP: MapId = 'plaza';

export function getMap(id: string): MapDef | undefined {
  return (MAPS as Record<string, MapDef>)[id];
}

/** Spawn por nombre; si no existe, el por defecto (validateWorld garantiza que ese sí). */
export function spawnOf(map: MapDef, name?: string): SpawnPoint {
  const spawn = (name && map.spawns[name]) || map.spawns[map.defaultSpawn];
  if (!spawn) throw new Error(`El mapa ${map.id} no tiene spawn por defecto`);
  return spawn;
}

export function portalOf(map: MapDef, id: string): Portal {
  const portal = map.portals.find((p) => p.id === id);
  if (!portal) throw new Error(`El mapa ${map.id} no tiene el portal ${id}`);
  return portal;
}

/** Rejilla autoritativa del mapa: suelo que bloquea + objetos sólidos. */
export function buildCollisionGrid(map: MapDef): CollisionGrid {
  const grid = createGrid(map.width, map.height);
  map.ground.forEach((kind, i) => {
    if (BLOCKING_GROUND.has(kind)) setBlocked(grid, i % map.width, Math.floor(i / map.width));
  });
  for (const o of map.objects) {
    if (!NON_SOLID.has(o.kind)) blockRect(grid, o.x, o.y, o.w, o.h);
  }
  return grid;
}

const grids = new Map<MapId, CollisionGrid>();

/** Rejilla cacheada (los mapas son inmutables en tiempo de ejecución). */
export function collisionGrid(map: MapDef): CollisionGrid {
  let grid = grids.get(map.id);
  if (!grid) {
    grid = buildCollisionGrid(map);
    grids.set(map.id, grid);
  }
  return grid;
}

/** ¿Los pies están lo bastante cerca del portal para usarlo? (§16) */
export function canReachPortal(position: Vec, portal: Portal): boolean {
  return distance(position, portal) <= portal.reach;
}

export function nearestPortal(map: MapDef, position: Vec): Portal | null {
  let best: Portal | null = null;
  for (const portal of map.portals) {
    if (
      canReachPortal(position, portal) &&
      (!best || distance(position, portal) < distance(position, best))
    ) {
      best = portal;
    }
  }
  return best;
}

/**
 * Integridad del mundo: dimensiones, IDs únicos, objetos dentro del mapa,
 * spawns donde se puede estar y portales que llevan a un lugar que existe y
 * se pueden alcanzar a pie. Devuelve la lista de problemas (vacía = válido).
 */
export function validateWorld(maps: Readonly<Record<string, MapDef>> = MAPS): string[] {
  const problems: string[] = [];
  for (const map of Object.values(maps)) {
    const where = `mapa ${map.id}`;
    if (map.ground.length !== map.width * map.height) {
      problems.push(`${where}: el suelo no mide ${map.width}×${map.height}`);
    }
    const ids = new Set<string>();
    for (const o of map.objects) {
      if (ids.has(o.id)) problems.push(`${where}: objeto repetido ${o.id}`);
      ids.add(o.id);
      if (o.x < 0 || o.y < 0 || o.x + o.w > map.width || o.y + o.h > map.height) {
        problems.push(`${where}: ${o.id} se sale del mapa`);
      }
    }
    const grid = buildCollisionGrid(map);
    if (!map.spawns[map.defaultSpawn]) problems.push(`${where}: falta el spawn por defecto`);
    for (const [id, spawn] of Object.entries(map.spawns)) {
      if (!canStandAt(grid, spawn)) problems.push(`${where}: el spawn ${id} cae en algo sólido`);
    }
    for (const portal of map.portals) {
      const target = maps[portal.to.map];
      if (!target) problems.push(`${where}: el portal ${portal.id} va a un mapa que no existe`);
      else if (!target.spawns[portal.to.spawn]) {
        problems.push(`${where}: el portal ${portal.id} va a un spawn que no existe`);
      }
      // Alcanzable: algún punto caminable dentro del radio.
      let reachable = false;
      for (let dy = -portal.reach; dy <= portal.reach && !reachable; dy += 0.1) {
        for (let dx = -portal.reach; dx <= portal.reach && !reachable; dx += 0.1) {
          const p = { x: portal.x + dx, y: portal.y + dy };
          if (canReachPortal(p, portal) && canStandAt(grid, p)) reachable = true;
        }
      }
      if (!reachable) problems.push(`${where}: el portal ${portal.id} no se alcanza a pie`);
    }
  }
  return problems;
}
