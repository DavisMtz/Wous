import { z } from 'zod';

/**
 * Catálogo lógico de apariencia (§10, §34). Es la ÚNICA fuente de IDs legales:
 * el servidor valida contra él y el cliente dibuja a partir de él. El arte
 * (colores, pixeles) vive en la web; aquí solo están los IDs y las reglas.
 *
 * Las prendas son `estilo.color` (p. ej. `sudadera.rosa`): una pieza del
 * catálogo, no un color libre. El cliente jamás manda URLs ni assets.
 */
export const CATALOG_VERSION = '2026-09-1';

export const BODY_IDS = ['a', 'b'] as const;
export const SKIN_TONE_IDS = ['piel-1', 'piel-2', 'piel-3', 'piel-4', 'piel-5', 'piel-6'] as const;
export const HAIR_IDS = ['corto', 'largo', 'chino', 'coleta', 'chongo', 'rapado'] as const;
export const HAIR_COLOR_IDS = [
  'negro',
  'castano-oscuro',
  'castano',
  'rubio',
  'pelirrojo',
  'cano',
  'rosa',
  'azul',
] as const;
export const CLOTH_COLOR_IDS = [
  'rosa',
  'azul',
  'amarillo',
  'verde',
  'naranja',
  'negro',
  'blanco',
  'rojo',
  'morado',
  'mezclilla',
  'caqui',
] as const;
export const TOP_STYLE_IDS = [
  'playera',
  'manga-larga',
  'sudadera',
  'tirantes',
  'chamarra',
  'rayas',
] as const;
export const BOTTOM_STYLE_IDS = ['pantalon', 'short', 'falda', 'jogger'] as const;
export const SHOE_STYLE_IDS = ['tenis', 'botas', 'chanclas'] as const;
export const ACCESSORY_STYLE_IDS = ['lentes', 'gorra', 'aretes', 'audifonos'] as const;

export type BodyId = (typeof BODY_IDS)[number];
export type SkinToneId = (typeof SKIN_TONE_IDS)[number];
export type HairId = (typeof HAIR_IDS)[number];
export type HairColorId = (typeof HAIR_COLOR_IDS)[number];
export type ClothColorId = (typeof CLOTH_COLOR_IDS)[number];
export type TopStyleId = (typeof TOP_STYLE_IDS)[number];
export type BottomStyleId = (typeof BOTTOM_STYLE_IDS)[number];
export type ShoeStyleId = (typeof SHOE_STYLE_IDS)[number];
export type AccessoryStyleId = (typeof ACCESSORY_STYLE_IDS)[number];

export type Slot = 'top' | 'bottom' | 'shoes' | 'accessory';

type StyleOf = {
  top: TopStyleId;
  bottom: BottomStyleId;
  shoes: ShoeStyleId;
  accessory: AccessoryStyleId;
};

export type CatalogItem<S extends Slot = Slot> = {
  id: `${StyleOf[S]}.${ClothColorId}`;
  slot: S;
  style: StyleOf[S];
  color: ClothColorId;
  /** ¿Se puede elegir al crear el personaje? El resto llegará con la tienda. */
  starter: boolean;
};

/** Colores de cada ranura en el set inicial. */
const STARTER_COLORS: Record<Slot, readonly ClothColorId[]> = {
  top: ['rosa', 'azul', 'amarillo', 'verde', 'naranja', 'negro', 'blanco', 'rojo', 'morado'],
  bottom: ['mezclilla', 'negro', 'caqui', 'azul', 'blanco', 'morado', 'rosa'],
  shoes: ['rojo', 'blanco', 'negro', 'azul', 'amarillo', 'rosa', 'verde'],
  accessory: ['negro', 'rojo', 'azul', 'amarillo', 'rosa'],
};

/** Estilos que aún no son del set inicial (llegan después, con la tienda). */
const NOT_STARTER_STYLES = new Set<string>(['botas', 'audifonos']);

function itemsFor<S extends Slot>(slot: S, styles: readonly StyleOf[S][]): CatalogItem<S>[] {
  return styles.flatMap((style) =>
    CLOTH_COLOR_IDS.map((color) => ({
      id: `${style}.${color}` as CatalogItem<S>['id'],
      slot,
      style,
      color,
      starter: !NOT_STARTER_STYLES.has(style) && STARTER_COLORS[slot].includes(color),
    })),
  );
}

export const CATALOG: readonly CatalogItem[] = [
  ...itemsFor('top', TOP_STYLE_IDS),
  ...itemsFor('bottom', BOTTOM_STYLE_IDS),
  ...itemsFor('shoes', SHOE_STYLE_IDS),
  ...itemsFor('accessory', ACCESSORY_STYLE_IDS),
];

const BY_ID = new Map<string, CatalogItem>(CATALOG.map((item) => [item.id, item]));

export function catalogItem(id: string): CatalogItem | undefined {
  return BY_ID.get(id);
}

export function starterItems<S extends Slot>(slot: S): CatalogItem<S>[] {
  return CATALOG.filter((item): item is CatalogItem<S> => item.slot === slot && item.starter);
}

/** Lo que el cliente manda al crear: SOLO IDs del catálogo. */
export const AppearanceInput = z.object({
  body: z.enum(BODY_IDS),
  skinTone: z.enum(SKIN_TONE_IDS),
  hair: z.enum(HAIR_IDS),
  hairColor: z.enum(HAIR_COLOR_IDS),
  top: z.string().max(40),
  bottom: z.string().max(40),
  shoes: z.string().max(40),
  accessory: z.string().max(40).nullable(),
});
export type AppearanceInput = z.infer<typeof AppearanceInput>;

/** Apariencia ya resuelta en estilo + color: lo que dibuja el renderizador. */
export type ResolvedAppearance = {
  body: BodyId;
  skinTone: SkinToneId;
  hair: HairId;
  hairColor: HairColorId;
  top: { style: TopStyleId; color: ClothColorId };
  bottom: { style: BottomStyleId; color: ClothColorId };
  shoes: { style: ShoeStyleId; color: ClothColorId };
  accessory: { style: AccessoryStyleId; color: ClothColorId } | null;
};

/** Peinados con volumen: la gorra no cabe encima. */
const NO_CAP_HAIR = new Set<HairId>(['chino', 'chongo']);

export type AppearanceProblem = { field: keyof AppearanceInput; message: string };

/**
 * Valida una apariencia contra el catálogo: cada pieza existe, es de su
 * ranura, pertenece al set inicial (si se pide) y la combinación es posible.
 */
export function resolveAppearance(
  input: AppearanceInput,
  options: { starterOnly: boolean } = { starterOnly: true },
): { ok: true; appearance: ResolvedAppearance } | { ok: false; problems: AppearanceProblem[] } {
  const problems: AppearanceProblem[] = [];

  const slot = <S extends Slot>(field: S & keyof AppearanceInput, id: string) => {
    const item = catalogItem(id);
    if (!item || item.slot !== field) {
      problems.push({ field, message: 'Esa prenda no existe en el catálogo.' });
      return null;
    }
    if (options.starterOnly && !item.starter) {
      problems.push({ field, message: 'Esa prenda todavía no está disponible.' });
      return null;
    }
    return item as CatalogItem<S>;
  };

  const top = slot('top', input.top);
  const bottom = slot('bottom', input.bottom);
  const shoes = slot('shoes', input.shoes);
  const accessory = input.accessory === null ? null : slot('accessory', input.accessory);

  if (accessory?.style === 'gorra' && NO_CAP_HAIR.has(input.hair)) {
    problems.push({ field: 'accessory', message: 'La gorra no cabe con ese peinado.' });
  }

  if (
    problems.length > 0 ||
    !top ||
    !bottom ||
    !shoes ||
    (input.accessory !== null && !accessory)
  ) {
    return { ok: false, problems };
  }
  return {
    ok: true,
    appearance: {
      body: input.body,
      skinTone: input.skinTone,
      hair: input.hair,
      hairColor: input.hairColor,
      top: { style: top.style, color: top.color },
      bottom: { style: bottom.style, color: bottom.color },
      shoes: { style: shoes.style, color: shoes.color },
      accessory: accessory ? { style: accessory.style, color: accessory.color } : null,
    },
  };
}
