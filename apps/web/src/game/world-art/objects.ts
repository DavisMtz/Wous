import type { MapObject } from '@wous/world-data';
import { CLOTH_COLORS, mix, WOOD } from '../rendering/palette.ts';
import { barra, maceta, mesa, tapete, vitroleros } from './interior.ts';
import { hash, type Painter, painter, pick, sign, signWidth } from './paint.ts';
import {
  CAL,
  CANTERA,
  CORTEZA,
  FAROL,
  FOSFO,
  HIERRO,
  hundido,
  isLona,
  JACARANDA,
  LONAS,
  type LonaId,
  METAL,
  PAPEL_PICADO,
  PATINA,
  PLUMON,
  SOMBRA,
  SOMBRA_SUAVE,
  TILE,
} from './world-palette.ts';

/**
 * Un objeto del mapa ya pintado. `ox`/`oy` llevan del canto superior
 * izquierdo de su huella (en pixeles del mundo) al del canvas: lo alto (copas,
 * techos, lonas) sobresale hacia arriba. `depth` es la línea de sus pies: lo
 * que pisa más abajo se dibuja encima.
 */
export type ObjectArt = {
  canvas: HTMLCanvasElement;
  ox: number;
  oy: number;
  depth: number;
  /** Se transparenta si tapa a la persona que juega (copa, techo). */
  occluder: boolean;
};

export function paintObject(o: MapObject): ObjectArt | null {
  const depth = (o.y + o.h) * TILE;
  switch (o.kind) {
    case 'kiosko':
      return { ...kiosko(), depth, occluder: true };
    case 'puesto':
      return { ...puesto(isLona(o.variant) ? o.variant : 'rosa', o.id), depth, occluder: false };
    case 'banca':
      return { ...banca(), depth, occluder: false };
    case 'jacaranda':
      return { ...jacaranda(o.id), depth, occluder: true };
    case 'farol':
      return { ...farol(), depth, occluder: false };
    case 'fachada-cafe':
      return { ...fachadaCafe(), depth, occluder: false };
    case 'mesa':
      return { ...mesa(o.variant), depth, occluder: false };
    case 'barra':
      return { ...barra(o.w, o.h), depth, occluder: false };
    case 'vitroleros':
      return { ...vitroleros(o.w), depth, occluder: false };
    case 'maceta':
      return { ...maceta(o.variant), depth, occluder: false };
    case 'tapete':
      return { ...tapete(o.w, o.h), depth: o.y * TILE, occluder: false };
    case 'papel-picado':
    case 'focos':
      return null; // Los arma la escena: cuelgan de pared a pared, encima de todos.
  }
}

// ─── Kiosko ────────────────────────────────────────────────────────────────

/** Kiosko de plaza: base octagonal de cantera, columnas de hierro, lambrequín de cal y techo de cobre con pátina. */
function kiosko(): Omit<ObjectArt, 'depth' | 'occluder'> {
  const W = 112;
  const H = 176;
  const p = painter(W, H);
  const cx = 56;

  // Piso interior de mosaico (se ve entre las columnas), en la sombra del techo.
  octagon(p, 12, 100, 88, 62, 12, CAL.base);
  for (let y = 100; y < 162; y++) {
    for (let x = 12; x < 100; x++) {
      if (((x >> 2) + (y >> 2)) % 2 === 0) p.px(x, y, '#c9744a');
    }
  }
  octagonMask(p, 12, 100, 88, 12);
  for (let y = 100; y < 136; y++) {
    p.rect(12, y, 88, 1, `rgb(43 18 56 / ${(0.5 - (y - 100) * 0.013).toFixed(3)})`);
  }
  octagonMask(p, 12, 100, 88, 12);
  // Barandal y columnas del fondo.
  p.rect(18, 110, 76, 2, CAL.shade);
  for (let x = 20; x < 92; x += 4) p.rect(x, 112, 1, 5, CAL.deep);
  p.rect(18, 117, 76, 1, CAL.deep);
  for (const x of [28, 55, 82]) column(p, x, 96, 22, true);

  // Base: cara frontal de sillares y escalinata.
  p.rect(12, 160, 88, 12, CANTERA.shade);
  p.rect(12, 160, 88, 1, CANTERA.lighter);
  for (let x = 12; x < 100; x += 11) p.rect(x, 161, 1, 11, CANTERA.joint);
  p.rect(12, 166, 88, 1, CANTERA.joint);
  p.rect(12, 160, 8, 12, hundido(CANTERA.shade, 0.15));
  p.rect(92, 160, 8, 12, hundido(CANTERA.shade, 0.25));
  p.rect(12, 172, 88, 2, CANTERA.deep);
  for (let i = 0; i < 3; i++) {
    const sx = 42 - i * 2;
    const sw = 28 + i * 4;
    const sy = 160 + i * 5;
    p.rect(sx, sy, sw, 5, i === 0 ? CANTERA.light : CANTERA.base);
    p.rect(sx, sy, sw, 1, CANTERA.lighter);
    p.rect(sx, sy + 4, sw, 1, CANTERA.shade);
  }

  // Barandal del frente (abierto en la escalinata).
  for (const [x0, x1] of [
    [14, 40],
    [72, 98],
  ] as const) {
    p.rect(x0, 148, x1 - x0, 2, CAL.base);
    for (let x = x0 + 1; x < x1; x += 3) p.rect(x, 150, 1, 8, CAL.shade);
    p.rect(x0, 158, x1 - x0, 2, CAL.base);
    p.rect(x0, 160, x1 - x0, 1, CAL.deep);
  }

  // Columnas del frente.
  for (const x of [14, 38, 72, 96]) column(p, x, 104, 56, false);

  // Techo: faldón piramidal con costillas y cursos, domo y linternilla.
  for (let y = 40; y < 102; y++) {
    const t = (y - 40) / 62;
    const hw = Math.round(22 + t * 34);
    for (let x = cx - hw; x < cx + hw; x++) {
      const u = (x - (cx - hw)) / (2 * hw);
      let c = u < 0.34 ? PATINA.light : u > 0.7 ? PATINA.shade : PATINA.base;
      const rib = Math.floor(u * 8) !== Math.floor(((x - 1 - (cx - hw)) / (2 * hw)) * 8);
      if (rib && x > cx - hw) c = u < 0.5 ? PATINA.lighter : PATINA.deep;
      if ((y - 40) % 7 === 6) c = hundido(c, 0.18);
      if (x === cx - hw || x === cx + hw - 1) c = PATINA.deep;
      p.px(x, y, c);
    }
  }
  for (let y = 16; y < 41; y++) {
    const s = (40 - y) / 24;
    const hw = Math.round(23 * Math.sqrt(Math.max(0, 1 - s * s)));
    for (let x = cx - hw; x < cx + hw; x++) {
      const u = (x - (cx - hw)) / Math.max(1, 2 * hw);
      let c = u < 0.3 ? PATINA.light : u > 0.72 ? PATINA.shade : PATINA.base;
      if (u > 0.18 && u < 0.26 && y < 34) c = PATINA.lighter;
      if (x === cx - hw || x === cx + hw - 1 || y === 16) c = PATINA.deep;
      p.px(x, y, c);
    }
  }
  // Cinturón de cal entre domo y faldón.
  p.rect(cx - 24, 39, 48, 2, CAL.base);
  p.rect(cx - 24, 41, 48, 1, CAL.deep);
  // Linternilla y banderita rosa.
  p.rect(cx - 5, 7, 10, 10, CAL.base);
  p.rect(cx + 2, 7, 3, 10, CAL.shade);
  p.rect(cx - 2, 9, 3, 5, '#3b2c4a');
  p.rect(cx - 6, 5, 12, 2, PATINA.base);
  p.rect(cx - 4, 3, 8, 2, PATINA.light);
  p.rect(cx, 0, 1, 3, METAL.shade);
  p.rect(cx + 1, 0, 4, 2, LONAS.rosa.base);
  p.px(cx + 4, 2, LONAS.rosa.hondo);

  // Lambrequín: cenefa de cal con festones.
  p.rect(0, 100, W, 1, CAL.deep);
  p.rect(0, 101, W, 7, CAL.base);
  p.rect(0, 101, W, 1, '#ffffff');
  for (let x = 0; x < W; x++) {
    const k = x % 8;
    const d = Math.round(3 * Math.sin((Math.PI * (k + 0.5)) / 8));
    if (d > 0) p.rect(x, 108, 1, d, CAL.base);
    p.px(x, 108 + Math.max(0, d), CAL.deep);
    if (k === 4) p.px(x, 104, LONAS.rosa.base);
  }

  return { canvas: p.canvas, ox: -8, oy: -80 };
}

function column(p: Painter, x: number, top: number, height: number, back: boolean): void {
  const base = back ? hundido(HIERRO.base, 0.3) : HIERRO.base;
  p.rect(x, top, 3, height, base);
  if (!back) {
    p.rect(x, top, 1, height, HIERRO.light);
    p.rect(x + 2, top, 1, height, HIERRO.shade);
    p.rect(x - 1, top + height - 3, 5, 3, CAL.base);
    p.rect(x - 1, top, 5, 2, CAL.shade);
  }
}

/** Borra lo pintado fuera del octágono (las esquinas cortadas). */
function octagonMask(p: Painter, x: number, y: number, w: number, cut: number): void {
  for (let yy = 0; yy < cut; yy++) {
    const inset = cut - yy;
    p.ctx.clearRect(x, y + yy, inset, 1);
    p.ctx.clearRect(x + w - inset, y + yy, inset, 1);
  }
}

function octagon(
  p: Painter,
  x: number,
  y: number,
  w: number,
  h: number,
  cut: number,
  color: string,
): void {
  for (let yy = 0; yy < h; yy++) {
    const inset = yy < cut ? cut - yy : 0;
    p.rect(x + inset, y + yy, w - inset * 2, 1, color);
  }
}

// ─── Puesto del tianguis ──────────────────────────────────────────────────

const GIRO: Record<LonaId, { rotulo: string; precio: string }> = {
  rosa: { rotulo: 'PACA', precio: '$20' },
  azul: { rotulo: 'TENIS', precio: '$99' },
  amarilla: { rotulo: 'GORRAS', precio: '$50' },
  verde: { rotulo: 'PLAYERAS', precio: '3X50' },
  naranja: { rotulo: 'CHAMARRAS', precio: '$150' },
};

const ROPA = Object.values(CLOTH_COLORS);

/** Puesto con su lona de color, el perchero al fondo, la mesa con hule y montones de ropa, y su precio en cartulina. */
function puesto(lonaId: LonaId, seedId: string): Omit<ObjectArt, 'depth' | 'occluder'> {
  const W = 72;
  const H = 72;
  const p = painter(W, H);
  const lona = LONAS[lonaId];
  const giro = GIRO[lonaId];
  const seed = [...seedId].reduce((a, c) => a + c.charCodeAt(0), 0);

  // Postes traseros y tubo del perchero.
  p.rect(7, 14, 2, 32, METAL.shade);
  p.rect(63, 14, 2, 32, METAL.shade);
  p.rect(8, 22, 56, 1, METAL.base);
  // Ropa colgada: playeras y pantalones.
  for (let i = 0, x = 10; x < 60; i++, x += 7) {
    const c = pick(ROPA, seed, i, 3);
    if (hash(seed, i, 4) < 0.7) {
      p.rect(x, 23, 6, 3, c.base);
      p.rect(x + 1, 26, 4, 9, c.base);
      p.rect(x + 4, 26, 1, 9, c.shadow);
      p.px(x + 2, 23, hundido(c.base, 0.4));
      p.px(x + 3, 23, hundido(c.base, 0.4));
    } else {
      p.rect(x + 1, 23, 4, 3, c.base);
      p.rect(x + 1, 26, 2, 12, c.base);
      p.rect(x + 3, 26, 2, 12, c.shadow);
    }
    p.px(x + 2, 22, METAL.light);
  }
  // Luz de la lona sobre todo lo que queda debajo.
  p.rect(6, 20, 60, 26, `${lona.hondo}33`);

  // Mesa con hule de cuadritos.
  p.rect(8, 44, 56, 8, CAL.base);
  for (let y = 44; y < 52; y += 2) {
    for (let x = 8 + ((y / 2) % 2) * 2; x < 64; x += 4)
      p.rect(x, y, 2, 2, mix(lona.luz, '#ffffff', 0.35));
  }
  p.rect(8, 44, 56, 1, '#ffffff');
  // Montones de ropa doblada.
  for (let i = 0; i < 5; i++) {
    const x = 11 + i * 11;
    const layers = 2 + Math.floor(hash(seed, i, 5) * 2);
    for (let l = 0; l < layers; l++) {
      const c = pick(ROPA, seed + l, i, 6);
      const y = 45 - l * 3;
      p.rect(x, y, 9, 3, c.base);
      p.rect(x, y, 9, 1, c.light);
      p.rect(x + 8, y, 1, 3, c.shadow);
    }
  }
  // Faldón del hule y patas.
  p.rect(8, 52, 56, 11, mix(lona.luz, '#ffffff', 0.55));
  for (let x = 12; x < 64; x += 6) p.rect(x, 52, 1, 11, mix(lona.luz, '#ffffff', 0.2));
  p.rect(8, 62, 56, 1, mix(lona.hondo, '#ffffff', 0.35));
  p.rect(11, 63, 2, 6, WOOD.shadow);
  p.rect(59, 63, 2, 6, WOOD.shadow);

  // Precio en cartulina fosforescente, pegado con masking.
  const board = pick(FOSFO, seed, 1, 8);
  const bw = signWidth(giro.precio) + 6;
  const bx = 36 - Math.floor(bw / 2) + (seed % 3) - 1;
  p.rect(bx, 54, bw, 9, board);
  p.rect(bx + 1, 62, bw, 1, hundido(board, 0.5));
  sign(p, giro.precio, bx + 3, 56, PLUMON);
  p.rect(bx + Math.floor(bw / 2) - 2, 53, 5, 2, '#e9dbb1');

  // Postes del frente.
  for (const x of [4, 66]) {
    p.rect(x, 16, 2, 54, METAL.base);
    p.rect(x, 16, 1, 54, METAL.light);
  }

  // La lona: tela tensa con pliegues de luz y su cenefa rotulada.
  for (let y = 3; y < 18; y++) {
    const t = (y - 3) / 15;
    const inset = Math.round(7 * (1 - t));
    for (let x = inset; x < W - inset; x++) {
      const fold = (x + y * 2) % 13;
      let c = fold < 2 ? lona.luz : fold > 10 ? lona.hondo : lona.base;
      if (y === 3 || x === inset || x === W - inset - 1) c = lona.hondo;
      p.px(x, y, c);
    }
  }
  p.rect(0, 18, W, 6, lona.base);
  p.rect(0, 18, W, 1, lona.luz);
  // En la lona amarilla el rótulo va en plumón: la cal no se leería.
  const tinta = lonaId === 'amarilla' ? PLUMON : CAL.base;
  sign(p, giro.rotulo, Math.round((W - signWidth(giro.rotulo)) / 2), 19, tinta);
  // Flecos en triángulo.
  for (let x = 0; x < W; x += 6) {
    p.rect(x, 24, 5, 1, lona.hondo);
    p.rect(x + 1, 25, 3, 1, lona.hondo);
    p.px(x + 2, 26, lona.hondo);
  }

  return { canvas: p.canvas, ox: -4, oy: -40 };
}

// ─── Banca ────────────────────────────────────────────────────────────────

function banca(): Omit<ObjectArt, 'depth' | 'occluder'> {
  const p = painter(32, 26);
  // Respaldo.
  for (const x of [2, 29]) {
    p.rect(x, 1, 2, 20, HIERRO.base);
    p.px(x, 1, HIERRO.light);
  }
  for (const y of [3, 7]) {
    p.rect(3, y, 26, 3, WOOD.base);
    p.rect(3, y + 2, 26, 1, WOOD.shadow);
  }
  // Asiento de tablas visto desde arriba.
  for (const y of [11, 14]) {
    p.rect(1, y, 30, 3, WOOD.base);
    p.rect(1, y, 30, 1, mix(WOOD.base, '#fff4d6', 0.3));
    p.rect(1, y + 2, 30, 1, WOOD.shadow);
  }
  p.rect(1, 17, 30, 2, WOOD.shadow);
  // Brazos y patas de hierro con su rizo.
  for (const x of [0, 30]) {
    p.rect(x, 10, 2, 2, HIERRO.base);
    p.rect(x, 19, 2, 6, HIERRO.base);
    p.px(x === 0 ? 2 : 29, 24, HIERRO.base);
  }
  p.rect(0, 25, 32, 1, 'rgb(43 18 56 / 0.2)');
  return { canvas: p.canvas, ox: 0, oy: -10 };
}

// ─── Jacaranda ────────────────────────────────────────────────────────────

const COPA: [number, number, number][] = [
  [32, 24, 19],
  [16, 32, 13],
  [48, 31, 14],
  [22, 15, 12],
  [42, 14, 13],
  [32, 38, 13],
  [9, 40, 7],
  [55, 40, 7],
];

/** Jacaranda en flor: tronco con ramas y una copa de racimos morados. */
function jacaranda(seedId: string): Omit<ObjectArt, 'depth' | 'occluder'> {
  const W = 64;
  const H = 80;
  const p = painter(W, H);
  const seed = [...seedId].reduce((a, c) => a + c.charCodeAt(0), 0);

  // Tronco con raíces, corteza y ramas.
  p.rect(27, 72, 11, 5, CORTEZA.shade);
  p.rect(29, 42, 6, 34, CORTEZA.base);
  p.rect(29, 42, 1, 34, CORTEZA.light);
  p.rect(33, 42, 2, 34, CORTEZA.shade);
  for (let y = 46; y < 72; y += 5) p.px(31 + (y % 2), y, CORTEZA.shade);
  branch(p, 31, 46, 16, 28);
  branch(p, 33, 44, 47, 24);
  branch(p, 32, 44, 31, 18);

  // Copa: racimos. El tono depende de la «altura» del racimo en cada pixel.
  for (let y = 0; y < 56; y++) {
    for (let x = 0; x < W; x++) {
      let best = -1;
      let bx = 0;
      let by = 0;
      for (const [cx, cy, r] of COPA) {
        const d = 1 - Math.hypot(x - cx, (y - cy) * 1.1) / r;
        if (d > best) {
          best = d;
          bx = (x - cx) / r;
          by = (y - cy) / r;
        }
      }
      if (best <= 0) continue;
      // Huecos en la orilla por donde se asoma el suelo y las ramas.
      if (best < 0.14 && hash(x, y, seed) < 0.35) continue;
      const light = -bx * 0.6 - by * 0.8;
      const bloom = hash(Math.floor(x / 2), Math.floor(y / 2), seed + 1);
      let c = light > 0.35 ? JACARANDA.light : light < -0.35 ? JACARANDA.shade : JACARANDA.flower;
      if (best < 0.12) c = light > 0 ? JACARANDA.flower : JACARANDA.deep;
      if (bloom > 0.9 && light > -0.2) c = JACARANDA.lighter;
      else if (bloom < 0.08) c = JACARANDA.deep;
      p.px(x, y, c);
    }
  }
  return { canvas: p.canvas, ox: -24, oy: -64 };
}

function branch(p: Painter, x0: number, y0: number, x1: number, y1: number): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    p.rect(x, y, 2, 2, i % 3 ? CORTEZA.base : CORTEZA.shade);
  }
}

// ─── Farol ────────────────────────────────────────────────────────────────

function farol(): Omit<ObjectArt, 'depth' | 'occluder'> {
  const p = painter(16, 56);
  p.rect(7, 0, 2, 2, FAROL.base);
  p.rect(4, 2, 8, 2, FAROL.base);
  p.rect(5, 2, 3, 1, FAROL.light);
  // Vidrio con su luz tibia (de día apagada, pero se ve cálido).
  p.rect(5, 4, 6, 8, FAROL.glass);
  p.rect(6, 5, 2, 5, FAROL.glow);
  p.rect(5, 4, 1, 8, FAROL.base);
  p.rect(10, 4, 1, 8, FAROL.base);
  p.rect(7, 4, 1, 8, hundido(FAROL.glass, 0.2));
  p.rect(4, 12, 8, 2, FAROL.base);
  p.rect(6, 14, 4, 2, FAROL.base);
  // Poste con anillos.
  p.rect(7, 16, 2, 32, FAROL.base);
  p.rect(7, 16, 1, 32, FAROL.light);
  for (const y of [28, 42]) p.rect(6, y, 4, 2, FAROL.base);
  // Base.
  p.rect(5, 48, 6, 6, FAROL.base);
  p.rect(5, 48, 6, 1, FAROL.light);
  p.rect(4, 53, 8, 2, FAROL.base);
  return { canvas: p.canvas, ox: 0, oy: -40 };
}

// ─── Fachada del Café ─────────────────────────────────────────────────────

const VERDE_BOTELLA = { base: '#1f5a47', light: '#2e7a60', shade: '#153f32' };

/** El Café: verde botella con rótulo de cal, toldo rayado de lona rosa, vitrinas tibias y puerta de madera. */
function fachadaCafe(): Omit<ObjectArt, 'depth' | 'occluder'> {
  const W = 96;
  const H = 48;
  const p = painter(W, H);
  p.rect(0, 0, W, H, VERDE_BOTELLA.base);
  for (let y = 4; y < H - 4; y++) {
    for (let x = 0; x < W; x++) {
      const r = hash(x, y, 777);
      if (r < 0.05) p.px(x, y, VERDE_BOTELLA.shade);
      else if (r > 0.98) p.px(x, y, VERDE_BOTELLA.light);
    }
  }
  p.rect(0, 0, W, 1, CAL.deep);
  p.rect(0, 1, W, 2, CAL.base);
  p.rect(0, 3, W, 1, VERDE_BOTELLA.shade);
  p.rect(0, 4, 1, H - 8, VERDE_BOTELLA.light);
  p.rect(W - 1, 4, 1, H - 8, VERDE_BOTELLA.shade);

  // Rótulo grande: CAFÉ en cal con sombra de rotulista.
  const text = 'CAFÉ';
  const tw = signWidth(text, 2);
  const tx = Math.round((W - tw) / 2);
  sign(p, text, tx + 1, 8, VERDE_BOTELLA.shade, 2);
  sign(p, text, tx, 7, '#fff4d6', 2);

  // Toldo rayado con festones.
  for (let x = 0; x < W; x++) {
    const stripe = Math.floor(x / 6) % 2 === 0;
    const c = stripe ? LONAS.rosa.base : CAL.base;
    p.rect(x, 18, 1, 7, c);
    const d = Math.round(2 * Math.sin((Math.PI * ((x % 6) + 0.5)) / 6));
    p.rect(x, 25, 1, d, c);
    p.px(x, 25 + d, stripe ? LONAS.rosa.hondo : CAL.deep);
  }
  p.rect(0, 18, W, 1, LONAS.rosa.luz);
  p.rect(0, 28, W, 2, 'rgb(43 18 56 / 0.28)');

  // Vitrinas: luz tibia de adentro, tazas en la repisa y una planta.
  for (const vx of [6, 62]) {
    p.rect(vx - 1, 29, 30, 15, CAL.base);
    for (let y = 30; y < 43; y++) p.rect(vx, y, 28, 1, mix('#ffd98a', '#f2a24e', (y - 30) / 13));
    p.rect(vx, 38, 28, 1, WOOD.shadow);
    for (let i = 0; i < 4; i++) {
      p.rect(vx + 3 + i * 6, 35, 3, 3, i % 2 ? '#fff4d6' : LONAS.rosa.luz);
      p.px(vx + 6 + i * 6, 36, i % 2 ? '#fff4d6' : LONAS.rosa.luz);
    }
    p.rect(vx + 13, 30, 1, 13, CAL.base);
    p.rect(vx + 22, 39, 4, 4, '#b8532e');
    p.rect(vx + 22, 33, 4, 6, '#3f9d68');
    p.px(vx + 21, 34, '#56a04a');
    p.px(vx + 26, 35, '#56a04a');
    p.px(vx + 2, 31, '#fff6d4');
    p.px(vx + 3, 30, '#fff6d4');
  }

  // Puerta de madera con vidrio; el escalón es la entrada del portal.
  p.rect(38, 27, 20, 19, CAL.base);
  p.rect(40, 29, 16, 17, WOOD.base);
  p.rect(40, 29, 1, 17, mix(WOOD.base, '#fff4d6', 0.3));
  p.rect(42, 31, 12, 6, '#ffd98a');
  p.rect(42, 39, 12, 5, WOOD.shadow);
  p.px(54, 38, '#f0cf45');
  p.rect(36, 46, 24, 2, CANTERA.light);
  // Arbotantes a los lados de la puerta.
  for (const lx of [34, 60]) {
    p.rect(lx, 30, 2, 3, FAROL.base);
    p.rect(lx, 33, 2, 2, FAROL.glass);
  }

  return { canvas: p.canvas, ox: 0, oy: 0 };
}

// ─── Papel picado ─────────────────────────────────────────────────────────

/** Tres cuadros por banderita: quieta, meciéndose a la izquierda y a la derecha. */
export const FLAG_W = 7;
export const FLAG_H = 9;
const FLAG = [
  '#######',
  '#######',
  '#.###.#',
  '##.#.##',
  '###.###',
  '##.#.##',
  '#.###.#',
  '#######',
  '#.#.#.#',
];

export function papelPicadoFlag(color: string, lean: -1 | 0 | 1): HTMLCanvasElement {
  const p = painter(FLAG_W + 2, FLAG_H);
  FLAG.forEach((row, y) => {
    // La parte de abajo se va más lejos que la de arriba.
    const shift = y >= 5 ? lean : 0;
    for (let x = 0; x < FLAG_W; x++) {
      if (row[x] !== '#') continue;
      p.px(1 + x + shift, y, y === 0 ? hundido(color, 0.3) : color);
    }
  });
  return p.canvas;
}

/** Colores de una tira de papel picado, en orden de fiesta. */
export function flagColor(i: number): string {
  return PAPEL_PICADO[i % PAPEL_PICADO.length] ?? PAPEL_PICADO[0];
}

// ─── Sombras horneadas en el suelo ────────────────────────────────────────

export function objectShadow(p: Painter, o: MapObject): void {
  const x = o.x * TILE;
  const y = o.y * TILE;
  const w = o.w * TILE;
  const h = o.h * TILE;
  switch (o.kind) {
    case 'kiosko':
      p.ellipse(x + w / 2 + 8, y + h - 10, w / 2 + 6, 18, SOMBRA);
      break;
    case 'puesto': {
      // La lona tiñe el suelo de su color: la regla de la interfaz, en el mundo.
      const lona = LONAS[isLona(o.variant) ? o.variant : 'rosa'];
      p.rect(x - 2, y + h, w + 4, 9, `${lona.luz}40`);
      p.rect(x - 2, y + h, w + 4, 3, `${lona.hondo}30`);
      p.rect(x, y + h - 2, w, 2, SOMBRA);
      break;
    }
    case 'banca':
      p.rect(x + 2, y + h - 2, w - 2, 3, SOMBRA_SUAVE);
      break;
    case 'jacaranda': {
      // Sombra moteada de la copa: elipse con huecos de luz.
      const cx = x + 10;
      const cy = y + 10;
      for (let yy = -10; yy <= 10; yy++) {
        for (let xx = -26; xx <= 26; xx++) {
          if ((xx * xx) / 676 + (yy * yy) / 100 > 1) continue;
          if (hash(cx + xx, cy + yy, 5) < 0.18) continue;
          p.px(cx + xx, cy + yy, SOMBRA_SUAVE);
        }
      }
      p.ellipse(x + 8, y + 13, 6, 2, SOMBRA);
      break;
    }
    case 'farol':
      p.ellipse(x + 9, y + 14, 5, 2, SOMBRA);
      break;
    case 'mesa':
      p.ellipse(x + w / 2, y + h - 1, w / 2 - 4, 3, SOMBRA_SUAVE);
      break;
    case 'barra':
    case 'vitroleros':
      p.rect(x + 1, y + h, w - 1, 3, SOMBRA);
      p.rect(x + 1, y + h + 3, w - 1, 2, SOMBRA_SUAVE);
      break;
    case 'maceta':
      p.ellipse(x + 8, y + 14, 7, 2, SOMBRA);
      break;
    default:
      break;
  }
}
