import type { GroundKind } from '../types.ts';

/** Ayuda para escribir el suelo de un mapa por rectángulos, de fondo a frente. */
export function groundBuilder(width: number, height: number, base: GroundKind) {
  const cells: GroundKind[] = Array.from({ length: width * height }, () => base);
  const api = {
    fill(x: number, y: number, w: number, h: number, kind: GroundKind) {
      for (let ty = y; ty < y + h; ty++) {
        for (let tx = x; tx < x + w; tx++) {
          if (tx >= 0 && ty >= 0 && tx < width && ty < height) cells[ty * width + tx] = kind;
        }
      }
      return api;
    },
    build(): GroundKind[] {
      return cells;
    },
  };
  return api;
}
