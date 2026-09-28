import { painter } from './paint.ts';

/**
 * Las palomas de la Plaza (investigacion.md §2.9): gris azulado con el cuello
 * tornasol verde y morado, alguna más oscura, alguna blanca, alguna café. Un
 * cuadro de 12×10 px mirando a la derecha (la escena voltea las que miran a
 * la izquierda), con los pies en la última fila.
 */

export const PALOMA_W = 12;
export const PALOMA_H = 10;

export type CuadroPaloma = 'parada' | 'picando' | 'alas-arriba' | 'alas-abajo';
export const CUADROS_PALOMA: readonly CuadroPaloma[] = [
  'parada',
  'picando',
  'alas-arriba',
  'alas-abajo',
];

/** B cuerpo · L lomo · D alas y cola · N y P el cuello tornasol · E ojo · K pico · F patas. */
const DIBUJOS: Record<CuadroPaloma, readonly string[]> = {
  parada: [
    '........BB..',
    '.......BBBB.',
    '.......BEBBK',
    '......NPB...',
    '..LLLLBBB...',
    '.BBDDBBBBB..',
    'DBBDDBBBBB..',
    '..BBBBBBB...',
    '....F..F....',
    '...FF.FF....',
  ],
  picando: [
    '............',
    '............',
    '............',
    '..LLLL......',
    '.BBDDBBNP...',
    'DBBDDBBBBBB.',
    '..BBBBBBBEB.',
    '........BBK.',
    '....F..F....',
    '...FF.FF....',
  ],
  'alas-arriba': [
    '..DD....DD..',
    '...BB..BB...',
    '....BBBB.BB.',
    '...BBBBBBEBK',
    'DDBBBBBBNB..',
    '..BBBBBBB...',
    '............',
    '............',
    '............',
    '............',
  ],
  'alas-abajo': [
    '............',
    '............',
    '........BB..',
    '..BBBBBBBEBK',
    'DDBBBBBBNB..',
    '..BBBBBBB...',
    '...BB..BB...',
    '..DD....DD..',
    '............',
    '............',
  ],
};

type Pinta = Record<'B' | 'L' | 'D' | 'N' | 'P' | 'E' | 'K' | 'F', string>;

const COMUN = { N: '#4f8f6e', P: '#7a5a8f', E: '#141116', K: '#3a3238', F: '#c7707a' };

/** Las pintas: la común, una oscura, una blanca y una café rojiza. */
export const PINTAS: readonly Pinta[] = [
  { ...COMUN, B: '#8f96a3', L: '#b3b9c4', D: '#4c525e' },
  { ...COMUN, B: '#6f7582', L: '#8f96a3', D: '#3a3f49' },
  { ...COMUN, B: '#e6e3dc', L: '#f7f5f0', D: '#a9a39a', N: '#9fc2ae', P: '#b9a6c6' },
  { ...COMUN, B: '#9a7a68', L: '#b8998a', D: '#5e4538' },
];

export function paloma(cuadro: CuadroPaloma, pinta: number): HTMLCanvasElement {
  const p = painter(PALOMA_W, PALOMA_H);
  const colores = PINTAS[pinta % PINTAS.length] ?? PINTAS[0];
  DIBUJOS[cuadro].forEach((fila, y) => {
    for (let x = 0; x < PALOMA_W; x++) {
      const c = fila[x] as keyof Pinta | '.' | undefined;
      if (!c || c === '.' || !colores) continue;
      p.px(x, y, colores[c]);
    }
  });
  return p.canvas;
}
