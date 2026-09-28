import {
  CLOTH_COLORS,
  type ClothColorId,
  EYE_COLOR,
  HAIR_COLORS,
  type HairColorId,
  mix,
  outlineOf,
  SKIN_TONES,
  type SkinToneId,
  SOLE_WHITE,
  type Tone,
} from './palette.ts';
import {
  ACCESSORY_MAPS,
  type AccessoryId,
  bodyMap,
  type Frame,
  HAIR_MAPS,
  type HairStyleId,
  type MapDirection,
  SIT_LEGS,
} from './sprite-maps.ts';

export const FRAME_W = 16;
export const FRAME_H = 32;
export const DIRECTIONS = ['down', 'left', 'right', 'up'] as const;
export type Direction = (typeof DIRECTIONS)[number];
export const WALK_FRAMES: readonly Frame[] = [0, 1, 2, 3];
/** La pose sentada: la quinta columna de la hoja (ADR-0013). */
export const SIT_FRAME = 4;
export type SheetFrame = Frame | typeof SIT_FRAME;
/** Columnas de la hoja: la caminata y la pose sentada. */
export const SHEET_COLUMNS = WALK_FRAMES.length + 1;
/** Sentado, la cabeza baja esto (px de arte). */
export const SIT_DROP = 4;

export const TOP_STYLES = [
  'playera',
  'manga-larga',
  'sudadera',
  'tirantes',
  'chamarra',
  'rayas',
] as const;
export type TopStyleId = (typeof TOP_STYLES)[number];
export const BOTTOM_STYLES = ['pantalon', 'short', 'falda', 'jogger'] as const;
export type BottomStyleId = (typeof BOTTOM_STYLES)[number];
export const SHOE_STYLES = ['tenis', 'botas', 'chanclas'] as const;
export type ShoeStyleId = (typeof SHOE_STYLES)[number];
export const BODY_TYPES = ['a', 'b'] as const;
export type BodyTypeId = (typeof BODY_TYPES)[number];

/** Apariencia resuelta: estilos + colores. El catálogo de IDs vive en contratos. */
export type Look = {
  body: BodyTypeId;
  skin: SkinToneId;
  hair: HairStyleId;
  hairColor: HairColorId;
  top: TopStyleId;
  topColor: ClothColorId;
  bottom: BottomStyleId;
  bottomColor: ClothColorId;
  shoes: ShoeStyleId;
  shoesColor: ClothColorId;
  accessory: AccessoryId | null;
  accessoryColor: ClothColorId;
};

type Grid = (string | null)[][];

/** Variantes de composición: ropa sola (para el perchero) y ojos cerrados. */
export type ComposeOptions = { clothesOnly?: boolean; blink?: boolean };

const SKIN_REGIONS = new Set(['H', 'h', 'P', 'p']);

function pick(t: Tone, ch: string): string {
  return ch === ch.toLowerCase() && ch !== ch.toUpperCase() ? t.shadow : t.base;
}

/** Color de una región del cuerpo según la ropa. null = transparente. */
function regionColor(
  ch: string,
  look: Look,
  x: number,
  y: number,
  rowBelow: string,
  options: ComposeOptions = {},
): string | null {
  const skinTone = SKIN_TONES[look.skin];
  const skin: Tone = options.clothesOnly ? { base: '', shadow: '', light: '' } : skinTone;
  if (ch === 'E') {
    if (options.clothesOnly) return null;
    if (options.blink) return y % 2 === 0 ? skinTone.base : skinTone.shadow;
    return EYE_COLOR;
  }
  if (SKIN_REGIONS.has(ch)) return pick(skin, ch) || null;

  const top = CLOTH_COLORS[look.topColor];
  const bottom = CLOTH_COLORS[look.bottomColor];
  const shoe = CLOTH_COLORS[look.shoesColor];
  const upper = ch.toUpperCase();

  if (upper === 'T' || upper === 'A' || upper === 'F') {
    const isForearm = upper === 'F';
    const isArm = upper === 'A';
    switch (look.top) {
      case 'playera':
        return isForearm ? pick(skin, ch) : pick(top, ch);
      case 'tirantes':
        return isForearm || isArm ? pick(skin, ch) : pick(top, ch);
      case 'rayas':
        if (isForearm) return pick(skin, ch);
        return y % 2 === 0 ? pick(top, ch) : pick(CLOTH_COLORS.blanco, ch);
      case 'chamarra':
        // Chamarra abierta: se ve la playera de dentro en el centro del pecho.
        if (upper === 'T' && (x === 7 || x === 8)) {
          const inner = look.topColor === 'blanco' ? CLOTH_COLORS.negro : CLOTH_COLORS.blanco;
          return pick(inner, ch);
        }
        return pick(top, ch);
      default:
        return pick(top, ch);
    }
  }

  if (upper === 'W' || upper === 'U' || upper === 'L') {
    const isLeg = upper === 'L';
    const isCuff = isLeg && /[Ss]/.test(rowBelow.charAt(x));
    switch (look.bottom) {
      case 'short':
      case 'falda':
        return isLeg ? pick(skin, ch) : pick(bottom, ch);
      case 'jogger':
        return isCuff ? bottom.light : pick(bottom, ch);
      default:
        if (look.shoes === 'botas' && isCuff) return pick(shoe, ch);
        return pick(bottom, ch);
    }
  }

  if (upper === 'S') {
    const isSole = !/[Ss]/.test(rowBelow.charAt(x));
    switch (look.shoes) {
      case 'tenis':
        return isSole ? shoe.base : pick(SOLE_WHITE, ch);
      case 'chanclas':
        return isSole ? shoe.shadow : pick(skin, ch);
      default:
        return pick(shoe, ch);
    }
  }
  return null;
}

function paintOverlay(
  grid: Grid,
  map: string[],
  colorOf: (ch: string) => string | null,
  only: (ch: string) => boolean,
) {
  map.forEach((line, y) => {
    for (let x = 0; x < FRAME_W; x++) {
      const ch = line.charAt(x);
      if (ch === '.' || !only(ch)) continue;
      const color = colorOf(ch);
      const row = grid[y];
      if (color && row) row[x] = color;
    }
  });
}

function hairColorOf(tone: Tone) {
  return (ch: string): string | null => {
    switch (ch) {
      case 'X':
      case 'B':
        return tone.base;
      case 'x':
      case 'b':
        return tone.shadow;
      case 'o':
        return tone.light;
      default:
        return null;
    }
  };
}

function accessoryColorOf(look: Look) {
  const t = CLOTH_COLORS[look.accessoryColor];
  return (ch: string): string | null => {
    switch (ch) {
      case 'K':
        return look.accessory === 'lentes' ? '#241a2b' : t.base;
      case 'k':
        return look.accessory === 'lentes' ? '#241a2b' : t.shadow;
      case 'G':
        return '#bfe6ff';
      case 'Y':
        return '#ffd23f';
      default:
        return null;
    }
  };
}

/** Contorno selectivo: cada hueco junto a un pixel toma su color hundido. */
function addOutline(grid: Grid): Grid {
  const out: Grid = grid.map((row) => [...row]);
  for (let y = 0; y < FRAME_H; y++) {
    for (let x = 0; x < FRAME_W; x++) {
      if (grid[y]?.[x]) continue;
      const neighbor =
        grid[y - 1]?.[x] ?? grid[y]?.[x - 1] ?? grid[y]?.[x + 1] ?? grid[y + 1]?.[x] ?? null;
      const row = out[y];
      if (neighbor && row) row[x] = outlineOf(neighbor);
    }
  }
  return out;
}

/** Complexión delgada: brazos de 1 px en frente y espalda. */
function slimArms(map: string[], direction: MapDirection): string[] {
  if (direction === 'left') return map;
  return map.map((line, y) =>
    y < 14 || y > 21
      ? line
      : line
          .split('')
          .map((ch, x) => ((x === 3 || x === 12) && /[AaFfPp]/.test(ch) ? '.' : ch))
          .join(''),
  );
}

/** Compone un cuadro como rejilla de colores (sin contorno ni espejo). */
export function composeFrame(
  look: Look,
  direction: Direction,
  frame: Frame,
  options: ComposeOptions = {},
): Grid {
  const dir: MapDirection = direction === 'right' ? 'left' : direction;
  const grid: Grid = Array.from({ length: FRAME_H }, () =>
    Array.from({ length: FRAME_W }, () => null),
  );
  const hairMap = HAIR_MAPS[look.hair][dir];
  const hairColor = hairColorOf(HAIR_COLORS[look.hairColor]);

  // 1. Cabello de atrás (queda detrás del cuello y los hombros).
  if (!options.clothesOnly) {
    paintOverlay(grid, hairMap, hairColor, (ch) => ch === 'B' || ch === 'b');
  }

  // 2. Cuerpo con su ropa.
  let body = bodyMap(dir, frame);
  if (look.body === 'b') body = slimArms(body, dir);
  body.forEach((line, y) => {
    const below = body[y + 1] ?? '';
    for (let x = 0; x < FRAME_W; x++) {
      const ch = line.charAt(x);
      if (ch === '.') continue;
      const color = regionColor(ch, look, x, y, below, options);
      const row = grid[y];
      if (color && row) row[x] = color;
    }
  });

  // 3. Detalles de prenda.
  const top = CLOTH_COLORS[look.topColor];
  if (look.top === 'sudadera') {
    const hood = mix(top.shadow, '#1a0a22', 0.15);
    const neckRow = grid[13];
    if (neckRow && dir !== 'left') {
      for (const x of [5, 6, 9, 10]) neckRow[x] = hood;
    }
    if (dir === 'down') {
      const cord = CLOTH_COLORS.blanco.base;
      for (const [x, y] of [
        [6, 15],
        [9, 15],
        [6, 16],
        [9, 16],
      ] as const) {
        const row = grid[y];
        if (row) row[x] = cord;
      }
    }
  }
  if (look.bottom === 'falda') {
    // Vuelo de la falda en el último renglón de muslo.
    const flareRow = grid[24];
    const color = CLOTH_COLORS[look.bottomColor].shadow;
    if (flareRow && dir !== 'left') {
      flareRow[4] = color;
      flareRow[11] = color;
    } else if (flareRow) {
      flareRow[4] = color;
      flareRow[9] = color;
    }
  }

  // 4. Cabello de delante y 5. accesorio.
  if (options.clothesOnly) return grid;
  paintOverlay(grid, hairMap, hairColor, (ch) => ch !== 'B' && ch !== 'b');
  if (look.accessory) {
    paintOverlay(grid, ACCESSORY_MAPS[look.accessory][dir], accessoryColorOf(look), () => true);
  }

  return grid;
}

/**
 * Sentado (ADR-0013): la cabeza, el torso y las manos del cuadro de pie,
 * bajados SIT_DROP px, y las piernas dobladas de SIT_LEGS con los colores de
 * la ropa. Los pies siguen en la fila de siempre: el ancla no cambia.
 */
export function composeSittingFrame(
  look: Look,
  direction: Direction,
  options: ComposeOptions = {},
): Grid {
  const dir: MapDirection = direction === 'right' ? 'left' : direction;
  const standing = composeFrame(look, direction, 0, options);
  const grid: Grid = Array.from({ length: FRAME_H }, () =>
    Array.from({ length: FRAME_W }, () => null),
  );
  for (let y = 0; y <= 20; y++) {
    const row = standing[y];
    if (row) grid[y + SIT_DROP] = [...row];
  }
  const legs = SIT_LEGS[dir];
  const first = 21 + SIT_DROP;
  legs.forEach((line, i) => {
    const y = first + i;
    const below = legs[i + 1] ?? '';
    const row = grid[y];
    if (!row) return;
    for (let x = 0; x < FRAME_W; x++) {
      const ch = line.charAt(x);
      if (ch === '.') continue;
      const color = regionColor(ch, look, x, y, below, options);
      if (color) row[x] = color;
    }
  });
  return grid;
}

export function renderFrameGrid(
  look: Look,
  direction: Direction,
  frame: SheetFrame,
  options: ComposeOptions = {},
): Grid {
  const composed =
    frame === SIT_FRAME
      ? composeSittingFrame(look, direction, options)
      : composeFrame(look, direction, frame, options);
  const grid = addOutline(composed);
  return direction === 'right' ? grid.map((row) => [...row].reverse()) : grid;
}

function hexToBytes(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function gridToImageData(grid: Grid): ImageData {
  const data = new ImageData(FRAME_W, FRAME_H);
  grid.forEach((row, y) => {
    row.forEach((color, x) => {
      if (!color) return;
      const [r, g, b] = hexToBytes(color);
      const i = (y * FRAME_W + x) * 4;
      data.data[i] = r;
      data.data[i + 1] = g;
      data.data[i + 2] = b;
      data.data[i + 3] = 255;
    });
  });
  return data;
}

export function lookKey(look: Look): string {
  return [
    look.body,
    look.skin,
    look.hair,
    look.hairColor,
    look.top,
    look.topColor,
    look.bottom,
    look.bottomColor,
    look.shoes,
    look.shoesColor,
    look.accessory ?? '-',
    look.accessoryColor,
  ].join('|');
}

const sheetCache = new Map<string, HTMLCanvasElement>();

/**
 * Hoja de sprites a 1×: filas = direcciones (down, left, right, up),
 * columnas = cuadros de caminata y, al final, la pose sentada. Phaser la usa
 * como textura; la UI dibuja cuadros sueltos escalados sin suavizado.
 */
export function spriteSheet(look: Look): HTMLCanvasElement {
  const key = lookKey(look);
  const cached = sheetCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = FRAME_W * SHEET_COLUMNS;
  canvas.height = FRAME_H * DIRECTIONS.length;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no disponible');
  DIRECTIONS.forEach((direction, row) => {
    for (const frame of [...WALK_FRAMES, SIT_FRAME] as const) {
      ctx.putImageData(
        gridToImageData(renderFrameGrid(look, direction, frame)),
        frame * FRAME_W,
        row * FRAME_H,
      );
    }
  });
  if (sheetCache.size > 200) sheetCache.clear();
  sheetCache.set(key, canvas);
  return canvas;
}

/** Dibuja un cuadro escalado (pixel perfecto) en un contexto 2D. */
export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  look: Look,
  direction: Direction,
  frame: SheetFrame,
  dx: number,
  dy: number,
  scale: number,
) {
  const sheet = spriteSheet(look);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    sheet,
    frame * FRAME_W,
    DIRECTIONS.indexOf(direction) * FRAME_H,
    FRAME_W,
    FRAME_H,
    Math.round(dx),
    Math.round(dy),
    FRAME_W * scale,
    FRAME_H * scale,
  );
}

const frameCache = new Map<string, HTMLCanvasElement>();

/** Un cuadro suelto a 1× (con variantes), cacheado por apariencia y opciones. */
export function frameCanvas(
  look: Look,
  direction: Direction,
  frame: SheetFrame,
  options: ComposeOptions = {},
): HTMLCanvasElement {
  const key = `${lookKey(look)}#${direction}${frame}${options.clothesOnly ? 'c' : ''}${options.blink ? 'b' : ''}`;
  const cached = frameCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = FRAME_W;
  canvas.height = FRAME_H;
  canvas
    .getContext('2d')
    ?.putImageData(gridToImageData(renderFrameGrid(look, direction, frame, options)), 0, 0);
  if (frameCache.size > 400) frameCache.clear();
  frameCache.set(key, canvas);
  return canvas;
}
