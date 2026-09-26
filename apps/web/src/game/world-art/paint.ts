/**
 * Pincel del mundo: un canvas a 1× donde un pixel de arte es un pixel. El
 * suelo y los objetos de la Plaza se pintan aquí y Phaser los recibe como
 * texturas (ADR-0007). Todo el azar es determinista: la misma coordenada
 * siempre da la misma piedra, la misma flor, la misma grieta.
 */

export type Painter = {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly w: number;
  readonly h: number;
  rect(x: number, y: number, w: number, h: number, color: string): void;
  px(x: number, y: number, color: string): void;
  /** Línea horizontal de `len` pixeles. */
  hline(x: number, y: number, len: number, color: string): void;
  vline(x: number, y: number, len: number, color: string): void;
  /** Elipse rellena (para sombras y copas), recortada a pixeles enteros. */
  ellipse(cx: number, cy: number, rx: number, ry: number, color: string): void;
};

export function painter(w: number, h: number): Painter {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  if (!ctx) throw new Error('Canvas 2D no disponible');
  ctx.imageSmoothingEnabled = false;
  const rect = (x: number, y: number, rw: number, rh: number, color: string) => {
    if (rw <= 0 || rh <= 0) return;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(rw), Math.round(rh));
  };
  return {
    canvas,
    ctx,
    w,
    h,
    rect,
    px: (x, y, color) => rect(x, y, 1, 1, color),
    hline: (x, y, len, color) => rect(x, y, len, 1, color),
    vline: (x, y, len, color) => rect(x, y, 1, len, color),
    ellipse(cx, cy, rx, ry, color) {
      ctx.fillStyle = color;
      for (let y = Math.ceil(-ry); y <= Math.floor(ry); y++) {
        const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
        if (half > 0) ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2, 1);
      }
    },
  };
}

/** Azar determinista en [0, 1) por coordenada y semilla. */
export function hash(x: number, y: number, seed = 0): number {
  let h =
    Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Elige de una lista con el azar de una coordenada. */
export function pick<T>(list: readonly T[], x: number, y: number, seed = 0): T {
  const item = list[Math.floor(hash(x, y, seed) * list.length)];
  if (item === undefined) throw new Error('pick: lista vacía');
  return item;
}

/**
 * Letras de rótulo de 3×5 (lo que pinta un rotulista en chiquito). Solo las
 * que usa el mundo; un carácter desconocido deja hueco.
 */
const GLYPHS: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  $: ['.##', '##.', '.#.', '.##', '##.'],
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '3': ['##.', '..#', '.#.', '..#', '##.'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '##.', '..#', '##.'],
  '9': ['###', '#.#', '###', '..#', '##.'],
  '!': ['.#.', '.#.', '.#.', '...', '.#.'],
  '.': ['...', '...', '...', '...', '.#.'],
  ' ': ['...', '...', '...', '...', '...'],
};

/** Ancho en pixeles de un texto de rótulo (3 por letra + 1 de aire), a escala. */
export function signWidth(text: string, scale = 1): number {
  return (text.length * 4 - 1) * scale;
}

/** Pinta un texto de rótulo. La tilde de «É» va arriba de la letra. */
export function sign(
  p: Painter,
  text: string,
  x: number,
  y: number,
  color: string,
  scale = 1,
): void {
  let cx = x;
  for (const raw of text) {
    const accent = raw === 'É';
    const glyph = GLYPHS[accent ? 'E' : raw.toUpperCase()] ?? GLYPHS[' '];
    glyph?.forEach((row, gy) => {
      for (let gx = 0; gx < 3; gx++) {
        if (row[gx] === '#') p.rect(cx + gx * scale, y + gy * scale, scale, scale, color);
      }
    });
    if (accent) p.rect(cx + 2 * scale, y - 2 * scale, scale, scale, color);
    cx += 4 * scale;
  }
}
