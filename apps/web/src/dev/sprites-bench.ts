// Banco de desarrollo: dibuja todas las piezas del personaje para revisarlas a ojo.
import { HAIR_COLORS, SKIN_TONES } from '../game/rendering/palette.ts';
import {
  BOTTOM_STYLES,
  DIRECTIONS,
  type Direction,
  drawCharacter,
  type Look,
  SHOE_STYLES,
  TOP_STYLES,
  WALK_FRAMES,
} from '../game/rendering/pixel-character.ts';
import { ACCESSORIES, type Frame, HAIR_STYLES } from '../game/rendering/sprite-maps.ts';

const SCALE = 4;

const base: Look = {
  body: 'a',
  skin: 'piel-3',
  hair: 'corto',
  hairColor: 'negro',
  top: 'playera',
  topColor: 'amarillo',
  bottom: 'pantalon',
  bottomColor: 'mezclilla',
  shoes: 'tenis',
  shoesColor: 'rojo',
  accessory: null,
  accessoryColor: 'rojo',
};

function section(
  title: string,
  looks: Look[],
  directions: readonly Direction[] = DIRECTIONS,
  frames: readonly Frame[] = [0],
) {
  const h = document.createElement('h2');
  h.textContent = title;
  document.body.append(h);
  const row = document.createElement('div');
  row.className = 'fila';
  for (const look of looks) {
    for (const direction of directions) {
      for (const frame of frames) {
        const canvas = document.createElement('canvas');
        canvas.width = 16 * SCALE;
        canvas.height = 32 * SCALE;
        const ctx = canvas.getContext('2d');
        if (ctx) drawCharacter(ctx, look, direction, frame, 0, 0, SCALE);
        row.append(canvas);
      }
    }
  }
  document.body.append(row);
}

section('Direcciones', [base]);
section('Caminata (abajo e izquierda)', [base], ['down', 'left'], WALK_FRAMES);
section(
  'Peinados',
  HAIR_STYLES.map((hair, i) => ({
    ...base,
    hair,
    hairColor: Object.keys(HAIR_COLORS)[i] as Look['hairColor'],
  })),
  ['down', 'left', 'up'],
);
section(
  'Tonos de piel y complexión',
  Object.keys(SKIN_TONES).map((skin, i) => ({
    ...base,
    skin: skin as Look['skin'],
    body: i % 2 === 0 ? 'a' : 'b',
  })),
  ['down'],
);
section(
  'Partes de arriba',
  TOP_STYLES.map((top) => ({ ...base, top, topColor: 'rosa' as const })),
  ['down', 'left'],
);
section(
  'Partes de abajo y zapatos',
  BOTTOM_STYLES.flatMap((bottom, i) => ({
    ...base,
    bottom,
    bottomColor: (['mezclilla', 'caqui', 'morado', 'negro'] as const)[i] ?? 'negro',
    shoes: SHOE_STYLES[i % SHOE_STYLES.length] ?? 'tenis',
  })),
  ['down', 'left'],
);
section(
  'Accesorios',
  ACCESSORIES.map((accessory) => ({ ...base, accessory, accessoryColor: 'azul' as const })),
  ['down', 'left', 'up'],
);
document.title = 'listo';
