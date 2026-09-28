import { CHAT, MOVEMENT, NETWORK, SOCIAL } from '@wous/config';
import { canReachPortal, collisionGrid, PLAZA, portalOf, spawnOf } from '@wous/world-data';
import { describe, expect, it } from 'vitest';
import {
  addStrike,
  applyInput,
  chooseSpawn,
  type PlayerAttachment,
  positionAt,
} from '../src/world/players.ts';
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
    ep: 1,
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

describe('faltas (§23)', () => {
  it('cuentan en su ventana y se olvidan pasada', () => {
    const t = 1_000_000;
    const att = attachment();
    for (let i = 0; i < NETWORK.maxStrikes; i++) expect(addStrike(att, t + i)).toBe(false);
    // Una más dentro de la ventana: se pasó.
    expect(addStrike(att, t + NETWORK.maxStrikes)).toBe(true);

    // La misma cantidad repartida en ventanas distintas no corre a nadie.
    const larga = attachment();
    for (let i = 0; i < NETWORK.maxStrikes * 3; i++) {
      const cuando = t + Math.floor(i / 10) * NETWORK.strikeWindowMs;
      expect(addStrike(larga, cuando)).toBe(false);
    }
  });
});

describe('alcance de un portal (§16)', () => {
  it('se mide donde el servidor te tiene AHORA, no donde mandaste el último input', () => {
    const portal = portalOf(PLAZA, 'plaza-cafe');
    // Un tile y medio abajo de la puerta, caminando hacia ella.
    const att = attachment({ x: portal.x, y: portal.y + 1.6, mx: 0, my: -1, at: 1000 });
    expect(canReachPortal(att, portal)).toBe(false);
    const ahora = positionAt(att, 1000 + MOVEMENT.maxStepMs, grid);
    expect(canReachPortal(ahora, portal)).toBe(true);
    // Esperar más no acerca más: el tope es el mismo que el de un input.
    expect(positionAt(att, 1000 + 60_000, grid)).toEqual(ahora);
    // Quieto, lejos, no alcanza por mucho que espere.
    const quieto = attachment({ x: portal.x, y: portal.y + 1.6, at: 1000 });
    expect(canReachPortal(positionAt(quieto, 9_000, grid), portal)).toBe(false);
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
      ep: 2 ** 40,
      tr: 1,
      pt: 1_790_000_000_000,
      x: 123.456,
      y: 987.654,
    });
    expect(new TextEncoder().encode(JSON.stringify(att)).length).toBeLessThan(1024);
  });

  it('sigue cabiendo con todo lo del chat, los gestos, la moderación y el asiento poblado', () => {
    const t = 1_790_000_000_000;
    const att = attachment({
      name: 'Ñandú Pérez Ruíz Ávila',
      look: { ...APPEARANCE, accessory: 'audifonos.amarillo' },
      gone: 'replaced',
      ep: 2 ** 40,
      tr: 1,
      pt: t,
      cw: Array.from({ length: CHAT.rate.limit }, (_, i) => t + i),
      cp: 0xffffffff,
      ct: t,
      eg: t,
      mu: t + 86_400_000,
      sw: Array.from({ length: SOCIAL.actionsPerMinute }, (_, i) => t + i),
      strikes: NETWORK.maxStrikes,
      kw: t,
      st: 'banca-plaza-de-armas-12-derecha',
      sa: t,
    });
    expect(new TextEncoder().encode(JSON.stringify(att)).length).toBeLessThan(1400);
  });
});
