import type { MapDef } from '../types.ts';
import { groundBuilder } from './builder.ts';

/**
 * El Café (Centro). Interior de duela con barra, mesas y macetas; la puerta
 * de abajo regresa a la Plaza. Se dibuja y se usa en la Fase 6; sus datos
 * existen desde ya para que los portales de la Plaza validen.
 */
const W = 20;
const H = 14;

const ground = groundBuilder(W, H, 'duela')
  .fill(0, 0, W, 2, 'pared')
  .fill(0, 0, 1, H, 'pared')
  .fill(W - 1, 0, 1, H, 'pared')
  .fill(0, H - 1, W, 1, 'pared')
  .build();

export const CAFE: MapDef = {
  id: 'cafe',
  version: 1,
  name: 'El Café',
  width: W,
  height: H,
  ground,
  objects: [
    { id: 'barra', kind: 'barra', x: 2, y: 2, w: 8, h: 2 },
    { id: 'mesa-1', kind: 'mesa', x: 4, y: 6, w: 2, h: 2 },
    { id: 'mesa-2', kind: 'mesa', x: 9, y: 6, w: 2, h: 2 },
    { id: 'mesa-3', kind: 'mesa', x: 14, y: 6, w: 2, h: 2 },
    { id: 'mesa-4', kind: 'mesa', x: 4, y: 9, w: 2, h: 2 },
    { id: 'mesa-5', kind: 'mesa', x: 14, y: 9, w: 2, h: 2 },
    { id: 'maceta-1', kind: 'maceta', x: 17, y: 2, w: 1, h: 1, variant: 'monstera' },
    { id: 'maceta-2', kind: 'maceta', x: 1, y: 11, w: 1, h: 1, variant: 'cactus' },
    { id: 'tapete', kind: 'tapete', x: 8, y: 12, w: 4, h: 1 },
  ],
  spawns: {
    'desde-plaza': { x: 10, y: 11.4, facing: 'up' },
  },
  defaultSpawn: 'desde-plaza',
  portals: [
    {
      id: 'cafe-plaza',
      x: 10,
      y: 12.4,
      reach: 1.4,
      to: { map: 'plaza', spawn: 'desde-cafe' },
      label: 'Salir a la Plaza',
    },
  ],
};
