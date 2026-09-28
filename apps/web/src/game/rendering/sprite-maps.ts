/**
 * Mapas de pixel art del personaje: 16×32 px por cuadro. Cada carácter es una
 * REGIÓN, no un color; la ropa y la piel deciden el color al componer.
 *
 * Cuerpo:  H/h cabeza y cuello (base/sombra) · E ojo · P/p manos
 *          T/t torso · A/a hombro y brazo · F/f antebrazo
 *          W/w cadera · U/u muslo · L/l pierna · S/s pie
 * Cabello: X base · x sombra · o luz · B/b capa de atrás (detrás del cuerpo)
 * Accesorio: K base · k sombra · G cristal · Y metal
 *
 * La vista 'left' se dibuja mirando a la izquierda; 'right' es su espejo.
 */

export type MapDirection = 'down' | 'up' | 'left';
export type Frame = 0 | 1 | 2 | 3;

const E16 = '................';

/** Rellena con filas vacías hasta `total`, para escribir solo lo necesario. */
function rows(start: number, lines: string[], total = 32): string[] {
  const out = Array.from({ length: total }, () => E16);
  lines.forEach((line, i) => {
    out[start + i] = line;
  });
  return out;
}

// ─── Cuerpo: parte de arriba (filas 0–20) ────────────────────────────────

const HEAD_DOWN = [
  '.....HHHHHH.....',
  '....HHHHHHHH....',
  '....HHHHHHHH....',
  '....HHHHHHHH....',
  '...HHHEHHEHHh...',
  '...HHHEHHEHHh...',
  '....HHHHHHHh....',
  '....HHHHHHhh....',
  '.....hHHHHh.....',
  '.......Hh.......',
];

const HEAD_UP = [
  '.....HHHHHH.....',
  '....HHHHHHHH....',
  '....HHHHHHHH....',
  '....HHHHHHHH....',
  '...HHHHHHHHHh...',
  '...HHHHHHHHHh...',
  '....HHHHHHHh....',
  '....HHHHHHhh....',
  '.....hHHHHh.....',
  '.......Hh.......',
];

const HEAD_LEFT = [
  '.....HHHHHH.....',
  '....HHHHHHHH....',
  '....HHHHHHHH....',
  '....HHHHHHHH....',
  '...HHEHHHHHh....',
  '....HEHHHhHh....',
  '....HHHHHHHh....',
  '.....HHHHHhh....',
  '......hHHHh.....',
  '.......Hh.......',
];

const TORSO_FRONT = [
  '...AATTTTTtaa...',
  '...AATTTTTtaa...',
  '...AATTTTTtaa...',
  '...FFTTTTTtff...',
  '...FFTTTTTtff...',
  '...FFTTTTTtff...',
  '...PPWWWWWwpp...',
];

const TORSO_SIDE: Record<'neutral' | 'forward' | 'back', string[]> = {
  neutral: [
    '.....TAATt......',
    '.....TAATt......',
    '.....TAATt......',
    '.....TFFTt......',
    '.....TFFTt......',
    '.....TFFTt......',
    '.....WPPWw......',
  ],
  forward: [
    '.....TAATt......',
    '.....AATTt......',
    '....AATTTt......',
    '...FFTTTTt......',
    '..FF.TTTTt......',
    '..PP.TTTTt......',
    '.....WWWWw......',
  ],
  back: [
    '.....TAATt......',
    '.....TTAAt......',
    '.....TTTAAa.....',
    '.....TTTTtFf....',
    '.....TTTTt.Ff...',
    '.....TTTTt.Pp...',
    '.....WWWWw......',
  ],
};

// ─── Cuerpo: parte de abajo (filas 21–31), una por cuadro ──────────────────

const LEGS_FRONT: Record<Frame, string[]> = {
  0: [
    '...PPUUUuuupp...',
    '.....UUUuuu.....',
    '.....UUUuuu.....',
    '.....UUUuuu.....',
    '.....LLLlll.....',
    '.....LLLlll.....',
    '.....LLLlll.....',
    '.....LLLlll.....',
    '....SSSSssss....',
    '....SSSSssss....',
    E16,
  ],
  1: [
    '...PPUUUuuupp...',
    '.....UUUuuu.....',
    '.....UUUuuu.....',
    '.....UUUuuu.....',
    '.....LLLlll.....',
    '.....LLLlll.....',
    '.....LLLlll.....',
    '....SSSSlll.....',
    '....SSSSssss....',
    '........ssss....',
    E16,
  ],
  2: [],
  3: [
    '...PPUUUuuupp...',
    '.....UUUuuu.....',
    '.....UUUuuu.....',
    '.....UUUuuu.....',
    '.....LLLlll.....',
    '.....LLLlll.....',
    '.....LLLlll.....',
    '.....LLLssss....',
    '....SSSSssss....',
    '....SSSS........',
    E16,
  ],
};
LEGS_FRONT[2] = LEGS_FRONT[0];

const LEGS_SIDE: Record<Frame, string[]> = {
  0: [
    '.....UUUu.......',
    '.....UUUu.......',
    '.....UUUu.......',
    '.....UUUu.......',
    '.....LLLl.......',
    '.....LLLl.......',
    '.....LLLl.......',
    '.....LLLl.......',
    '....SSSSs.......',
    '....SSSSs.......',
    E16,
  ],
  1: [
    '.....UUUu.......',
    '.....UUuu.......',
    '....UUU.uu......',
    '....UUU..uu.....',
    '...LLL...ll.....',
    '...LLL....ll....',
    '...LL.....ll....',
    '..LLL......ll...',
    '.SSSS.....ssss..',
    '.SSSS......sss..',
    E16,
  ],
  2: [],
  // Zancada contraria: la pierna cercana va atrás (colores intercambiados).
  3: [
    '.....uuuU.......',
    '.....uuUU.......',
    '....uuu.UU......',
    '....uuu..UU.....',
    '...lll...LL.....',
    '...lll....LL....',
    '...ll.....LL....',
    '..lll......LL...',
    '.ssss.....SSSS..',
    '.ssss......SSS..',
    E16,
  ],
};
LEGS_SIDE[2] = LEGS_SIDE[0];

/**
 * Piernas sentado (ADR-0013): filas 25–31 del cuadro. El resto del cuerpo es
 * el de pie, bajado 4 px (ver `composeSittingFrame`). De frente, las rodillas
 * vienen hacia ti; de espaldas, las tapa el respaldo; de lado, el muslo va
 * al frente y la espinilla baja al piso.
 */
export const SIT_LEGS: Record<MapDirection, string[]> = {
  down: [
    '....UUUUuuuu....',
    '....UUUUuuuu....',
    '....LLL..lll....',
    '....LLL..lll....',
    '...SSSS..ssss...',
    '...SSSS..ssss...',
    E16,
  ],
  up: ['.....WWWWww.....', '....UUUUuuuu....', E16, E16, E16, E16, E16],
  left: [
    '..UUUUUUUu......',
    '..UUUUUUuu......',
    '..LLl...........',
    '..LLl...........',
    '..LLl...........',
    '.SSSs...........',
    E16,
  ],
};

const HEAD_ROWS: Record<MapDirection, string[]> = {
  down: HEAD_DOWN,
  up: HEAD_UP,
  left: HEAD_LEFT,
};

/** Cuerpo completo de 32 filas para una dirección y un cuadro. */
export function bodyMap(direction: MapDirection, frame: Frame): string[] {
  const out = Array.from({ length: 32 }, () => E16);
  HEAD_ROWS[direction].forEach((line, i) => {
    out[4 + i] = line;
  });
  const torso =
    direction === 'left'
      ? TORSO_SIDE[frame === 1 ? 'forward' : frame === 3 ? 'back' : 'neutral']
      : TORSO_FRONT;
  torso.forEach((line, i) => {
    out[14 + i] = line;
  });
  const legs = direction === 'left' ? LEGS_SIDE[frame] : LEGS_FRONT[frame];
  legs.forEach((line, i) => {
    out[21 + i] = line;
  });
  return out;
}

// ─── Cabello ─────────────────────────────────────────────────────────────

export const HAIR_STYLES = ['corto', 'largo', 'chino', 'coleta', 'chongo', 'rapado'] as const;
export type HairStyleId = (typeof HAIR_STYLES)[number];

const CORTO_DOWN = [
  '.....oXXXXx.....',
  '....oXXXXXXx....',
  '...oXXXXXXXXx...',
  '...XXXXXXXXXx...',
  '...XX......Xx...',
];
const CORTO_UP = [
  '.....oXXXXx.....',
  '....oXXXXXXx....',
  '...oXXXXXXXXx...',
  '...XXXXXXXXXx...',
  '...XXXXXXXXXx...',
  '....XXXXXXXx....',
  '....XXXXXXXx....',
  '.....XXXXXx.....',
  '......xxxx......',
];
const CORTO_LEFT = [
  '.....oXXXXx.....',
  '....oXXXXXXx....',
  '...oXXXXXXXXx...',
  '...XXXXXXXXXx...',
  '....X..XXXXXx...',
  '.........XXXx...',
  '..........Xx....',
];

const BUN_TOP = ['......oXXx......', '......XXXx......'];

export const HAIR_MAPS: Record<HairStyleId, Record<MapDirection, string[]>> = {
  corto: {
    down: rows(3, CORTO_DOWN),
    up: rows(3, CORTO_UP),
    left: rows(3, CORTO_LEFT),
  },
  largo: {
    down: rows(3, [
      '.....oXXXXx.....',
      '....oXXXXXXx....',
      '...oXXXXXXXXx...',
      '...XXXXXXXXXx...',
      '...XXX....XXx...',
      '...X........x...',
      '...X........x...',
      '...X........x...',
      '...XX......xx...',
      '...XBBBBBBBBx...',
      '...XBBBBBBBBx...',
      '...XX......xx...',
      '...xX......xx...',
    ]),
    up: rows(3, [
      '.....oXXXXx.....',
      '....oXXXXXXx....',
      '...oXXXXXXXXx...',
      '...XXXXXXXXXx...',
      '...XXXXXXXXXx...',
      '...XXXXXXXXXx...',
      '...XXXXXXXXXx...',
      '...XXXXXXXXXx...',
      '...XXXXXXXXXx...',
      '...XXXXXXXXXx...',
      '....XXXXXXXx....',
      '....XXXXXXXx....',
      '....XXXXXXXx....',
      '.....xXXXXx.....',
      '......xxxx......',
    ]),
    left: rows(3, [
      '.....oXXXXx.....',
      '....oXXXXXXx....',
      '...oXXXXXXXXx...',
      '...XXXXXXXXXx...',
      '....X..XXXXXx...',
      '.......XXXXXx...',
      '.......XXXXXx...',
      '.......XXXXXx...',
      '........XXXXx...',
      '........XXXXx...',
      '........XXXx....',
      '.........XXx....',
      '.........Xx.....',
    ]),
  },
  chino: {
    down: rows(1, [
      '......oXXo......',
      '....oXXXXXXo....',
      '...oXXXoXXXXx...',
      '..oXXXXXXXXXXx..',
      '..XXXXXXXXXXXx..',
      '..XXXXXXXXXXXx..',
      '..XXX......XXx..',
      '..XX........xx..',
      '..xX........xx..',
      '...x........x...',
    ]),
    up: rows(1, [
      '......oXXo......',
      '....oXXXXXXo....',
      '...oXXXoXXXXx...',
      '..oXXXXXXXXXXx..',
      '..XXXXXXXXXXXx..',
      '..XXXXXXXXXXXx..',
      '..XXXXXXXXXXXx..',
      '..XXXXXXXXXXXx..',
      '..xXXXXXXXXXxx..',
      '...xXXXXXXXXx...',
      '....xxXXXXxx....',
    ]),
    left: rows(1, [
      '......oXXo......',
      '....oXXXXXXo....',
      '...oXXXoXXXXx...',
      '..oXXXXXXXXXXx..',
      '..XXXXXXXXXXXx..',
      '..XXXXXXXXXXXx..',
      '..XX...XXXXXXx..',
      '..X.....XXXXXx..',
      '........XXXXxx..',
      '.........XXxx...',
    ]),
  },
  coleta: {
    down: rows(3, [
      '.....oXXXXx.....',
      '....oXXXXXXx....',
      '....XXXXXXXXx...',
      '....XXXXXXXXxBB.',
      '....X......XxBB.',
      '............bB..',
      '............bb..',
    ]),
    up: rows(3, [
      '.....oXXXXx.....',
      '....oXXXXXXx....',
      '...oXXXXXXXXx...',
      '...XXXXXXXXXx...',
      '...XXXXXXXXXx...',
      '....XXXXXXXx....',
      '....XXXXXXXx....',
      '.....XXXXXx.....',
      '......XXXx......',
      '.......Xx.......',
      '.......Xx.......',
      '.......Xx.......',
      '.......xx.......',
    ]),
    left: rows(3, [
      '.....oXXXXx.....',
      '....oXXXXXXx....',
      '...oXXXXXXXXx...',
      '...XXXXXXXXXxXX.',
      '....X..XXXXXxXX.',
      '.........XXXxXx.',
      '..........Xx.Xx.',
      '.............Xx.',
      '.............xx.',
    ]),
  },
  chongo: {
    down: rows(1, [...BUN_TOP, ...CORTO_DOWN]),
    up: rows(1, [...BUN_TOP, ...CORTO_UP]),
    left: rows(1, ['.........oXx....', '.........XXx....', ...CORTO_LEFT]),
  },
  rapado: {
    down: rows(4, ['.....xxxxxx.....', '....xXXXXXXx....', '....x......x....']),
    up: rows(4, [
      '.....xxxxxx.....',
      '....xXXXXXXx....',
      '....xXXXXXXx....',
      '....xXXXXXXx....',
      '.....xxxxxx.....',
    ]),
    left: rows(4, ['.....xxxxxx.....', '....xXXXXXXx....', '....x..XXXXx....', '.........xx.....']),
  },
};

// ─── Accesorios ──────────────────────────────────────────────────────────

export const ACCESSORIES = ['lentes', 'gorra', 'aretes', 'audifonos'] as const;
export type AccessoryId = (typeof ACCESSORIES)[number];

export const ACCESSORY_MAPS: Record<AccessoryId, Record<MapDirection, string[]>> = {
  lentes: {
    down: rows(8, ['.....K.KK.K.....', '.....KGKKGK.....']),
    up: rows(8, ['...K........K...']),
    left: rows(8, ['...KK.KKKK......', '....KGK.........']),
  },
  gorra: {
    down: rows(2, [
      '.....KKKKKK.....',
      '....KKKKKKKKk...',
      '...KKKKYKKKKk...',
      '...kkkkkkkkkk...',
      '..kkkkkkkkkkkk..',
    ]),
    up: rows(2, [
      '.....KKKKKK.....',
      '....KKKKKKKKk...',
      '...KKKKKKKKKk...',
      '...KKKKKKKKKk...',
      '...KKKKYYKKKk...',
    ]),
    left: rows(2, [
      '.....KKKKKK.....',
      '....KKKKKKKKk...',
      '...KKKKKKKYKk...',
      '...kkkkkkkkkk...',
      'kkkkk...........',
    ]),
  },
  aretes: {
    down: rows(10, ['...Y........Y...']),
    up: rows(10, ['...Y........Y...']),
    left: rows(10, ['.........Y......']),
  },
  audifonos: {
    down: rows(3, [
      '....kKKKKKKk....',
      '...K........K...',
      '...K........K...',
      '...K........K...',
      '..KKk......kKK..',
      '..KKk......kKK..',
      '..kkk......kkk..',
    ]),
    up: rows(3, [
      '....kKKKKKKk....',
      '...K........K...',
      '...K........K...',
      '...K........K...',
      '..KKk......kKK..',
      '..KKk......kKK..',
      '..kkk......kkk..',
    ]),
    left: rows(3, [
      '....kKKKKKKk....',
      '..........K.....',
      '..........K.....',
      '.........KKk....',
      '........KKKKk...',
      '........KKKKk...',
      '.........kkk....',
    ]),
  },
};
