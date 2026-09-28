import { describe, expect, it } from 'vitest';
import {
  blockRect,
  canStandAt,
  createGrid,
  DEFAULT_MOVEMENT,
  facingFrom,
  isBlocked,
  normalizeInput,
  stepMovement,
  type Vec,
} from '../src/index.ts';

const SPEED = DEFAULT_MOVEMENT.speedTilesPerSecond;
const open = () => createGrid(20, 20);

describe('normalizeInput', () => {
  it('en diagonal no se va más rápido', () => {
    const d = normalizeInput(1, 1);
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1, 6);
  });

  it('recorta valores fuera de rango y descarta basura', () => {
    expect(normalizeInput(50, 0)).toEqual({ x: 1, y: 0 });
    expect(normalizeInput(Number.NaN, Number.POSITIVE_INFINITY)).toEqual({ x: 0, y: 0 });
  });

  it('una palanca casi suelta cuenta como suelta', () => {
    expect(normalizeInput(0.05, 0.05)).toEqual({ x: 0, y: 0 });
    expect(normalizeInput(0.5, 0)).toEqual({ x: 0.5, y: 0 });
  });
});

describe('stepMovement', () => {
  it('avanza velocidad × tiempo en campo abierto', () => {
    const p = stepMovement({ x: 5, y: 5 }, { x: 1, y: 0 }, 100, open());
    expect(p.x).toBeCloseTo(5 + SPEED * 0.1, 6);
    expect(p.y).toBe(5);
  });

  it('pone tope al tiempo de un paso (~150 ms)', () => {
    const p = stepMovement({ x: 5, y: 5 }, { x: 1, y: 0 }, 5_000, open());
    expect(p.x).toBeCloseTo(5 + SPEED * (DEFAULT_MOVEMENT.maxStepMs / 1000), 6);
  });

  it('una intención exagerada no acelera (el «speed hack» de magnitud)', () => {
    const honest = stepMovement({ x: 5, y: 5 }, { x: 1, y: 0 }, 100, open());
    const cheat = stepMovement({ x: 5, y: 5 }, { x: 999, y: 0 }, 100, open());
    expect(cheat).toEqual(honest);
  });

  it('mandar entradas más seguido no recorre más distancia', () => {
    // El servidor calcula dt con SU reloj: 100 entradas de 10 ms = 1 s = igual que 12 de ~83 ms.
    let fast: Vec = { x: 2, y: 5 };
    for (let i = 0; i < 100; i++) fast = stepMovement(fast, { x: 1, y: 0 }, 10, open());
    let normal: Vec = { x: 2, y: 5 };
    for (let i = 0; i < 12; i++) normal = stepMovement(normal, { x: 1, y: 0 }, 1000 / 12, open());
    expect(fast.x).toBeCloseTo(normal.x, 6);
  });

  it('no atraviesa una pared y se queda pegado a ella', () => {
    const grid = open();
    blockRect(grid, 8, 0, 1, 20);
    let p: Vec = { x: 6, y: 5 };
    for (let i = 0; i < 20; i++) p = stepMovement(p, { x: 1, y: 0 }, 150, grid);
    expect(p.x).toBeLessThan(8 - DEFAULT_MOVEMENT.footprint.halfWidth + 1e-3);
    expect(p.x).toBeGreaterThan(8 - DEFAULT_MOVEMENT.footprint.halfWidth - 0.01);
    expect(canStandAt(grid, p)).toBe(true);
  });

  it('en diagonal contra una pared se desliza por ella', () => {
    const grid = open();
    blockRect(grid, 8, 0, 1, 20);
    const p = stepMovement({ x: 7.6, y: 5 }, { x: 1, y: 1 }, 150, grid);
    expect(p.x).toBeLessThan(8);
    expect(p.y).toBeGreaterThan(5);
  });

  it('no sale de los límites del mapa', () => {
    let p: Vec = { x: 1, y: 1 };
    for (let i = 0; i < 50; i++) p = stepMovement(p, { x: -1, y: -1 }, 150, open());
    expect(p.x).toBeGreaterThanOrEqual(DEFAULT_MOVEMENT.footprint.halfWidth);
    expect(p.y).toBeGreaterThanOrEqual(DEFAULT_MOVEMENT.footprint.halfHeight);
    expect(isBlocked(open(), -1, 0)).toBe(true);
  });

  it('un tile bloqueado de ancho 1 no se brinca aunque el paso sea grande', () => {
    const grid = open();
    blockRect(grid, 6, 0, 1, 20);
    const p = stepMovement({ x: 5.5, y: 5 }, { x: 1, y: 0 }, 150, grid);
    expect(p.x).toBeLessThan(6);
  });
});

describe('rejilla más fina que el tile (ADR-0013)', () => {
  const fine = () => createGrid(20, 20, 4);

  it('con paredes enteras se camina igual que con la rejilla de tiles', () => {
    const coarse = open();
    const fina = fine();
    blockRect(coarse, 8, 0, 1, 20);
    blockRect(fina, 8, 0, 1, 20);
    let a: Vec = { x: 6, y: 5 };
    let b: Vec = { x: 6, y: 5 };
    for (let i = 0; i < 20; i++) {
      a = stepMovement(a, { x: 1, y: 0.3 }, 150, coarse);
      b = stepMovement(b, { x: 1, y: 0.3 }, 150, fina);
    }
    expect(b.x).toBeCloseTo(a.x, 6);
    expect(b.y).toBeCloseTo(a.y, 6);
  });

  it('una pared de medio tile detiene en su borde, por ambos lados', () => {
    const grid = fine();
    blockRect(grid, 8.25, 0, 0.5, 20);
    const half = DEFAULT_MOVEMENT.footprint.halfWidth;
    let derecha: Vec = { x: 6, y: 5 };
    for (let i = 0; i < 20; i++) derecha = stepMovement(derecha, { x: 1, y: 0 }, 150, grid);
    expect(derecha.x).toBeCloseTo(8.25 - half, 2);
    let izquierda: Vec = { x: 11, y: 5 };
    for (let i = 0; i < 20; i++) izquierda = stepMovement(izquierda, { x: -1, y: 0 }, 150, grid);
    expect(izquierda.x).toBeCloseTo(8.75 + half, 2);
    // Donde antes todo el tile 8 estorbaba, ahora se puede estar.
    expect(canStandAt(grid, { x: 8.1 - half, y: 5 })).toBe(true);
    expect(isBlocked(grid, 8 * 4, 20)).toBe(false);
    expect(isBlocked(grid, 8 * 4 + 1, 20)).toBe(true);
  });
});

describe('facingFrom', () => {
  it('mira según el eje dominante y conserva al soltar', () => {
    expect(facingFrom({ x: 1, y: 0.2 }, 'down')).toBe('right');
    expect(facingFrom({ x: -0.1, y: -1 }, 'down')).toBe('up');
    expect(facingFrom({ x: 0, y: 0 }, 'left')).toBe('left');
  });
});
