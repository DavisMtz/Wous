import { CLOTH_COLORS, type ClothColorId, HAIR_COLORS, SKIN_TONES } from './palette.ts';
import {
  BOTTOM_STYLES,
  type BodyTypeId,
  type Look,
  SHOE_STYLES,
  TOP_STYLES,
} from './pixel-character.ts';
import { ACCESSORIES, HAIR_STYLES } from './sprite-maps.ts';

/** Lo que se cuelga en un gancho: la ropa, sin la persona. */
export type Outfit = Pick<
  Look,
  'top' | 'topColor' | 'bottom' | 'bottomColor' | 'shoes' | 'shoesColor'
>;

export function outfitOf(look: Look): Outfit {
  return {
    top: look.top,
    topColor: look.topColor,
    bottom: look.bottom,
    bottomColor: look.bottomColor,
    shoes: look.shoes,
    shoesColor: look.shoesColor,
  };
}

export function wear(look: Look, outfit: Outfit): Look {
  return { ...look, ...outfit };
}

const TOP_NAMES: Record<Look['top'], string> = {
  playera: 'playera',
  'manga-larga': 'playera de manga larga',
  sudadera: 'sudadera',
  tirantes: 'playera de tirantes',
  chamarra: 'chamarra',
  rayas: 'playera de rayas',
};
const BOTTOM_NAMES: Record<Look['bottom'], string> = {
  pantalon: 'pantalón',
  short: 'short',
  falda: 'falda',
  jogger: 'jogger',
};
const COLOR_NAMES: Record<ClothColorId, string> = {
  rosa: 'rosa',
  azul: 'azul',
  amarillo: 'amarillo',
  verde: 'verde',
  naranja: 'naranja',
  negro: 'negro',
  blanco: 'blanco',
  rojo: 'rojo',
  morado: 'morado',
  mezclilla: 'de mezclilla',
  caqui: 'caqui',
};

/** Descripción para lectores de pantalla: «sudadera rosa y falda morado». */
export function describeOutfit(outfit: Outfit): string {
  return `${TOP_NAMES[outfit.top]} ${COLOR_NAMES[outfit.topColor]} y ${BOTTOM_NAMES[outfit.bottom]} ${COLOR_NAMES[outfit.bottomColor]}`;
}

/** Generador pseudoaleatorio con semilla (mismo resultado para la misma semilla). */
export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function choose<T>(rng: () => number, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error('Lista vacía');
  return item;
}

const WEARABLE_COLORS = Object.keys(CLOTH_COLORS) as ClothColorId[];

export function randomLook(rng: () => number = Math.random): Look {
  const top = choose(rng, TOP_STYLES);
  return {
    body: choose(rng, ['a', 'b'] as const satisfies readonly BodyTypeId[]),
    skin: choose(rng, Object.keys(SKIN_TONES) as Look['skin'][]),
    hair: choose(rng, HAIR_STYLES),
    hairColor: choose(rng, Object.keys(HAIR_COLORS) as Look['hairColor'][]),
    top,
    topColor: choose(rng, WEARABLE_COLORS),
    bottom: choose(rng, BOTTOM_STYLES),
    bottomColor: choose(rng, ['mezclilla', 'negro', 'caqui', 'morado', 'azul', 'blanco'] as const),
    shoes: choose(rng, SHOE_STYLES),
    shoesColor: choose(rng, WEARABLE_COLORS),
    accessory: rng() < 0.35 ? choose(rng, ACCESSORIES) : null,
    accessoryColor: choose(rng, WEARABLE_COLORS),
  };
}

/** Personas de la portada: se elige una por visita. */
export const PERSONAS: readonly [Look, ...Look[]] = [
  {
    body: 'a',
    skin: 'piel-4',
    hair: 'chino',
    hairColor: 'negro',
    top: 'sudadera',
    topColor: 'rosa',
    bottom: 'jogger',
    bottomColor: 'negro',
    shoes: 'tenis',
    shoesColor: 'rojo',
    accessory: 'aretes',
    accessoryColor: 'amarillo',
  },
  {
    body: 'b',
    skin: 'piel-2',
    hair: 'largo',
    hairColor: 'castano-oscuro',
    top: 'chamarra',
    topColor: 'azul',
    bottom: 'falda',
    bottomColor: 'negro',
    shoes: 'botas',
    shoesColor: 'negro',
    accessory: null,
    accessoryColor: 'rojo',
  },
  {
    body: 'a',
    skin: 'piel-5',
    hair: 'rapado',
    hairColor: 'negro',
    top: 'rayas',
    topColor: 'verde',
    bottom: 'pantalon',
    bottomColor: 'mezclilla',
    shoes: 'tenis',
    shoesColor: 'amarillo',
    accessory: 'lentes',
    accessoryColor: 'negro',
  },
  {
    body: 'b',
    skin: 'piel-3',
    hair: 'coleta',
    hairColor: 'rosa',
    top: 'playera',
    topColor: 'amarillo',
    bottom: 'short',
    bottomColor: 'mezclilla',
    shoes: 'tenis',
    shoesColor: 'rosa',
    accessory: 'audifonos',
    accessoryColor: 'azul',
  },
];

/** Lo que cuelga del perchero de la portada. */
export const RACK_OUTFITS: Outfit[] = [
  {
    top: 'playera',
    topColor: 'amarillo',
    bottom: 'short',
    bottomColor: 'caqui',
    shoes: 'chanclas',
    shoesColor: 'naranja',
  },
  {
    top: 'chamarra',
    topColor: 'naranja',
    bottom: 'pantalon',
    bottomColor: 'mezclilla',
    shoes: 'botas',
    shoesColor: 'negro',
  },
  {
    top: 'rayas',
    topColor: 'rojo',
    bottom: 'falda',
    bottomColor: 'morado',
    shoes: 'tenis',
    shoesColor: 'verde',
  },
  {
    top: 'tirantes',
    topColor: 'verde',
    bottom: 'jogger',
    bottomColor: 'blanco',
    shoes: 'tenis',
    shoesColor: 'azul',
  },
];
