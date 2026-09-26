import type { MapDef, MapObject } from '../types.ts';
import { groundBuilder } from './builder.ts';

/**
 * La Plaza (Centro). Plaza de barrio: kiosko al centro sobre su anillo de
 * ladrillo, jacarandas en los jardines, bancas junto a los andadores, papel
 * picado de lado a lado y, frente a las fachadas, los puestos del tianguis con
 * sus lonas. En la fachada, la puerta del Café (portal validado por servidor).
 */
const W = 40;
const H = 30;

const ground = groundBuilder(W, H, 'adoquin')
  // Jardines (el adoquín que queda son los andadores en cruz).
  .fill(2, 5, 14, 7, 'pasto')
  .fill(24, 5, 14, 7, 'pasto')
  .fill(2, 18, 14, 9, 'pasto')
  .fill(24, 18, 14, 9, 'pasto')
  // Anillo del kiosko.
  .fill(15, 10, 10, 10, 'ladrillo')
  // Bordes: fachadas arriba, setos a los lados, banqueta y calle abajo.
  .fill(0, 0, W, 3, 'fachada')
  .fill(1, 3, W - 2, 1, 'banqueta')
  .fill(0, 3, 1, H - 4, 'seto')
  .fill(W - 1, 3, 1, H - 4, 'seto')
  .fill(1, H - 2, W - 2, 1, 'banqueta')
  .fill(0, H - 1, W, 1, 'calle')
  .build();

const puestos: MapObject[] = [
  { x: 3, variant: 'rosa' },
  { x: 8, variant: 'azul' },
  { x: 13, variant: 'amarilla' },
  { x: 23, variant: 'verde' },
  { x: 35, variant: 'naranja' },
].map((p, i) => ({
  id: `puesto-${i + 1}`,
  kind: 'puesto',
  x: p.x,
  y: 3,
  w: 4,
  h: 2,
  variant: p.variant,
}));

const bancas: MapObject[] = [
  [5, 12],
  [11, 12],
  [27, 12],
  [33, 12],
  [5, 17],
  [11, 17],
  [27, 17],
  [33, 17],
].map(([x = 0, y = 0], i) => ({ id: `banca-${i + 1}`, kind: 'banca', x, y, w: 2, h: 1 }));

const jacarandas: MapObject[] = [
  [4, 6],
  [12, 8],
  [27, 7],
  [35, 6],
  [4, 22],
  [12, 25],
  [28, 24],
  [35, 21],
].map(([x = 0, y = 0], i) => ({ id: `jacaranda-${i + 1}`, kind: 'jacaranda', x, y, w: 1, h: 1 }));

const faroles: MapObject[] = [
  [16, 11],
  [23, 11],
  [16, 18],
  [23, 18],
].map(([x = 0, y = 0], i) => ({ id: `farol-${i + 1}`, kind: 'farol', x, y, w: 1, h: 1 }));

export const PLAZA: MapDef = {
  id: 'plaza',
  version: 1,
  name: 'La Plaza',
  width: W,
  height: H,
  ground,
  objects: [
    { id: 'kiosko', kind: 'kiosko', x: 17, y: 12, w: 6, h: 6 },
    { id: 'fachada-cafe', kind: 'fachada-cafe', x: 28, y: 0, w: 6, h: 3 },
    ...puestos,
    ...bancas,
    ...jacarandas,
    ...faroles,
    { id: 'papel-picado-norte', kind: 'papel-picado', x: 1, y: 6, w: W - 2, h: 1 },
    { id: 'papel-picado-sur', kind: 'papel-picado', x: 1, y: 21, w: W - 2, h: 1 },
  ],
  spawns: {
    entrada: { x: 19.5, y: 26.5, facing: 'up' },
    'desde-cafe': { x: 31, y: 4.6, facing: 'down' },
  },
  defaultSpawn: 'entrada',
  portals: [
    {
      id: 'plaza-cafe',
      x: 31,
      y: 3.4,
      reach: 1.4,
      to: { map: 'cafe', spawn: 'desde-plaza' },
      label: 'Entrar al Café',
    },
  ],
};
