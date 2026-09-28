import type { GroundShape } from './types.ts';

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
