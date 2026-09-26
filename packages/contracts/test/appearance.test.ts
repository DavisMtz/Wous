import { describe, expect, it } from 'vitest';
import {
  type AppearanceInput,
  CATALOG,
  CreateCharacterRequest,
  catalogItem,
  resolveAppearance,
  starterItems,
} from '../src/index.ts';

const base: AppearanceInput = {
  body: 'a',
  skinTone: 'piel-3',
  hair: 'corto',
  hairColor: 'negro',
  top: 'sudadera.rosa',
  bottom: 'jogger.negro',
  shoes: 'tenis.rojo',
  accessory: null,
};

describe('catálogo de apariencia', () => {
  it('cada ID es único y describe su estilo y color', () => {
    const ids = CATALOG.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(catalogItem('sudadera.rosa')).toMatchObject({
      slot: 'top',
      style: 'sudadera',
      color: 'rosa',
    });
  });

  it('el set inicial existe en cada ranura', () => {
    for (const slot of ['top', 'bottom', 'shoes', 'accessory'] as const) {
      expect(starterItems(slot).length).toBeGreaterThan(5);
    }
  });

  it('acepta una apariencia del set inicial', () => {
    const result = resolveAppearance(base);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.appearance.top).toEqual({ style: 'sudadera', color: 'rosa' });
  });

  it('rechaza prendas inexistentes o en la ranura equivocada', () => {
    const inventada = resolveAppearance({ ...base, top: 'https://evil.example/skin.png' });
    expect(inventada.ok).toBe(false);
    const cruzada = resolveAppearance({ ...base, top: 'jogger.negro' });
    expect(cruzada.ok).toBe(false);
    if (!cruzada.ok) expect(cruzada.problems[0]?.field).toBe('top');
  });

  it('rechaza lo que no es del set inicial', () => {
    const result = resolveAppearance({ ...base, shoes: 'botas.negro' });
    expect(result.ok).toBe(false);
    expect(resolveAppearance({ ...base, shoes: 'botas.negro' }, { starterOnly: false }).ok).toBe(
      true,
    );
  });

  it('rechaza combinaciones imposibles: gorra con peinado de volumen', () => {
    const result = resolveAppearance({ ...base, hair: 'chino', accessory: 'gorra.rojo' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]).toMatchObject({ field: 'accessory' });
    expect(resolveAppearance({ ...base, accessory: 'gorra.rojo' }).ok).toBe(true);
  });

  it('valida el nombre visible: acentos sí, emoji y homógrafos no', () => {
    const ok = CreateCharacterRequest.safeParse({ displayName: '  Ana  Lucía ', appearance: base });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.displayName).toBe('Ana Lucía');
    expect(
      CreateCharacterRequest.safeParse({ displayName: 'Ana 😎', appearance: base }).success,
    ).toBe(false);
    expect(CreateCharacterRequest.safeParse({ displayName: 'Аna', appearance: base }).success).toBe(
      false,
    );
    expect(CreateCharacterRequest.safeParse({ displayName: '123', appearance: base }).success).toBe(
      false,
    );
  });
});
