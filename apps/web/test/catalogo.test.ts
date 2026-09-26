import {
  ACCESSORY_STYLE_IDS,
  BODY_IDS,
  BOTTOM_STYLE_IDS,
  CATALOG,
  CLOTH_COLOR_IDS,
  HAIR_COLOR_IDS,
  HAIR_IDS,
  SHOE_STYLE_IDS,
  SKIN_TONE_IDS,
  TOP_STYLE_IDS,
} from '@wous/contracts';
import { describe, expect, it } from 'vitest';
import { appearanceFromLook, lookFromAppearance } from '../src/game/rendering/appearance.ts';
import { PERSONAS } from '../src/game/rendering/looks.ts';
import { CLOTH_COLORS, HAIR_COLORS, SKIN_TONES } from '../src/game/rendering/palette.ts';
import {
  BODY_TYPES,
  BOTTOM_STYLES,
  DIRECTIONS,
  renderFrameGrid,
  SHOE_STYLES,
  TOP_STYLES,
} from '../src/game/rendering/pixel-character.ts';
import { ACCESSORIES, HAIR_STYLES } from '../src/game/rendering/sprite-maps.ts';

const sorted = (xs: readonly string[]) => [...xs].sort();

describe('el arte cubre exactamente el catálogo del contrato', () => {
  it('mismos IDs en contrato y renderizador', () => {
    expect(sorted(BODY_TYPES)).toEqual(sorted(BODY_IDS));
    expect(sorted(Object.keys(SKIN_TONES))).toEqual(sorted(SKIN_TONE_IDS));
    expect(sorted(HAIR_STYLES)).toEqual(sorted(HAIR_IDS));
    expect(sorted(Object.keys(HAIR_COLORS))).toEqual(sorted(HAIR_COLOR_IDS));
    expect(sorted(Object.keys(CLOTH_COLORS))).toEqual(sorted(CLOTH_COLOR_IDS));
    expect(sorted(TOP_STYLES)).toEqual(sorted(TOP_STYLE_IDS));
    expect(sorted(BOTTOM_STYLES)).toEqual(sorted(BOTTOM_STYLE_IDS));
    expect(sorted(SHOE_STYLES)).toEqual(sorted(SHOE_STYLE_IDS));
    expect(sorted(ACCESSORIES)).toEqual(sorted(ACCESSORY_STYLE_IDS));
  });

  it('cada prenda del catálogo se dibuja en las cuatro direcciones', () => {
    const base = PERSONAS[0];
    for (const item of CATALOG) {
      const look = { ...base };
      if (item.slot === 'top') Object.assign(look, { top: item.style, topColor: item.color });
      if (item.slot === 'bottom')
        Object.assign(look, { bottom: item.style, bottomColor: item.color });
      if (item.slot === 'shoes') Object.assign(look, { shoes: item.style, shoesColor: item.color });
      if (item.slot === 'accessory') {
        Object.assign(look, { accessory: item.style, accessoryColor: item.color });
      }
      for (const direction of DIRECTIONS) {
        const painted = renderFrameGrid(look, direction, 0).flat().filter(Boolean).length;
        expect(painted, `${item.id} ${direction}`).toBeGreaterThan(150);
      }
    }
  });

  it('apariencia ↔ look es de ida y vuelta', () => {
    for (const persona of PERSONAS) {
      expect(lookFromAppearance(appearanceFromLook(persona))).toEqual(
        persona.accessory ? persona : { ...persona, accessoryColor: 'negro' },
      );
    }
  });
});
