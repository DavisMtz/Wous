import {
  blockRect,
  blockWhere,
  type CollisionGrid,
  canStandAt,
  createGrid,
  distance,
  setBlocked,
  setCell,
  type Vec,
} from '@wous/game-core';
import { CAFE } from './maps/cafe.ts';
import { PLAZA } from './maps/plaza.ts';
import {
  BLOCKING_GROUND,
  BLOCKING_SHAPES,
  type GroundShape,
  type MapDef,
  type MapId,
  NON_SOLID,
  type Portal,
  type Seat,
  type Sign,
  type SolidPart,
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

export function seatOf(map: MapDef, id: string): Seat | undefined {
  return map.seats.find((s) => s.id === id);
}

/**
 * Rejilla autoritativa del mapa: suelo que bloquea + objetos sólidos (toda
 * su huella, o solo sus partes `solid` si las declara).
 */
export function buildCollisionGrid(map: MapDef): CollisionGrid {
  const grid = createGrid(map.width, map.height, map.cellsPerTile);
  map.ground.forEach((kind, i) => {
    if (BLOCKING_GROUND.has(kind)) setBlocked(grid, i % map.width, Math.floor(i / map.width));
  });
  // Formas: en cada celda manda la última que la cubre (un andador pintado
  // encima de un jardín lo abre). Solo estorban las que quedan arriba y son `jardin`.
  const r = grid.cellsPerTile;
  const top = new Int16Array(grid.width * grid.height).fill(-1);
  map.paint.forEach((shape, index) => {
    const [x0, y0, x1, y1] = shapeBounds(shape);
    const cx0 = Math.max(0, Math.floor(x0 * r));
    const cy0 = Math.max(0, Math.floor(y0 * r));
    const cx1 = Math.min(grid.width, Math.ceil(x1 * r));
    const cy1 = Math.min(grid.height, Math.ceil(y1 * r));
    for (let cy = cy0; cy < cy1; cy++) {
      for (let cx = cx0; cx < cx1; cx++) {
        if (insideShape(shape, (cx + 0.5) / r, (cy + 0.5) / r)) top[cy * grid.width + cx] = index;
      }
    }
  });
  top.forEach((index, cell) => {
    const shape = index >= 0 ? map.paint[index] : undefined;
    if (shape && BLOCKING_SHAPES.has(shape.kind)) {
      setCell(grid, cell % grid.width, Math.floor(cell / grid.width));
    }
  });
  for (const o of map.objects) {
    if (NON_SOLID.has(o.kind)) continue;
    if (!o.solid) {
      blockRect(grid, o.x, o.y, o.w, o.h);
      continue;
    }
    for (const part of o.solid) blockPart(grid, o.x, o.y, part);
  }
  return grid;
}

function blockPart(grid: CollisionGrid, ox: number, oy: number, part: SolidPart): void {
  if ('circle' in part) {
    const { x, y, r } = part.circle;
    const cx = ox + x;
    const cy = oy + y;
    blockWhere(
      grid,
      { x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r },
      (px, py) => (px - cx) ** 2 + (py - cy) ** 2 <= r * r,
    );
    return;
  }
  blockRect(grid, ox + part.x, oy + part.y, part.w, part.h);
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

/** ¿Los pies están lo bastante cerca del asiento (o de donde se levanta uno) para sentarse? */
export function canReachSeat(position: Vec, seat: Seat, reach: number): boolean {
  return Math.min(distance(position, seat), distance(position, seat.exit)) <= reach;
}

export function canReachSign(position: Vec, sign: Sign): boolean {
  return distance(position, sign) <= sign.reach;
}

/** Lo que se puede hacer desde aquí, del más cercano al más lejano. */
export type Nearby =
  | { type: 'portal'; portal: Portal; distance: number }
  | { type: 'seat'; seat: Seat; distance: number }
  | { type: 'sign'; sign: Sign; distance: number };

/**
 * Lo más cercano con lo que se puede interactuar: puerta, asiento libre o
 * letrero. `seatFree` dice si un asiento está libre (lo sabe quien pregunta).
 */
export function nearestInteraction(
  map: MapDef,
  position: Vec,
  seatReach: number,
  seatFree: (seat: Seat) => boolean = () => true,
): Nearby | null {
  let best: Nearby | null = null;
  const offer = (candidate: Nearby) => {
    if (!best || candidate.distance < best.distance) best = candidate;
  };
  for (const portal of map.portals) {
    if (canReachPortal(position, portal)) {
      offer({ type: 'portal', portal, distance: distance(position, portal) });
    }
  }
  for (const seat of map.seats) {
    if (!canReachSeat(position, seat, seatReach) || !seatFree(seat)) continue;
    offer({ type: 'seat', seat, distance: distance(position, seat.exit) });
  }
  for (const sign of map.signs) {
    if (canReachSign(position, sign)) {
      offer({ type: 'sign', sign, distance: distance(position, sign) });
    }
  }
  return best;
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
 * se pueden alcanzar a pie. Desde el spawn por defecto se tiene que poder
 * caminar a todo: los otros spawns, cada puerta, cada asiento y cada letrero
 * (una reja mal cerrada no deja a nadie encerrado). Devuelve la lista de
 * problemas (vacía = válido).
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
    for (const o of map.objects) {
      for (const part of o.solid ?? []) {
        const [x0, y0, x1, y1] =
          'circle' in part
            ? [
                part.circle.x - part.circle.r,
                part.circle.y - part.circle.r,
                part.circle.x + part.circle.r,
                part.circle.y + part.circle.r,
              ]
            : [part.x, part.y, part.x + part.w, part.y + part.h];
        if (x0 < -0.001 || y0 < -0.001 || x1 > o.w + 0.001 || y1 > o.h + 0.001) {
          problems.push(`${where}: lo sólido de ${o.id} se sale de su huella`);
        }
      }
    }
    const seatIds = new Set<string>();
    for (const seat of map.seats) {
      if (seatIds.has(seat.id)) problems.push(`${where}: asiento repetido ${seat.id}`);
      seatIds.add(seat.id);
      if (!ids.has(seat.object)) problems.push(`${where}: el asiento ${seat.id} no tiene objeto`);
      if (seat.x < 0 || seat.y < 0 || seat.x > map.width || seat.y > map.height) {
        problems.push(`${where}: el asiento ${seat.id} se sale del mapa`);
      }
      if (!canStandAt(grid, seat.exit)) {
        problems.push(`${where}: el asiento ${seat.id} no tiene dónde levantarse`);
      }
      if (distance(seat, seat.exit) > 1.6) {
        problems.push(`${where}: la salida del asiento ${seat.id} queda lejos`);
      }
    }
    const signIds = new Set<string>();
    for (const sign of map.signs) {
      if (signIds.has(sign.id)) problems.push(`${where}: letrero repetido ${sign.id}`);
      signIds.add(sign.id);
      if (!reachableWithin(grid, sign, sign.reach)) {
        problems.push(`${where}: el letrero ${sign.id} no se alcanza a pie`);
      }
    }
    for (const shape of map.paint) {
      const over = shapeTiles(shape, map);
      const street = shape.kind === 'cebra';
      for (const [tx, ty] of over) {
        const kind = map.ground[ty * map.width + tx];
        const blocking = kind === undefined || BLOCKING_GROUND.has(kind);
        if (street ? kind !== 'calle' : blocking) {
          problems.push(
            `${where}: una forma de ${shape.kind} cae en ${kind ?? 'fuera'} (${tx},${ty})`,
          );
          break;
        }
      }
    }
    for (const zone of map.cameraZones) {
      if (zone.x < 0 || zone.y < 0 || zone.x + zone.w > map.width || zone.y + zone.h > map.height) {
        problems.push(`${where}: un encuadre se sale del mapa`);
      }
    }
    for (const portal of map.portals) {
      const target = maps[portal.to.map];
      if (!target) problems.push(`${where}: el portal ${portal.id} va a un mapa que no existe`);
      else if (!target.spawns[portal.to.spawn]) {
        problems.push(`${where}: el portal ${portal.id} va a un spawn que no existe`);
      }
      if (!reachableWithin(grid, portal, portal.reach)) {
        problems.push(`${where}: el portal ${portal.id} no se alcanza a pie`);
      }
    }
    const start = map.spawns[map.defaultSpawn];
    if (start && canStandAt(grid, start)) {
      const walk = walkableFrom(grid, start);
      const from = `desde ${map.defaultSpawn}`;
      for (const [id, spawn] of Object.entries(map.spawns)) {
        if (!walk.near(spawn, 0.35))
          problems.push(`${where}: el spawn ${id} no se alcanza ${from}`);
      }
      for (const portal of map.portals) {
        if (!walk.near(portal, portal.reach)) {
          problems.push(`${where}: el portal ${portal.id} no se alcanza ${from}`);
        }
      }
      for (const seat of map.seats) {
        if (!walk.near(seat.exit, 0.35)) {
          problems.push(`${where}: el asiento ${seat.id} no se alcanza ${from}`);
        }
      }
      for (const sign of map.signs) {
        if (!walk.near(sign, sign.reach)) {
          problems.push(`${where}: el letrero ${sign.id} no se alcanza ${from}`);
        }
      }
    }
  }
  return problems;
}

/**
 * Por dónde se puede caminar desde `start`: una malla de puntos cada cuarto
 * de tile (o cada celda, si la rejilla es más fina), unidos donde se puede
 * estar en los dos. La huella mide más que un paso de la malla, así que ir de
 * un punto al vecino solo barre las dos huellas: si ambas caben, el paso cabe.
 */
export function walkableFrom(grid: CollisionGrid, start: Vec) {
  const step = 1 / Math.max(grid.cellsPerTile, 4);
  const cols = Math.round(grid.width / grid.cellsPerTile / step) + 1;
  const rows = Math.round(grid.height / grid.cellsPerTile / step) + 1;
  // 0 = sin ver, 1 = se puede estar y se llegó, 2 = no se puede estar.
  const seen = new Uint8Array(cols * rows);
  const queue = new Int32Array(cols * rows);
  let head = 0;
  let tail = 0;
  const visit = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= cols || j >= rows) return;
    const k = j * cols + i;
    if (seen[k] !== 0) return;
    seen[k] = canStandAt(grid, { x: i * step, y: j * step }) ? 1 : 2;
    if (seen[k] === 1) queue[tail++] = k;
  };
  // Se entra a la malla por los puntos de alrededor del inicio.
  const si = Math.floor(start.x / step);
  const sj = Math.floor(start.y / step);
  for (const [di, dj] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ] as const) {
    visit(si + di, sj + dj);
  }
  while (head < tail) {
    const k = queue[head++] as number;
    const i = k % cols;
    const j = (k - i) / cols;
    visit(i + 1, j);
    visit(i - 1, j);
    visit(i, j + 1);
    visit(i, j - 1);
  }
  return {
    /** ¿Se llega a pie a menos de `radius` de `p`? */
    near(p: Vec, radius: number): boolean {
      const i0 = Math.max(0, Math.floor((p.x - radius) / step));
      const i1 = Math.min(cols - 1, Math.ceil((p.x + radius) / step));
      const j0 = Math.max(0, Math.floor((p.y - radius) / step));
      const j1 = Math.min(rows - 1, Math.ceil((p.y + radius) / step));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          if (seen[j * cols + i] !== 1) continue;
          if (Math.hypot(i * step - p.x, j * step - p.y) <= radius) return true;
        }
      }
      return false;
    },
  };
}

/**
 * Los tiles cuyo centro cae dentro de una forma (para validarla; el dibujo la
 * rasteriza por pixel). Un andador delgado que no toca ningún centro no se
 * revisa: es solo dibujo sobre lo que ya se pisa alrededor.
 */
export function shapeTiles(shape: GroundShape, map: Pick<MapDef, 'width' | 'height'>) {
  const out: [number, number][] = [];
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      if (insideShape(shape, tx + 0.5, ty + 0.5)) out.push([tx, ty]);
    }
  }
  return out;
}

/** Caja de una forma en tiles: [x0, y0, x1, y1]. */
export function shapeBounds(shape: GroundShape): [number, number, number, number] {
  if ('rect' in shape) {
    const r = shape.rect;
    return [r.x, r.y, r.x + r.w, r.y + r.h];
  }
  if ('circle' in shape) {
    const c = shape.circle;
    return [c.x - c.r, c.y - c.r, c.x + c.r, c.y + c.r];
  }
  const points = 'path' in shape ? shape.path.points : shape.polygon;
  const pad = 'path' in shape ? shape.path.width / 2 : 0;
  const xs = points.map((q) => q[0]);
  const ys = points.map((q) => q[1]);
  return [
    Math.min(...xs) - pad,
    Math.min(...ys) - pad,
    Math.max(...xs) + pad,
    Math.max(...ys) + pad,
  ];
}

/** ¿El punto (en tiles) cae dentro de la forma? */
export function insideShape(shape: GroundShape, x: number, y: number): boolean {
  if ('rect' in shape) {
    const r = shape.rect;
    return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  }
  if ('circle' in shape) {
    const c = shape.circle;
    return (x - c.x) ** 2 + (y - c.y) ** 2 <= c.r * c.r;
  }
  if ('path' in shape) {
    const { points, width } = shape.path;
    const half = width / 2;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1] as readonly [number, number];
      const b = points[i] as readonly [number, number];
      if (segmentDistance(x, y, a, b) <= half) return true;
    }
    return false;
  }
  // Polígono: par-impar.
  let inside = false;
  const pts = shape.polygon;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i] as readonly [number, number];
    const [xj, yj] = pts[j] as readonly [number, number];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segmentDistance(
  x: number,
  y: number,
  a: readonly [number, number],
  b: readonly [number, number],
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len2));
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}

/** ¿Hay algún punto caminable a menos de `reach` de `center`? */
function reachableWithin(grid: CollisionGrid, center: Vec, reach: number): boolean {
  for (let dy = -reach; dy <= reach; dy += 0.1) {
    for (let dx = -reach; dx <= reach; dx += 0.1) {
      const p = { x: center.x + dx, y: center.y + dy };
      if (distance(p, center) <= reach && canStandAt(grid, p)) return true;
    }
  }
  return false;
}
