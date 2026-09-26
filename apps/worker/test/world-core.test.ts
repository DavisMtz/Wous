import { normalizeInput, stepMovement, type Vec } from '@wous/game-core';
import { collisionGrid, PLAZA, spawnOf, validateWorld } from '@wous/world-data';
import { describe, expect, it } from 'vitest';

// El servidor será la autoridad del movimiento (Fase 5): estos paquetes deben
// correr dentro de workerd exactamente igual que en el navegador.
describe('game-core y world-data dentro del Worker', () => {
  it('el mundo valida y el movimiento choca igual que en el cliente', () => {
    expect(validateWorld()).toEqual([]);
    const grid = collisionGrid(PLAZA);
    let p: Vec = spawnOf(PLAZA, 'entrada');
    for (let i = 0; i < 80; i++) p = stepMovement(p, normalizeInput(0, -1), 100, grid);
    expect(p.y).toBeGreaterThan(17.5);
    expect(p.y).toBeLessThan(18.5);
  });
});
