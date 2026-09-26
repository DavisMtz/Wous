/**
 * Rejilla de colisión autoritativa (§15): la misma que usa el servidor. Phaser
 * solo la dibuja; nunca decide. Fuera de los límites, todo está bloqueado.
 */
export type CollisionGrid = {
  readonly width: number;
  readonly height: number;
  /** 1 = bloqueado, fila por fila. */
  readonly blocked: Uint8Array;
};

export function createGrid(width: number, height: number): CollisionGrid {
  return { width, height, blocked: new Uint8Array(width * height) };
}

export function isBlocked(grid: CollisionGrid, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height) return true;
  return grid.blocked[ty * grid.width + tx] === 1;
}

export function setBlocked(grid: CollisionGrid, tx: number, ty: number, value = true): void {
  if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height) return;
  grid.blocked[ty * grid.width + tx] = value ? 1 : 0;
}

/** Bloquea un rectángulo de tiles [x, x+w) × [y, y+h). */
export function blockRect(grid: CollisionGrid, x: number, y: number, w: number, h: number): void {
  for (let ty = y; ty < y + h; ty++) {
    for (let tx = x; tx < x + w; tx++) setBlocked(grid, tx, ty);
  }
}
