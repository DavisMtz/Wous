import type { MapDef } from '../types.ts';
import { groundBuilder } from './builder.ts';

/**
 * El Café (Centro). Café de barrio: piso de mosaico de pasta, lambrín verde
 * botella con franja de talavera, la barra de azulejo con su vitrina de pan
 * dulce y la olla del café, vitroleros de agua fresca bajo la ventana, mesas
 * con hule y sillas plegables, y dos series de focos pelones de pared a
 * pared. La puerta de abajo regresa a la Plaza.
 *
 * Versión 2: la primera que se juega (la 1 fue un boceto que nunca abrió).
 */
const W = 22;
const H = 15;

const ground = groundBuilder(W, H, 'mosaico')
  // Pared del fondo (se ve de frente, tres tiles de alto) y los muros de los lados y de abajo.
  .fill(0, 0, W, 3, 'pared')
  .fill(0, 0, 1, H, 'pared')
  .fill(W - 1, 0, 1, H, 'pared')
  .fill(0, H - 1, W, 1, 'pared')
  .build();

export const CAFE: MapDef = {
  id: 'cafe',
  version: 2,
  name: 'El Café',
  width: W,
  height: H,
  ground,
  objects: [
    { id: 'barra', kind: 'barra', x: 2, y: 3, w: 9, h: 2 },
    { id: 'vitroleros', kind: 'vitroleros', x: 13, y: 3, w: 3, h: 1 },
    { id: 'maceta-monstera', kind: 'maceta', x: 19, y: 3, w: 1, h: 1, variant: 'monstera' },
    // Cada mesa trae sus dos sillas: cuatro tiles de ancho, uno de fondo.
    { id: 'mesa-1', kind: 'mesa', x: 3, y: 7, w: 4, h: 1, variant: 'rojo' },
    { id: 'mesa-2', kind: 'mesa', x: 14, y: 7, w: 4, h: 1, variant: 'azul' },
    { id: 'mesa-3', kind: 'mesa', x: 3, y: 10, w: 4, h: 1, variant: 'verde' },
    { id: 'mesa-4', kind: 'mesa', x: 14, y: 10, w: 4, h: 1, variant: 'amarillo' },
    { id: 'maceta-cactus', kind: 'maceta', x: 1, y: 12, w: 1, h: 1, variant: 'cactus' },
    { id: 'maceta-helecho', kind: 'maceta', x: 20, y: 12, w: 1, h: 1, variant: 'helecho' },
    { id: 'tapete', kind: 'tapete', x: 9, y: 13, w: 4, h: 1 },
    { id: 'focos-norte', kind: 'focos', x: 1, y: 6, w: W - 2, h: 1 },
    { id: 'focos-sur', kind: 'focos', x: 1, y: 9, w: W - 2, h: 1 },
  ],
  spawns: {
    'desde-plaza': { x: 11, y: 12.3, facing: 'up' },
  },
  defaultSpawn: 'desde-plaza',
  portals: [
    {
      id: 'cafe-plaza',
      x: 11,
      y: 13.4,
      reach: 1.4,
      to: { map: 'plaza', spawn: 'desde-cafe' },
      label: 'Salir a la Plaza',
    },
  ],
};
