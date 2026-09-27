/**
 * Rejilla de colisión autoritativa (§15): la misma que usa el servidor. Phaser
 * solo la dibuja; nunca decide. Fuera de los límites, todo está bloqueado.
 *
 * Las posiciones van en tiles; la rejilla puede ser más fina que el tile
 * (`cellsPerTile`, ADR-0013): con 4, cada celda mide un cuarto de tile y los
 * bordes en diagonal o redondos tienen el hitbox que se ve.
 */
export type CollisionGrid = {
  /** Tamaño en celdas. */
  readonly width: number;
  readonly height: number;
  readonly cellsPerTile: number;
  /** 1 = bloqueado, fila por fila (en celdas). */
  readonly blocked: Uint8Array;
};

/** Rejilla de `width × height` TILES, con `cellsPerTile` celdas por lado de tile. */
export function createGrid(width: number, height: number, cellsPerTile = 1): CollisionGrid {
  const w = width * cellsPerTile;
  const h = height * cellsPerTile;
  return { width: w, height: h, cellsPerTile, blocked: new Uint8Array(w * h) };
}

/** ¿La celda (en celdas, no en tiles) está bloqueada? */
export function isBlocked(grid: CollisionGrid, cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= grid.width || cy >= grid.height) return true;
  return grid.blocked[cy * grid.width + cx] === 1;
}

/** Bloquea (o libera) un TILE completo: todas sus celdas. */
export function setBlocked(grid: CollisionGrid, tx: number, ty: number, value = true): void {
  const r = grid.cellsPerTile;
  for (let cy = ty * r; cy < (ty + 1) * r; cy++) {
    for (let cx = tx * r; cx < (tx + 1) * r; cx++) setCell(grid, cx, cy, value);
  }
}

export function setCell(grid: CollisionGrid, cx: number, cy: number, value = true): void {
  if (cx < 0 || cy < 0 || cx >= grid.width || cy >= grid.height) return;
  grid.blocked[cy * grid.width + cx] = value ? 1 : 0;
}

/**
 * Bloquea un rectángulo en tiles [x, x+w) × [y, y+h); acepta fracciones: se
 * bloquean las celdas cuyo centro cae dentro.
 */
export function blockRect(grid: CollisionGrid, x: number, y: number, w: number, h: number): void {
  const r = grid.cellsPerTile;
  const cx0 = Math.round(x * r);
  const cy0 = Math.round(y * r);
  const cx1 = Math.round((x + w) * r);
  const cy1 = Math.round((y + h) * r);
  for (let cy = cy0; cy < cy1; cy++) {
    for (let cx = cx0; cx < cx1; cx++) setCell(grid, cx, cy);
  }
}

/** Bloquea las celdas cuyo centro cae dentro de la función (en tiles). */
export function blockWhere(
  grid: CollisionGrid,
  bounds: { x0: number; y0: number; x1: number; y1: number },
  inside: (x: number, y: number) => boolean,
): void {
  const r = grid.cellsPerTile;
  const cx0 = Math.max(0, Math.floor(bounds.x0 * r));
  const cy0 = Math.max(0, Math.floor(bounds.y0 * r));
  const cx1 = Math.min(grid.width, Math.ceil(bounds.x1 * r));
  const cy1 = Math.min(grid.height, Math.ceil(bounds.y1 * r));
  for (let cy = cy0; cy < cy1; cy++) {
    for (let cx = cx0; cx < cx1; cx++) {
      if (inside((cx + 0.5) / r, (cy + 0.5) / r)) setCell(grid, cx, cy);
    }
  }
}
