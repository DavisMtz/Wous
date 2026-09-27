import { type CollisionGrid, isBlocked, stepMovement, type Vec } from '@wous/game-core';
import { describe, expect, it } from 'vitest';
import {
  buildCollisionGrid,
  CAFE,
  canReachPortal,
  canReachSeat,
  MAPS,
  type MapDef,
  type MapObject,
  nearestInteraction,
  nearestPortal,
  PLAZA,
  portalOf,
  seatOf,
  spawnOf,
  validateWorld,
  walkableFrom,
} from '../src/index.ts';

/** ¿El punto (en tiles) cae en una celda bloqueada? La Plaza tiene 4 celdas por tile. */
function bloqueado(grid: CollisionGrid, x: number, y: number): boolean {
  const r = grid.cellsPerTile;
  return isBlocked(grid, Math.floor(x * r), Math.floor(y * r));
}

function objeto(map: MapDef, id: string): MapObject {
  const o = map.objects.find((candidate) => candidate.id === id);
  if (!o) throw new Error(`No existe ${id}`);
  return o;
}

/** Camina en línea recta hacia `meta` con el movimiento del servidor. */
function caminar(p: Vec, meta: Vec, grid: CollisionGrid): Vec {
  let q = p;
  for (let i = 0; i < 400; i++) {
    const dx = meta.x - q.x;
    const dy = meta.y - q.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.02) break;
    // El último paso, justo: 4.2 tiles por segundo.
    const ms = Math.min(100, (d / 4.2) * 1000);
    q = stepMovement(q, { x: dx / d, y: dy / d }, ms, grid);
  }
  return q;
}

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

  it('detecta a quien queda encerrado: una reja sin portón deja fuera el Café y las bancas', () => {
    // Un corral alrededor de la entrada.
    const tabla = (id: string, x: number, y: number, w: number, h: number): MapObject => ({
      id,
      kind: 'mesa',
      x,
      y,
      w,
      h,
    });
    const encerrado: MapDef = {
      ...PLAZA,
      objects: [
        ...PLAZA.objects,
        tabla('corral-1', 32, 38.6, 4, 0.4),
        tabla('corral-2', 32, 40.6, 4, 0.4),
        tabla('corral-3', 32, 38.6, 0.4, 2.4),
        tabla('corral-4', 35.6, 38.6, 0.4, 2.4),
      ],
    };
    const problems = validateWorld({ ...MAPS, plaza: encerrado }).join('\n');
    expect(problems).toMatch(/el portal plaza-cafe no se alcanza desde entrada/);
    expect(problems).toMatch(/el asiento banca-armas-1-1 no se alcanza desde entrada/);
    expect(problems).toMatch(/el letrero placa-unesco no se alcanza desde entrada/);
  });

  it('detecta un asiento sin dónde levantarse y un letrero fuera del alcance', () => {
    const banca = seatOf(PLAZA, 'banca-armas-13-1');
    if (!banca) throw new Error('Sin banca');
    const roto: MapDef = {
      ...PLAZA,
      seats: [...PLAZA.seats, { ...banca, id: 'dentro-de-la-catedral', exit: { x: 34, y: 20 } }],
      signs: [
        ...PLAZA.signs,
        { ...(PLAZA.signs[0] as MapDef['signs'][number]), id: 'en-la-torre', x: 27, y: 20 },
      ],
    };
    const problems = validateWorld({ ...MAPS, plaza: roto }).join('\n');
    expect(problems).toMatch(/el asiento dentro-de-la-catedral no tiene dónde levantarse/);
    expect(problems).toMatch(/el letrero en-la-torre no se alcanza a pie/);
  });
});

describe('colisión de la Plaza (Morelia)', () => {
  const grid = buildCollisionGrid(PLAZA);

  it('la Catedral, el kiosko, las fuentes y los jardines cercados bloquean; los andadores no', () => {
    expect(grid.cellsPerTile).toBe(4);
    expect(bloqueado(grid, 34, 25)).toBe(true); // Catedral
    expect(bloqueado(grid, 83.5, 30.5)).toBe(true); // kiosko
    const fuente = objeto(PLAZA, 'fuente-armas-1');
    expect(bloqueado(grid, fuente.x + fuente.w / 2, fuente.y + fuente.h / 2)).toBe(true);
    expect(bloqueado(grid, 90, 17)).toBe(true); // jardín cercado
    expect(bloqueado(grid, 83.5, 18)).toBe(false); // eje sur del kiosko
    expect(bloqueado(grid, 88.5, 30.5)).toBe(false); // eje oriente–poniente
    expect(bloqueado(grid, 70, 28)).toBe(false); // andador perimetral
    expect(bloqueado(grid, 30, 3)).toBe(true); // fachadas de Allende
    expect(bloqueado(grid, 30, 8.5)).toBe(false); // el empedrado de Allende
    expect(bloqueado(grid, 30, 47)).toBe(true); // Madero: la avenida no se cruza
  });

  it('los portales de Allende: los pilares estorban, bajo los arcos se camina', () => {
    expect(bloqueado(grid, 56.375, 6.6)).toBe(true); // primer pilar
    expect(bloqueado(grid, 71.375, 6.6)).toBe(true); // pilar a la izquierda del Café
    expect(bloqueado(grid, 72.875, 6.6)).toBe(false); // el arco del Café
    expect(bloqueado(grid, 72.875, 5.4)).toBe(false); // el andador cubierto
    expect(bloqueado(grid, 72.875, 4.6)).toBe(true); // la pared de los comercios
  });

  it('la reja del atrio se cruza solo por sus portones', () => {
    expect(bloqueado(grid, 30, 42.2)).toBe(true); // reja norte
    expect(bloqueado(grid, 34, 42)).toBe(false); // portón mayor, por en medio
    expect(bloqueado(grid, 32.8, 42.2)).toBe(true); // su pilar
    expect(bloqueado(grid, 22.5, 30)).toBe(true); // reja oriente
    expect(bloqueado(grid, 22.5, 21.25)).toBe(false); // su portón, hacia la Melchor Ocampo
    expect(bloqueado(grid, 55.7, 25)).toBe(true); // reja poniente
    expect(bloqueado(grid, 55.7, 29.75)).toBe(false); // su portón, hacia la Plaza Juárez
  });

  it('la colisión es más fina que el tile: el borde de una fuente redonda es redondo', () => {
    const f = objeto(PLAZA, 'fuente-armas-1');
    const cx = f.x + f.w / 2;
    const cy = f.y + f.h / 2;
    expect(bloqueado(grid, cx, cy - 1.2)).toBe(true); // la pileta
    // La esquina de su caja ya es glorieta: con tiles enteros, estaría bloqueada.
    expect(bloqueado(grid, cx - 1.2, cy - 1.2)).toBe(false);
    // Se puede estar parado pegado a la pileta, en diagonal.
    const pegado = caminar({ x: cx - 2, y: cy - 2 }, { x: cx, y: cy }, grid);
    expect(Math.hypot(pegado.x - cx, pegado.y - cy)).toBeLessThan(1.7);
  });

  it('caminar hacia arriba desde la entrada se detiene en la escalinata de la Catedral', () => {
    let p: Vec = spawnOf(PLAZA, 'entrada');
    for (let i = 0; i < 80; i++) p = stepMovement(p, { x: 0, y: -1 }, 100, grid);
    expect(p.y).toBeGreaterThan(36.1);
    expect(p.y).toBeLessThan(36.3);
    expect(p.x).toBe(34);
  });

  it.each([
    {
      por: 'el atrio poniente (sin reja al norte) y el empedrado de Allende',
      ruta: [
        { x: 49, y: 39.9 },
        { x: 49, y: 8.5 },
        { x: 72.875, y: 8.5 },
        { x: 72.875, y: 5.4 },
      ],
    },
    {
      por: 'el portón mayor, Madero y el andador de la Plaza Juárez',
      ruta: [
        { x: 34, y: 43.6 },
        { x: 57, y: 43.6 },
        // Entre la reja del atrio y el arriate de la Plaza Juárez.
        { x: 57, y: 8.5 },
        { x: 72.875, y: 8.5 },
        { x: 72.875, y: 5.4 },
      ],
    },
  ])('de la entrada se llega a pie a la puerta del Café por $por', ({ ruta }) => {
    let p: Vec = spawnOf(PLAZA, 'entrada');
    for (const meta of ruta) {
      p = caminar(p, meta, grid);
      expect(Math.hypot(p.x - meta.x, p.y - meta.y)).toBeLessThan(0.05);
    }
    expect(nearestPortal(PLAZA, p)?.id).toBe('plaza-cafe');
    const walk = walkableFrom(grid, spawnOf(PLAZA, 'entrada'));
    expect(walk.near(portalOf(PLAZA, 'plaza-cafe'), 1.4)).toBe(true);
  });

  it('el portal al Café solo se alcanza frente a su puerta', () => {
    const portal = portalOf(PLAZA, 'plaza-cafe');
    expect(canReachPortal(spawnOf(PLAZA, 'desde-cafe'), portal)).toBe(true);
    expect(canReachPortal(spawnOf(PLAZA, 'entrada'), portal)).toBe(false);
    expect(nearestPortal(PLAZA, { x: 72.875, y: 5.6 })?.id).toBe('plaza-cafe');
    expect(nearestPortal(PLAZA, { x: 72.875, y: 8.5 })).toBeNull();
  });
});

describe('asientos y letreros', () => {
  it('cada banca de dos lugares tiene dos asientos con salida del lado del andador', () => {
    const uno = seatOf(PLAZA, 'banca-armas-13-1');
    const dos = seatOf(PLAZA, 'banca-armas-13-2');
    expect(uno?.facing).toBe('down');
    expect(dos?.object).toBe('banca-armas-13');
    // Mira hacia Madero: se levanta hacia abajo, un poco delante.
    expect(uno && uno.exit.y > uno.y).toBe(true);
    // De canto (mira a la izquierda), sale por la izquierda.
    const canto = seatOf(PLAZA, 'banca-juarez-4-1');
    expect(canto?.facing).toBe('left');
    expect(canto && canto.exit.x < canto.x).toBe(true);
    // Todos los ids son únicos y cada fuente de la Plaza de Armas tiene su borde.
    const ids = PLAZA.seats.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (let i = 1; i <= 4; i++) expect(seatOf(PLAZA, `fuente-armas-${i}-borde-1`)).toBeDefined();
  });

  it('solo se alcanza el asiento desde cerca de él o de su salida', () => {
    const seat = seatOf(PLAZA, 'banca-armas-13-1');
    if (!seat) throw new Error('Sin banca');
    expect(canReachSeat(seat.exit, seat, 1.3)).toBe(true);
    expect(canReachSeat({ x: seat.exit.x, y: seat.exit.y + 1.2 }, seat, 1.3)).toBe(true);
    expect(canReachSeat({ x: seat.exit.x, y: seat.exit.y + 2.5 }, seat, 1.3)).toBe(false);
  });

  it('lo más cercano manda: puerta, asiento libre o placa', () => {
    const seat = seatOf(PLAZA, 'banca-armas-13-1');
    if (!seat) throw new Error('Sin banca');
    const junto = nearestInteraction(PLAZA, seat.exit, 1.3);
    expect(junto?.type).toBe('seat');
    // Ocupado ya no se ofrece: el otro lugar de la misma banca sí.
    const ocupado = nearestInteraction(PLAZA, seat.exit, 1.3, (s) => s.id !== seat.id);
    expect(ocupado?.type === 'seat' && ocupado.seat.id).toBe('banca-armas-13-2');
    // La placa de la UNESCO, junto a Madero.
    const placa = nearestInteraction(PLAZA, { x: 66.1, y: 44.4 }, 1.3);
    expect(placa?.type === 'sign' && placa.sign.id).toBe('placa-unesco');
    // En la puerta del Café, la puerta.
    const puerta = nearestInteraction(PLAZA, spawnOf(PLAZA, 'desde-cafe'), 1.3);
    expect(puerta?.type === 'portal' && puerta.portal.id).toBe('plaza-cafe');
    // A media plaza no hay nada.
    expect(nearestInteraction(PLAZA, { x: 83.5, y: 24 }, 1.3)).toBeNull();
  });

  it('la Catedral todavía no se abre: su puerta es un letrero que lo dice', () => {
    const puerta = PLAZA.signs.find((s) => s.id === 'puerta-catedral');
    expect(puerta?.body.join(' ')).toMatch(/Pronto se podrá entrar/);
    expect(PLAZA.portals.map((p) => p.id)).toEqual(['plaza-cafe']);
    expect(nearestInteraction(PLAZA, spawnOf(PLAZA, 'entrada'), 1.3)).toBeNull();
    const frente = nearestInteraction(PLAZA, { x: 34, y: 36.3 }, 1.3);
    expect(frente?.type === 'sign' && frente.sign.id).toBe('puerta-catedral');
  });

  it('en el Café, cada mesa tiene sus dos sillas', () => {
    expect(CAFE.seats).toHaveLength(8);
    const silla = seatOf(CAFE, 'mesa-3-izquierda');
    expect(silla?.facing).toBe('right');
    expect(silla?.lift).toBe(10);
  });
});
