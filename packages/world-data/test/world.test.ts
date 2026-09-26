import { isBlocked, stepMovement, type Vec } from '@wous/game-core';
import { describe, expect, it } from 'vitest';
import {
  buildCollisionGrid,
  CAFE,
  canReachPortal,
  MAPS,
  type MapDef,
  nearestPortal,
  PLAZA,
  portalOf,
  spawnOf,
  validateWorld,
} from '../src/index.ts';

describe('integridad del mundo', () => {
  it('los mapas publicados son válidos', () => {
    expect(validateWorld()).toEqual([]);
  });

  it('detecta un portal a un mapa inexistente y un spawn dentro de algo sólido', () => {
    const roto: MapDef = {
      ...CAFE,
      spawns: { 'desde-plaza': { x: 5, y: 3, facing: 'up' } },
      portals: [{ ...portalOf(CAFE, 'cafe-plaza'), to: { map: 'plaza', spawn: 'no-existe' } }],
    };
    const problems = validateWorld({ ...MAPS, cafe: roto });
    expect(problems.join('\n')).toMatch(/spawn que no existe/);
    expect(problems.join('\n')).toMatch(/cae en algo sólido/);
  });
});

describe('colisión de la Plaza', () => {
  const grid = buildCollisionGrid(PLAZA);

  it('el kiosko, los puestos y las fachadas bloquean; el papel picado no', () => {
    expect(isBlocked(grid, 19, 14)).toBe(true); // kiosko
    expect(isBlocked(grid, 4, 4)).toBe(true); // puesto
    expect(isBlocked(grid, 10, 1)).toBe(true); // fachada
    expect(isBlocked(grid, 10, 6)).toBe(false); // bajo el papel picado
    expect(isBlocked(grid, 19, 25)).toBe(false); // andador
  });

  it('caminar hacia arriba desde la entrada choca con el kiosko', () => {
    let p: Vec = spawnOf(PLAZA, 'entrada');
    for (let i = 0; i < 80; i++) p = stepMovement(p, { x: 0, y: -1 }, 100, grid);
    expect(p.y).toBeGreaterThan(17.5);
    expect(p.y).toBeLessThan(18.5);
  });

  it('el portal al Café solo se alcanza frente a su puerta', () => {
    const portal = portalOf(PLAZA, 'plaza-cafe');
    expect(canReachPortal(spawnOf(PLAZA, 'desde-cafe'), portal)).toBe(true);
    expect(canReachPortal(spawnOf(PLAZA, 'entrada'), portal)).toBe(false);
    expect(nearestPortal(PLAZA, { x: 31, y: 4.2 })?.id).toBe('plaza-cafe');
  });
});
