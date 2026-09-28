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

function centro(o: MapObject): Vec {
  return { x: o.x + o.w / 2, y: o.y + o.h / 2 };
}

/** Camina en línea recta hacia `meta` con el movimiento del servidor. */
function caminar(p: Vec, meta: Vec, grid: CollisionGrid): Vec {
  let q = p;
  for (let i = 0; i < 2000; i++) {
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

/** La Plaza v3 (ADR-0014): algunos puntos del trazo, en tiles. */
const PUERTA_CAFE = portalOf(PLAZA, 'plaza-cafe');
const KIOSKO = centro(objeto(PLAZA, 'kiosko'));

describe('integridad del mundo', () => {
  it('los mapas publicados son válidos', () => {
    expect(validateWorld()).toEqual([]);
  });

  it('la Plaza es la v3, al doble de la v2: 208 × 98 tiles con colisión fina', () => {
    expect(PLAZA.version).toBe(3);
    expect(PLAZA.width).toBe(208);
    expect(PLAZA.height).toBe(98);
    expect(PLAZA.cellsPerTile).toBe(4);
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

  it('detecta a quien queda encerrado: un corral en la entrada deja fuera el Café, las bancas y las placas', () => {
    const entrada = spawnOf(PLAZA, 'entrada');
    const tabla = (id: string, x: number, y: number, w: number, h: number): MapObject => ({
      id,
      kind: 'mesa',
      x,
      y,
      w,
      h,
    });
    const { x, y } = entrada;
    const encerrado: MapDef = {
      ...PLAZA,
      objects: [
        ...PLAZA.objects,
        tabla('corral-1', x - 2, y - 1, 4, 0.4),
        tabla('corral-2', x - 2, y + 1, 4, 0.4),
        tabla('corral-3', x - 2, y - 1, 0.4, 2.4),
        tabla('corral-4', x + 1.6, y - 1, 0.4, 2.4),
      ],
    };
    const problems = validateWorld({ ...MAPS, plaza: encerrado }).join('\n');
    expect(problems).toMatch(/el portal plaza-cafe no se alcanza desde entrada/);
    expect(problems).toMatch(/el asiento banca-armas-madero-1-1 no se alcanza desde entrada/);
    expect(problems).toMatch(/el letrero placa-unesco no se alcanza desde entrada/);
  });

  it('detecta un asiento sin dónde levantarse y un letrero fuera del alcance', () => {
    const banca = seatOf(PLAZA, 'banca-armas-madero-1-1');
    if (!banca) throw new Error('Sin banca');
    const catedral = centro(objeto(PLAZA, 'catedral'));
    const roto: MapDef = {
      ...PLAZA,
      seats: [...PLAZA.seats, { ...banca, id: 'dentro-de-la-catedral', exit: catedral }],
      signs: [
        ...PLAZA.signs,
        { ...(PLAZA.signs[0] as MapDef['signs'][number]), id: 'en-la-torre', x: 55, y: 70 },
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
    expect(bloqueado(grid, 66, 50)).toBe(true); // Catedral
    expect(bloqueado(grid, KIOSKO.x, KIOSKO.y)).toBe(true); // kiosko
    const fuente = centro(objeto(PLAZA, 'fuente-armas-1'));
    expect(bloqueado(grid, fuente.x, fuente.y)).toBe(true);
    expect(bloqueado(grid, 160, 35)).toBe(true); // jardín cercado
    expect(bloqueado(grid, KIOSKO.x, 45)).toBe(false); // eje sur del kiosko
    expect(bloqueado(grid, KIOSKO.x + 7, KIOSKO.y)).toBe(false); // eje oriente–poniente
    expect(bloqueado(grid, 143.5, 50)).toBe(false); // andador de la orilla de la Plaza de Armas
    expect(bloqueado(grid, 30, 5)).toBe(true); // azoteas de Allende
    expect(bloqueado(grid, 30, 10)).toBe(true); // fachadas de Allende
    expect(bloqueado(grid, 30, 18)).toBe(false); // el empedrado de Allende
    expect(bloqueado(grid, 30, 94)).toBe(true); // Madero: la avenida no se cruza
  });

  it('el atrio rodea la Catedral: por sus costados se camina', () => {
    expect(bloqueado(grid, 43.5, 47)).toBe(false); // entre la reja oriente y el crucero
    expect(bloqueado(grid, 95, 50)).toBe(false); // el atrio poniente
    expect(bloqueado(grid, 48.5, 70)).toBe(true); // el anexo blanco, junto a la torre oriente
    expect(bloqueado(grid, 66.5, 78)).toBe(false); // frente a la puerta mayor
  });

  it('los portales de Allende: los pilares estorban, bajo los arcos se camina', () => {
    expect(bloqueado(grid, 141.375, 17.6)).toBe(true); // primer pilar del Portal Allende
    expect(bloqueado(grid, 144.375, 17.6)).toBe(true); // pilar a la izquierda del Café
    expect(bloqueado(grid, PUERTA_CAFE.x, 17.6)).toBe(false); // el arco del Café
    expect(bloqueado(grid, PUERTA_CAFE.x, 15.6)).toBe(false); // el andador cubierto
    expect(bloqueado(grid, PUERTA_CAFE.x, 14.6)).toBe(true); // la pared de los comercios
    expect(bloqueado(grid, 73.375, 17.6)).toBe(true); // primer pilar del Portal Aldama
  });

  it('la Cerrada de San Agustín se camina hasta su fondo', () => {
    expect(bloqueado(grid, 136, 14)).toBe(false);
    expect(bloqueado(grid, 136, 11)).toBe(false);
    expect(bloqueado(grid, 136, 8)).toBe(true);
  });

  it('la reja del atrio se cruza solo por sus portones', () => {
    expect(bloqueado(grid, 50, 87.2)).toBe(true); // reja norte
    expect(bloqueado(grid, 66.5, 87.2)).toBe(false); // portón mayor, por en medio
    expect(bloqueado(grid, 64.6, 87.2)).toBe(true); // su pilar
    expect(bloqueado(grid, 41.2, 60)).toBe(true); // reja oriente
    expect(bloqueado(grid, 41.2, 40.8)).toBe(false); // su portón del crucero, hacia la Melchor Ocampo
    expect(bloqueado(grid, 115.7, 65)).toBe(true); // reja poniente
    expect(bloqueado(grid, 115.7, 51)).toBe(false); // su portón, hacia la Plaza Juárez
    expect(bloqueado(grid, 115.7, 35)).toBe(false); // más al sur, sin reja (como la real)
  });

  it('la colisión es más fina que el tile: el borde de una fuente redonda es redondo', () => {
    const { x: cx, y: cy } = centro(objeto(PLAZA, 'fuente-armas-1'));
    expect(bloqueado(grid, cx, cy - 1.5)).toBe(true); // la pileta
    // La esquina de su caja ya es glorieta: con tiles enteros, estaría bloqueada.
    expect(bloqueado(grid, cx - 1.45, cy - 1.45)).toBe(false);
    // Se puede estar parado pegado a la pileta, en diagonal.
    const pegado = caminar({ x: cx - 2.6, y: cy - 2.6 }, { x: cx, y: cy }, grid);
    expect(Math.hypot(pegado.x - cx, pegado.y - cy)).toBeLessThan(2.1);
  });

  it('caminar hacia arriba desde la entrada se detiene en la escalinata de la Catedral', () => {
    const entrada = spawnOf(PLAZA, 'entrada');
    let p: Vec = entrada;
    for (let i = 0; i < 80; i++) p = stepMovement(p, { x: 0, y: -1 }, 100, grid);
    expect(p.y).toBeGreaterThan(77.1);
    expect(p.y).toBeLessThan(77.3);
    expect(p.x).toBe(entrada.x);
  });

  it.each([
    {
      por: 'el atrio poniente (sin reja al sur) y el empedrado de Allende',
      ruta: [
        { x: 95, y: 80.6 },
        { x: 95, y: 19 },
        { x: PUERTA_CAFE.x, y: 19 },
        { x: PUERTA_CAFE.x, y: 15.4 },
      ],
    },
    {
      por: 'el portón mayor, la banqueta de Madero y el andador Juárez',
      ruta: [
        { x: 66.5, y: 89.5 },
        { x: 136, y: 89.5 },
        { x: 136, y: 19 },
        { x: PUERTA_CAFE.x, y: 19 },
        { x: PUERTA_CAFE.x, y: 15.4 },
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
    expect(walk.near(PUERTA_CAFE, 1.4)).toBe(true);
  });

  it('el portal al Café solo se alcanza frente a su puerta', () => {
    expect(canReachPortal(spawnOf(PLAZA, 'desde-cafe'), PUERTA_CAFE)).toBe(true);
    expect(canReachPortal(spawnOf(PLAZA, 'entrada'), PUERTA_CAFE)).toBe(false);
    expect(nearestPortal(PLAZA, { x: PUERTA_CAFE.x, y: 15.6 })?.id).toBe('plaza-cafe');
    expect(nearestPortal(PLAZA, { x: PUERTA_CAFE.x, y: 19 })).toBeNull();
  });
});

describe('asientos y letreros', () => {
  it('cada banca de dos lugares tiene dos asientos con salida del lado del andador', () => {
    const uno = seatOf(PLAZA, 'banca-armas-madero-1-1');
    const dos = seatOf(PLAZA, 'banca-armas-madero-1-2');
    expect(uno?.facing).toBe('down');
    expect(dos?.object).toBe('banca-armas-madero-1');
    // Mira hacia Madero: se levanta hacia abajo, un poco delante.
    expect(uno && uno.exit.y > uno.y).toBe(true);
    // De canto (mira a la izquierda), sale por la izquierda.
    const canto = seatOf(PLAZA, 'banca-andador-1-1');
    expect(canto?.facing).toBe('left');
    expect(canto && canto.exit.x < canto.x).toBe(true);
    // Todos los ids son únicos y cada fuente de la Plaza de Armas tiene su borde, también de lado.
    const ids = PLAZA.seats.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (let i = 1; i <= 4; i++) {
      expect(seatOf(PLAZA, `fuente-armas-${i}-borde-2`)?.facing).toBe('down');
      expect(seatOf(PLAZA, `fuente-armas-${i}-borde-izquierda`)?.facing).toBe('left');
      expect(seatOf(PLAZA, `fuente-armas-${i}-borde-derecha`)?.facing).toBe('right');
    }
  });

  it('bajo los arcos del Portal Allende, cada mesa de café trae sus dos sillas', () => {
    const mesas = PLAZA.objects.filter((o) => o.kind === 'mesa' && o.variant === 'portal');
    expect(mesas.length).toBeGreaterThanOrEqual(6);
    for (const mesa of mesas) {
      const izquierda = seatOf(PLAZA, `${mesa.id}-izquierda`);
      const derecha = seatOf(PLAZA, `${mesa.id}-derecha`);
      expect(izquierda?.facing).toBe('right');
      expect(derecha?.facing).toBe('left');
      // Se levantan hacia el andador, detrás de la mesa.
      expect(izquierda && izquierda.exit.y < mesa.y).toBe(true);
    }
    // El arco del Café queda libre: por ahí se entra.
    const cafe = mesas.find((m) => m.x < PUERTA_CAFE.x && m.x + m.w > PUERTA_CAFE.x);
    expect(cafe).toBeUndefined();
  });

  it('solo se alcanza el asiento desde cerca de él o de su salida', () => {
    const seat = seatOf(PLAZA, 'banca-armas-madero-1-1');
    if (!seat) throw new Error('Sin banca');
    expect(canReachSeat(seat.exit, seat, 1.3)).toBe(true);
    expect(canReachSeat({ x: seat.exit.x, y: seat.exit.y + 1.2 }, seat, 1.3)).toBe(true);
    expect(canReachSeat({ x: seat.exit.x, y: seat.exit.y + 2.5 }, seat, 1.3)).toBe(false);
  });

  it('lo más cercano manda: puerta, asiento libre o placa', () => {
    const seat = seatOf(PLAZA, 'banca-armas-madero-1-1');
    if (!seat) throw new Error('Sin banca');
    const junto = nearestInteraction(PLAZA, seat.exit, 1.3);
    expect(junto?.type).toBe('seat');
    // Ocupado ya no se ofrece: el otro lugar de la misma banca sí.
    const ocupado = nearestInteraction(PLAZA, seat.exit, 1.3, (s) => s.id !== seat.id);
    expect(ocupado?.type === 'seat' && ocupado.seat.id).toBe('banca-armas-madero-1-2');
    // La placa de la UNESCO, en el andador Juárez junto a Madero.
    const placa = nearestInteraction(PLAZA, { x: 137.1, y: 88 }, 1.3);
    expect(placa?.type === 'sign' && placa.sign.id).toBe('placa-unesco');
    // En la puerta del Café, la puerta.
    const puerta = nearestInteraction(PLAZA, spawnOf(PLAZA, 'desde-cafe'), 1.3);
    expect(puerta?.type === 'portal' && puerta.portal.id).toBe('plaza-cafe');
    // A media plaza no hay nada.
    expect(nearestInteraction(PLAZA, { x: KIOSKO.x, y: 50 }, 1.3)).toBeNull();
  });

  it('la Catedral todavía no se abre: su puerta es un letrero que lo dice', () => {
    const puerta = PLAZA.signs.find((s) => s.id === 'puerta-catedral');
    expect(puerta?.body.join(' ')).toMatch(/pronto se podrá entrar/i);
    expect(PLAZA.portals.map((p) => p.id)).toEqual(['plaza-cafe']);
    const entrada = spawnOf(PLAZA, 'entrada');
    expect(nearestInteraction(PLAZA, entrada, 1.3)).toBeNull();
    const frente = nearestInteraction(PLAZA, { x: entrada.x, y: 78.3 }, 1.3);
    expect(frente?.type === 'sign' && frente.sign.id).toBe('puerta-catedral');
  });

  it('en la Melchor Ocampo, las fuentes danzantes y la losa de los Liberales se pisan', () => {
    const grid = buildCollisionGrid(PLAZA);
    const chorros = centro(objeto(PLAZA, 'fuentes-danzantes'));
    expect(bloqueado(grid, chorros.x, chorros.y)).toBe(false);
    const losa = centro(objeto(PLAZA, 'losa-liberales'));
    expect(bloqueado(grid, losa.x, losa.y)).toBe(false);
    // La estatua y su pileta sí estorban; en su orilla hay dos lugares y la placa en medio.
    const monumento = objeto(PLAZA, 'monumento-ocampo');
    expect(bloqueado(grid, monumento.x + monumento.w / 2, monumento.y + 3)).toBe(true);
    expect(seatOf(PLAZA, 'monumento-ocampo-borde-1')).toBeDefined();
    const frente = nearestInteraction(
      PLAZA,
      { x: monumento.x + monumento.w / 2, y: monumento.y + monumento.h + 0.9 },
      1.3,
    );
    expect(frente?.type === 'sign' && frente.sign.id).toBe('placa-ocampo');
    const liberales = nearestInteraction(PLAZA, { x: losa.x, y: losa.y + 1.2 }, 1.3);
    expect(liberales?.type === 'sign' && liberales.sign.title).toBe('Árbol de los Liberales');
  });

  it('el kiosko: su jardinera cercada estorba y un andadorcito llega a su puerta y a su placa', () => {
    const grid = buildCollisionGrid(PLAZA);
    expect(bloqueado(grid, KIOSKO.x - 4.2, KIOSKO.y)).toBe(true); // la jardinera, a un lado de la base
    expect(bloqueado(grid, KIOSKO.x, KIOSKO.y + 4.4)).toBe(false); // el andadorcito
    // Caminando por el eje norte hacia el kiosko se llega hasta su puertita.
    let p: Vec = { x: KIOSKO.x, y: KIOSKO.y + 11 };
    for (let i = 0; i < 60; i++) p = stepMovement(p, { x: 0, y: -1 }, 100, grid);
    expect(p.y).toBeGreaterThan(KIOSKO.y + 3.5);
    expect(p.y).toBeLessThan(KIOSKO.y + 3.9);
    const placa = nearestInteraction(PLAZA, p, 1.3);
    expect(placa?.type === 'sign' && placa.sign.id).toBe('placa-armas');
  });

  it('en el Café, cada mesa tiene sus dos sillas', () => {
    expect(CAFE.seats).toHaveLength(8);
    const silla = seatOf(CAFE, 'mesa-3-izquierda');
    expect(silla?.facing).toBe('right');
    expect(silla?.lift).toBe(10);
  });
});
