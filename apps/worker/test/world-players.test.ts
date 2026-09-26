import { MOVEMENT } from '@wous/config';
import { collisionGrid, PLAZA, spawnOf } from '@wous/world-data';
import { describe, expect, it } from 'vitest';
import { applyInput, chooseSpawn, type PlayerAttachment } from '../src/world/players.ts';
import { APPEARANCE } from './world-support.ts';

const grid = collisionGrid(PLAZA);

function attachment(overrides: Partial<PlayerAttachment> = {}): PlayerAttachment {
  const spawn = spawnOf(PLAZA);
  return {
    id: 'chr_01J8ZQ4Y7V3M2N6P8R0S1T2V3W',
    acc: 'acc_01J8ZQ4Y7V3M2N6P8R0S1T2V3W',
    ses: 'ses_01J8ZQ4Y7V3M2N6P8R0S1T2V3W',
    name: 'Prueba',
    look: APPEARANCE,
    x: spawn.x,
    y: spawn.y,
    f: 'up',
    mx: 0,
    my: 0,
    seq: 0,
    at: 1000,
    seen: 1000,
    win: 1000,
    n: 0,
    strikes: 0,
    ...overrides,
  };
}

describe('aplicar un input', () => {
  it('avanza con la intención ANTERIOR por el tiempo del servidor, con tope', () => {
    const start = attachment({ mx: 0, my: -1 });
    const next = applyInput(start, { moveX: 1, moveY: 0, seq: 1 }, 1000 + 5000, grid);
    // 5 s de hueco solo cuentan como el tope (150 ms), y hacia arriba.
    const expected = (MOVEMENT.speedTilesPerSecond * MOVEMENT.maxStepMs) / 1000;
    expect(start.y - next.y).toBeCloseTo(expected, 3);
    expect(next.x).toBeCloseTo(start.x, 6);
    // La intención nueva queda para el siguiente tramo.
    expect(next.mx).toBe(1);
    expect(next.f).toBe('right');
  });

  it('la diagonal no da velocidad extra', () => {
    const start = attachment({ mx: 0, my: 0 });
    const diag = applyInput(start, { moveX: 1, moveY: -1, seq: 1 }, 1100, grid);
    expect(Math.hypot(diag.mx, diag.my)).toBeLessThanOrEqual(1.001);
  });
});

describe('dónde aparece alguien', () => {
  it('en el punto del mapa si está libre y cerca si ya hay alguien', () => {
    const base = spawnOf(PLAZA);
    expect(chooseSpawn(base, [], grid)).toEqual({ x: base.x, y: base.y, facing: base.facing });
    const otro = chooseSpawn(base, [base], grid, () => 0.25);
    expect(Math.hypot(otro.x - base.x, otro.y - base.y)).toBeGreaterThanOrEqual(0.6);
  });
});

describe('attachment', () => {
  it('cabe de sobra en los 2048 bytes del runtime, aun con nombre largo', () => {
    const att = attachment({
      name: 'Ñandú Pérez Ruíz Ávila',
      look: { ...APPEARANCE, accessory: 'audifonos.amarillo' },
      gone: 'replaced',
      x: 123.456,
      y: 987.654,
    });
    expect(new TextEncoder().encode(JSON.stringify(att)).length).toBeLessThan(1024);
  });
});
