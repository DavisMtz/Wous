import {
  type AppearanceInput,
  type ClothColorId,
  catalogItem,
  type ResolvedAppearance,
} from '@wous/contracts';
import type { Look } from './pixel-character.ts';

/**
 * Puente entre el catálogo lógico (@wous/contracts, lo que valida el
 * servidor) y el renderizador (estilo + color). Si un ID no existe, se usa
 * una pieza neutra para no romper el dibujo; el servidor nunca guarda eso.
 */
function piece<S extends string>(
  id: string | null,
  fallback: [S, ClothColorId],
): [S, ClothColorId] {
  const item = id ? catalogItem(id) : undefined;
  return item ? [item.style as S, item.color] : fallback;
}

export function lookFromAppearance(a: AppearanceInput | ResolvedAppearance): Look {
  if (typeof a.top !== 'string') {
    const r = a as ResolvedAppearance;
    return {
      body: r.body,
      skin: r.skinTone,
      hair: r.hair,
      hairColor: r.hairColor,
      top: r.top.style,
      topColor: r.top.color,
      bottom: r.bottom.style,
      bottomColor: r.bottom.color,
      shoes: r.shoes.style,
      shoesColor: r.shoes.color,
      accessory: r.accessory?.style ?? null,
      accessoryColor: r.accessory?.color ?? 'negro',
    };
  }
  const input = a as AppearanceInput;
  const [top, topColor] = piece<Look['top']>(input.top, ['playera', 'blanco']);
  const [bottom, bottomColor] = piece<Look['bottom']>(input.bottom, ['pantalon', 'mezclilla']);
  const [shoes, shoesColor] = piece<Look['shoes']>(input.shoes, ['tenis', 'blanco']);
  const accessoryPiece = input.accessory ? catalogItem(input.accessory) : undefined;
  return {
    body: input.body,
    skin: input.skinTone,
    hair: input.hair,
    hairColor: input.hairColor,
    top,
    topColor,
    bottom,
    bottomColor,
    shoes,
    shoesColor,
    accessory: (accessoryPiece?.style as Look['accessory']) ?? null,
    accessoryColor: accessoryPiece?.color ?? 'negro',
  };
}

export function appearanceFromLook(look: Look): AppearanceInput {
  return {
    body: look.body,
    skinTone: look.skin,
    hair: look.hair,
    hairColor: look.hairColor,
    top: `${look.top}.${look.topColor}`,
    bottom: `${look.bottom}.${look.bottomColor}`,
    shoes: `${look.shoes}.${look.shoesColor}`,
    accessory: look.accessory ? `${look.accessory}.${look.accessoryColor}` : null,
  };
}
