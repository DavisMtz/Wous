import {
  ACCESSORY_STYLE_IDS,
  BODY_IDS,
  BOTTOM_STYLE_IDS,
  type ClothColorId,
  HAIR_COLOR_IDS,
  HAIR_IDS,
  SHOE_STYLE_IDS,
  SKIN_TONE_IDS,
  type Slot,
  starterItems,
  TOP_STYLE_IDS,
} from '@wous/contracts';
import type { Look } from '../../game/rendering/pixel-character.ts';

/** Nombres para personas (etiquetas y lectores de pantalla). */
export const NOMBRES = {
  body: { a: 'Hombros anchos', b: 'Complexión delgada' },
  skin: {
    'piel-1': 'Piel muy clara',
    'piel-2': 'Piel clara',
    'piel-3': 'Piel morena clara',
    'piel-4': 'Piel morena',
    'piel-5': 'Piel morena oscura',
    'piel-6': 'Piel oscura',
  },
  hair: {
    corto: 'Corto',
    largo: 'Largo',
    chino: 'Chino',
    coleta: 'Coleta',
    chongo: 'Chongo',
    rapado: 'Rapado',
  },
  hairColor: {
    negro: 'Negro',
    'castano-oscuro': 'Castaño oscuro',
    castano: 'Castaño',
    rubio: 'Rubio',
    pelirrojo: 'Pelirrojo',
    cano: 'Cano',
    rosa: 'Rosa',
    azul: 'Azul',
  },
  top: {
    playera: 'Playera',
    'manga-larga': 'Manga larga',
    sudadera: 'Sudadera',
    tirantes: 'Tirantes',
    chamarra: 'Chamarra',
    rayas: 'Rayas',
  },
  bottom: { pantalon: 'Pantalón', short: 'Short', falda: 'Falda', jogger: 'Jogger' },
  shoes: { tenis: 'Tenis', botas: 'Botas', chanclas: 'Chanclas' },
  accessory: { lentes: 'Lentes', gorra: 'Gorra', aretes: 'Aretes', audifonos: 'Audífonos' },
  color: {
    rosa: 'Rosa',
    azul: 'Azul',
    amarillo: 'Amarillo',
    verde: 'Verde',
    naranja: 'Naranja',
    negro: 'Negro',
    blanco: 'Blanco',
    rojo: 'Rojo',
    morado: 'Morado',
    mezclilla: 'Mezclilla',
    caqui: 'Caqui',
  },
} as const;

/** Estilos de una ranura: los del set inicial primero; el resto, «Pronto». */
export function estilosDe(slot: Slot, todos: readonly string[]) {
  const disponibles = new Set(starterItems(slot).map((i) => i.style as string));
  return todos.map((id) => ({ id, bloqueado: !disponibles.has(id) }));
}

/** Colores del set inicial para un estilo concreto de una ranura. */
export function coloresDe(slot: Slot, estilo: string): ClothColorId[] {
  return starterItems(slot)
    .filter((i) => i.style === estilo)
    .map((i) => i.color);
}

export const ESTILOS = {
  top: estilosDe('top', TOP_STYLE_IDS),
  bottom: estilosDe('bottom', BOTTOM_STYLE_IDS),
  shoes: estilosDe('shoes', SHOE_STYLE_IDS),
  accessory: estilosDe('accessory', ACCESSORY_STYLE_IDS),
};

export const PEINADOS_SIN_GORRA = new Set<string>(['chino', 'chongo']);

function azar<T>(items: readonly T[]): T {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) throw new Error('Lista vacía');
  return item;
}

/** Un look al azar, SOLO con piezas del set inicial (lo que el servidor acepta). */
export function lookAlAzar(): Look {
  const top = azar(starterItems('top'));
  const bottom = azar(starterItems('bottom'));
  const shoes = azar(starterItems('shoes'));
  const hair = azar(HAIR_IDS);
  const accesorios = starterItems('accessory').filter(
    (i) => !(i.style === 'gorra' && PEINADOS_SIN_GORRA.has(hair)),
  );
  const accessory = Math.random() < 0.4 ? azar(accesorios) : null;
  return {
    body: azar(BODY_IDS),
    skin: azar(SKIN_TONE_IDS),
    hair,
    hairColor: azar(HAIR_COLOR_IDS),
    top: top.style,
    topColor: top.color,
    bottom: bottom.style,
    bottomColor: bottom.color,
    shoes: shoes.style,
    shoesColor: shoes.color,
    accessory: accessory?.style ?? null,
    accessoryColor: accessory?.color ?? 'negro',
  };
}
