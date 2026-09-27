import type { GroundKind, MapDef } from '@wous/world-data';
import { mix, WOOD } from '../rendering/palette.ts';
import { hash, type Painter, painter, sign, signWidth } from './paint.ts';
import {
  CAL,
  CANTERA,
  FAROL,
  FOSFO,
  hundido,
  LONAS,
  METAL,
  PLUMON,
  TILE,
} from './world-palette.ts';

/**
 * El Café por dentro. Café de barrio: piso de mosaico de pasta, lambrín
 * verde botella con franja de talavera, la barra de azulejo con la vitrina
 * del pan dulce y la olla del café, vitroleros de agua fresca, mesas con hule
 * y sillas plegables, y series de focos pelones. Todo con la misma luz de día
 * que entra por la puerta y la ventana; los focos solo calientan.
 */

type KindAt = (tx: number, ty: number) => GroundKind | null;

export const VERDE_BOTELLA = { base: '#1f5a47', light: '#2e7a60', shade: '#153f32' };

/** Mosaico de pasta deslavado: el piso acompaña, no compite con la gente. */
const MOSAICO = {
  crema: '#eadfc8',
  cremaLuz: '#f2e9d6',
  cremaSombra: '#e0d3b8',
  junta: '#d3c3a3',
  flor: '#d4a184',
  florCentro: '#bb7f60',
  hoja: '#a9bca3',
  cenefa: '#c9927a',
  cenefaSombra: '#b88168',
};

const TALAVERA = { fondo: '#f5f0e4', cobalto: '#2a4fa8', cielo: '#6f93dc', sombra: '#d8d0bf' };
const BARRO = { base: '#a8532f', light: '#c96d45', shade: '#7f3a20', deep: '#5e2915' };
const REPELLO = { base: '#f1e3c6', speck: '#e3d1ad', light: '#f8eed9' };
const SILLAS: Record<string, string> = {
  rojo: '#2f6b57',
  azul: '#e0a92e',
  verde: '#c8352b',
  amarillo: '#3a5cc4',
};
const HULE: Record<string, string> = {
  rojo: '#d23a3a',
  azul: '#2f5fc8',
  verde: '#2f9a5c',
  amarillo: '#f0bf2a',
};

// ─── Suelo ─────────────────────────────────────────────────────────────────

/**
 * Mosaico de pasta de 16×16, deslavado: losas lisas alternadas con losas de
 * flor (cuatro pétalos de terracota y hojitas de salvia). La hilera junto a
 * los muros es cenefa lisa con su filete. Cada losa con su tono y su desgaste.
 */
export function mosaico(
  gx: number,
  gy: number,
  lx: number,
  ly: number,
  tx: number,
  ty: number,
  kindAt: KindAt,
): string {
  if (lx === 15 || ly === 15) return MOSAICO.junta;
  const wear = hash(gx, gy, 131);
  const cenefa =
    kindAt(tx - 1, ty) === 'pared' ||
    kindAt(tx + 1, ty) === 'pared' ||
    kindAt(tx, ty - 1) === 'pared' ||
    kindAt(tx, ty + 1) === 'pared';
  if (cenefa) {
    if (lx === 2 || ly === 2 || lx === 12 || ly === 12) return MOSAICO.cremaLuz;
    return wear < 0.06 ? MOSAICO.cenefaSombra : MOSAICO.cenefa;
  }
  let color = hash(tx, ty, 132) < 0.35 ? MOSAICO.cremaSombra : MOSAICO.crema;
  if ((tx + ty) % 2 === 1) {
    const u = lx - 7;
    const v = ly - 7;
    const petalo = [
      [0, -3.2],
      [0, 3.2],
      [-3.2, 0],
      [3.2, 0],
    ].some(([px, py]) => Math.hypot(u - (px ?? 0), v - (py ?? 0)) < 2.1);
    if (Math.hypot(u, v) < 1.2) color = MOSAICO.florCentro;
    else if (petalo) color = MOSAICO.flor;
    else if (Math.abs(Math.abs(u) - 4.5) < 1 && Math.abs(Math.abs(v) - 4.5) < 1) {
      color = MOSAICO.hoja;
    }
  }
  // Desgaste del cemento: poros sueltos.
  if (wear < 0.025) return hundido(color, 0.08);
  if (wear > 0.99) return MOSAICO.cremaLuz;
  return color;
}

/** Repello de la pared del fondo (el lambrín y lo colgado se pintan aparte). */
export function repello(gx: number, gy: number): string {
  const r = hash(gx, gy, 141);
  if (r < 0.05) return REPELLO.speck;
  if (r > 0.985) return REPELLO.light;
  return REPELLO.base;
}

/** Tapa de los muros de los lados y de abajo, vista desde arriba. */
export function muro(lx: number, ly: number, tx: number, ty: number, kindAt: KindAt): string {
  const floor = (dx: number, dy: number) => {
    const k = kindAt(tx + dx, ty + dy);
    return k !== null && k !== 'pared';
  };
  // Canto que da al piso: una línea de luz; el resto, aplanado más oscuro.
  if ((floor(1, 0) && lx === 15) || (floor(-1, 0) && lx === 0) || (floor(0, -1) && ly === 0)) {
    return CAL.base;
  }
  if ((floor(1, 0) && lx === 14) || (floor(-1, 0) && lx === 1) || (floor(0, -1) && ly === 1)) {
    return CAL.deep;
  }
  return (lx + ly) % 7 === 0 ? '#b99f7c' : '#c9b08c';
}

// ─── Pared del fondo y puerta ────────────────────────────────────────────

/**
 * La pared del fondo vista de frente (como las fachadas de la Plaza): cornisa,
 * repello, repisa con frascos y jarritos colgados detrás de la barra, menú en
 * cartulinas, reloj, ventana al patio con su bugambilia y una carta de
 * lotería. Abajo, el lambrín. También la puerta en el muro de abajo.
 */
export function paintInterior(p: Painter, map: MapDef, kindAt: KindAt): void {
  if (kindAt(1, 0) !== 'pared') return;
  let rows = 0;
  while (rows < map.height && kindAt(1, rows) === 'pared') rows++;
  const fh = rows * TILE;
  const w = map.width * TILE;

  // Cornisa de cal y su sombra.
  p.rect(0, 0, w, 1, CAL.deep);
  p.rect(0, 1, w, 2, CAL.base);
  p.rect(0, 3, w, 1, REPELLO.speck);

  lambrin(p, 0, fh, w);
  cartulinasDelMenu(p, 34, 5);
  repisa(p, 32, 22, 144);
  reloj(p, 180, 5);
  ventana(p, 206, 6, 62, 26);
  loteria(p, 290, 7);

  // Puerta al fondo del muro de abajo: el umbral de cantera con la luz de la Plaza.
  const door = map.portals[0];
  if (door) {
    const dx = Math.round(door.x * TILE) - 16;
    const dy = (map.height - 1) * TILE;
    p.rect(dx, dy, 32, TILE, CANTERA.light);
    for (let y = 0; y < TILE; y++) {
      p.rect(dx, dy + y, 32, 1, mix(CANTERA.lighter, '#fff8e6', 1 - y / TILE));
    }
    p.rect(dx - 3, dy, 3, TILE, VERDE_BOTELLA.base);
    p.rect(dx + 32, dy, 3, TILE, VERDE_BOTELLA.base);
    p.rect(dx - 3, dy, 1, TILE, VERDE_BOTELLA.light);
    p.rect(dx + 34, dy, 1, TILE, VERDE_BOTELLA.shade);
  }
}

/** Lambrín: barandal de madera, franja de talavera y tablones verde botella. */
function lambrin(p: Painter, x: number, fh: number, w: number): void {
  const top = fh - 15;
  p.rect(x, top, w, 2, WOOD.base);
  p.rect(x, top, w, 1, mix(WOOD.base, '#fff4d6', 0.35));
  for (let tx = 0; tx < w; tx += 6) talaveraMini(p, x + tx, top + 2);
  p.rect(x, top + 8, w, 7, VERDE_BOTELLA.base);
  p.rect(x, top + 8, w, 1, VERDE_BOTELLA.light);
  for (let bx = 11; bx < w; bx += 12) p.rect(x + bx, top + 9, 1, 6, VERDE_BOTELLA.shade);
  p.rect(x, fh - 1, w, 1, VERDE_BOTELLA.shade);
}

/** Azulejo de 6×6 para la franja: fondo de loza y flor de cobalto. */
function talaveraMini(p: Painter, x: number, y: number): void {
  p.rect(x, y, 6, 6, TALAVERA.fondo);
  p.rect(x + 2, y + 2, 2, 2, TALAVERA.cobalto);
  p.px(x, y, TALAVERA.cielo);
  p.px(x + 5, y, TALAVERA.cielo);
  p.px(x, y + 5, TALAVERA.cielo);
  p.px(x + 5, y + 5, TALAVERA.cielo);
  p.px(x + 2, y, TALAVERA.cobalto);
  p.px(x + 3, y + 5, TALAVERA.cobalto);
  p.rect(x + 5, y, 1, 6, TALAVERA.sombra);
}

/** El menú: cartulinas fosforescentes con plumón, pegadas con masking y un poco chuecas. */
function cartulinasDelMenu(p: Painter, x: number, y: number): void {
  const items: [string, string][] = [
    ['CAFÉ $25', FOSFO[0]],
    ['PAN $12', FOSFO[2]],
    ['CHOCO $30', FOSFO[3]],
  ];
  let cx = x;
  items.forEach(([text, color], i) => {
    const cw = signWidth(text) + 6;
    const cy = y + (i % 2);
    p.rect(cx + 1, cy + 1, cw, 10, 'rgb(43 18 56 / 0.18)');
    p.rect(cx, cy, cw, 10, color);
    p.rect(cx, cy + 9, cw, 1, hundido(color, 0.25));
    sign(p, text, cx + 3, cy + 3, PLUMON);
    // Masking en las esquinas de arriba.
    p.rect(cx - 1, cy - 1, 4, 2, '#efe2c4');
    p.rect(cx + cw - 3, cy - 1, 4, 2, '#efe2c4');
    cx += cw + 5;
  });
}

/** Repisa con frascos de dulces y galletas y, abajo, jarritos colgados de sus clavos. */
function repisa(p: Painter, x: number, y: number, w: number): void {
  // Tabla y ménsulas.
  p.rect(x, y, w, 2, WOOD.base);
  p.rect(x, y, w, 1, mix(WOOD.base, '#fff4d6', 0.3));
  p.rect(x, y + 2, w, 1, WOOD.shadow);
  for (const bx of [x + 6, x + w - 8]) {
    p.rect(bx, y + 2, 2, 4, WOOD.shadow);
    p.px(bx + 1, y + 6, WOOD.gap);
  }
  // Frascos sobre la tabla.
  const frascos = ['#e0a340', '#ff72b4', '#6a3d22', '#7cc36a', '#e0a340', '#f4ede2', '#ff72b4'];
  frascos.forEach((contenido, i) => {
    const fx = x + 4 + i * 20;
    frasco(p, fx, y - 8, contenido, i % 3 === 0);
  });
  // Jarritos colgados de clavos bajo la repisa.
  for (let i = 0; i < 8; i++) {
    const jx = x + 12 + i * 16;
    p.px(jx + 2, y + 3, METAL.shade);
    jarrito(p, jx, y + 4, i % 2 === 0);
  }
}

function frasco(p: Painter, x: number, y: number, contenido: string, alto: boolean): void {
  const h = alto ? 8 : 6;
  const top = y + (8 - h);
  p.rect(x + 1, top - 1, 5, 1, METAL.base);
  p.rect(x, top, 7, h, '#d7ebe8');
  p.rect(x + 1, top + 2, 5, h - 2, contenido);
  p.px(x + 1, top + 1, '#ffffff');
  p.rect(x + 6, top, 1, h, '#b9d2cf');
}

/** Jarrito de barro de 5×5 con su asa; `boca` lo pinta boca arriba (colgado se ve de lado). */
function jarrito(p: Painter, x: number, y: number, boca: boolean): void {
  p.rect(x, y, 4, 4, BARRO.base);
  p.rect(x, y, 4, 1, boca ? BARRO.deep : BARRO.light);
  p.px(x, y + 1, BARRO.light);
  p.rect(x + 4, y + 1, 1, 2, BARRO.shade);
  p.rect(x + 1, y + 2, 2, 1, '#f4ede2');
}

function reloj(p: Painter, x: number, y: number): void {
  p.ellipse(x + 6, y + 6, 6.5, 6.5, PLUMON);
  p.ellipse(x + 6, y + 6, 5.4, 5.4, '#fbf3df');
  p.rect(x + 6, y + 2, 1, 5, PLUMON);
  p.rect(x + 6, y + 6, 3, 1, LONAS.rosa.base);
  for (const [dx, dy] of [
    [6, 1],
    [11, 6],
    [6, 11],
    [1, 6],
  ] as const) {
    p.px(x + dx, y + dy, hundido('#fbf3df', 0.4));
  }
}

/** Ventana al patio: cielo, la barda rosa con su bugambilia y una cortinita de lona. */
function ventana(p: Painter, x: number, y: number, w: number, h: number): void {
  p.rect(x - 2, y - 2, w + 4, h + 4, CAL.base);
  p.rect(x - 2, y + h + 2, w + 4, 1, CAL.deep);
  for (let yy = 0; yy < h; yy++) {
    p.rect(x, y + yy, w, 1, mix('#8fcbe6', '#d6eef4', yy / h));
  }
  // Barda del patio.
  const barda = y + Math.round(h * 0.55);
  p.rect(x, barda, w, y + h - barda, '#e5487f');
  p.rect(x, barda, w, 1, '#f27aa5');
  // Bugambilia: racimos que se desbordan por la barda.
  for (let i = 0; i < 70; i++) {
    const bx = x + Math.floor(hash(i, 3, 151) * w);
    const by = barda - 4 + Math.floor(hash(i, 4, 151) * 9);
    if (by >= y + h) continue;
    const c = hash(i, 5, 151);
    p.px(bx, by, c < 0.35 ? '#2f7d4f' : c < 0.7 ? '#c2187a' : '#ff5fae');
  }
  // Travesaño y parteluz.
  p.rect(x + Math.floor(w / 2), y, 2, h, CAL.base);
  p.rect(x, y + Math.floor(h / 2), w, 1, CAL.shade);
  // Cortinita de lona rosa con festones.
  for (let xx = 0; xx < w; xx++) {
    const d = Math.round(2 * Math.sin((Math.PI * ((xx % 8) + 0.5)) / 8));
    p.rect(x + xx, y, 1, 4 + d, LONAS.rosa.base);
    p.px(x + xx, y + 4 + d, LONAS.rosa.hondo);
  }
  p.rect(x, y, w, 1, LONAS.rosa.luz);
}

/** Carta de lotería enmarcada: el corazón. */
function loteria(p: Painter, x: number, y: number): void {
  p.rect(x - 1, y - 1, 16, 22, WOOD.shadow);
  p.rect(x, y, 14, 20, '#fbf3df');
  p.rect(x + 1, y + 1, 12, 18, hundido('#fbf3df', 0.05));
  // Corazón.
  const heart = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  heart.forEach((row, hy) => {
    for (let hx = 0; hx < row.length; hx++) {
      if (row[hx] === '#') p.px(x + 4 + hx - 1, y + 5 + hy, '#d23a3a');
    }
  });
  p.px(x + 4, y + 6, '#ff9a9a');
  p.rect(x + 2, y + 14, 10, 1, PLUMON);
  p.rect(x + 2, y + 16, 7, 1, hundido('#fbf3df', 0.35));
  p.rect(x + 1, y + 1, 3, 3, '#fbf3df');
  p.px(x + 2, y + 2, PLUMON);
}

// ─── Objetos ────────────────────────────────────────────────────────────────

type Art = { canvas: HTMLCanvasElement; ox: number; oy: number };

/**
 * La barra: cubierta de madera y frente de azulejo de talavera. Encima, la
 * vitrina del pan dulce, la caja registradora, la olla del café de olla con
 * su vapor y los jarritos apilados.
 */
export function barra(w: number, h: number): Art {
  const W = w * TILE;
  const top = 18;
  const H = h * TILE + top;
  const p = painter(W, H);
  // Cubierta (se ve desde arriba).
  const cy = top;
  p.rect(0, cy, W, 10, WOOD.base);
  p.rect(0, cy, W, 1, WOOD.shadow);
  for (let x = 0; x < W; x += 23) p.rect(x, cy + 1, 1, 9, mix(WOOD.base, WOOD.shadow, 0.35));
  p.rect(0, cy + 9, W, 1, mix(WOOD.base, '#fff4d6', 0.4));
  // Frente de talavera.
  const fy = cy + 10;
  const fh = H - fy - 3;
  for (let ty = 0; ty < fh; ty += 8) {
    for (let tx = 0; tx < W; tx += 8) azulejo(p, tx, fy + ty, Math.min(8, fh - ty), (tx + ty) % 16);
  }
  p.rect(0, fy, W, 1, WOOD.shadow);
  p.rect(0, H - 3, W, 3, WOOD.shadow);
  p.rect(0, H - 3, W, 1, WOOD.base);
  p.rect(0, fy, 1, fh, hundido(TALAVERA.fondo, 0.15));
  p.rect(W - 1, fy, 1, fh + 3, hundido(TALAVERA.fondo, 0.3));

  vitrinaDePan(p, 8, 2);
  cajaRegistradora(p, 58, 10);
  olla(p, 84, 4);
  // Jarritos apilados y servilletero.
  for (const [jx, jy] of [
    [112, 20],
    [117, 20],
    [114, 16],
  ] as const) {
    jarrito(p, jx, jy, true);
  }
  p.rect(128, 18, 8, 6, '#f4ede2');
  p.rect(128, 23, 8, 2, METAL.shade);
  return { canvas: p.canvas, ox: 0, oy: -top };
}

function azulejo(p: Painter, x: number, y: number, h: number, seed: number): void {
  p.rect(x, y, 8, h, TALAVERA.fondo);
  if (h < 8) return;
  p.rect(x + 3, y + 3, 2, 2, TALAVERA.cobalto);
  p.px(x + 3, y + 1, TALAVERA.cobalto);
  p.px(x + 4, y + 6, TALAVERA.cobalto);
  p.px(x + 1, y + 4, TALAVERA.cobalto);
  p.px(x + 6, y + 3, TALAVERA.cobalto);
  p.px(x + 2, y + 2, TALAVERA.cielo);
  p.px(x + 5, y + 5, TALAVERA.cielo);
  p.px(x + 5, y + 2, TALAVERA.cielo);
  p.px(x + 2, y + 5, TALAVERA.cielo);
  if (seed === 0) p.px(x + 4, y + 4, '#e0a340');
  p.rect(x + 7, y, 1, h, TALAVERA.sombra);
  p.rect(x, y + 7, 8, 1, TALAVERA.sombra);
}

/** Vitrina de pan dulce: dos pisos de conchas, cuernos y orejas detrás del vidrio. */
function vitrinaDePan(p: Painter, x: number, y: number): void {
  const w = 40;
  const h = 24;
  p.rect(x, y, w, h, METAL.light);
  p.rect(x + 1, y + 1, w - 2, h - 2, '#dcefed');
  p.rect(x + 1, y + 11, w - 2, 1, METAL.base);
  // Conchas (blancas, rosas y de chocolate) y cuernos.
  const conchas = ['#f7ead2', '#ff9ec8', '#7a4a2e', '#f7ead2', '#ff9ec8'];
  conchas.forEach((c, i) => {
    concha(p, x + 3 + i * 7, y + 5, c);
  });
  for (let i = 0; i < 4; i++) cuerno(p, x + 4 + i * 9, y + 15);
  // Reflejo del vidrio.
  p.rect(x + 2, y + 2, 1, 7, '#ffffff');
  p.rect(x + 3, y + 2, 1, 3, '#ffffff');
  p.rect(x, y + h, w, 1, METAL.shade);
}

function concha(p: Painter, x: number, y: number, cubierta: string): void {
  p.rect(x, y + 3, 6, 2, '#d99a52');
  p.rect(x, y + 1, 6, 3, cubierta);
  p.rect(x + 1, y, 4, 1, cubierta);
  p.px(x + 2, y + 2, hundido(cubierta, 0.25));
  p.px(x + 4, y + 1, hundido(cubierta, 0.25));
}

function cuerno(p: Painter, x: number, y: number): void {
  p.rect(x + 1, y, 5, 3, '#d99a52');
  p.px(x, y + 2, '#d99a52');
  p.px(x + 6, y + 2, '#d99a52');
  p.rect(x + 2, y, 1, 3, '#b87838');
  p.rect(x + 4, y, 1, 3, '#b87838');
}

function cajaRegistradora(p: Painter, x: number, y: number): void {
  p.rect(x, y + 4, 14, 12, METAL.base);
  p.rect(x, y + 4, 14, 1, METAL.light);
  p.rect(x + 2, y, 10, 5, METAL.shade);
  p.rect(x + 3, y + 1, 8, 3, '#8fe0a0');
  for (let ky = 0; ky < 2; ky++) {
    for (let kx = 0; kx < 4; kx++) p.px(x + 2 + kx * 3, y + 7 + ky * 3, PLUMON);
  }
  p.rect(x, y + 14, 14, 2, METAL.shade);
}

/** Olla de barro con su banda pintada, el cucharón y vapor que sube. */
function olla(p: Painter, x: number, y: number): void {
  p.ellipse(x + 10, y + 13, 10, 8, BARRO.base);
  p.ellipse(x + 7, y + 10, 4, 3, BARRO.light);
  // Grecas pintadas en el barro.
  for (let i = 0; i < 16; i++) p.px(x + 3 + i, y + 12 + ((i >> 1) % 2), '#f0d9a8');
  p.rect(x + 3, y + 5, 15, 2, BARRO.deep);
  p.rect(x + 4, y + 4, 13, 1, BARRO.light);
  // Cucharón.
  p.rect(x + 15, y, 1, 6, WOOD.shadow);
  // Vapor.
  for (const [vx, vy] of [
    [7, 1],
    [8, 0],
    [11, 2],
    [12, 1],
    [10, -1],
  ] as const) {
    p.px(x + vx, y + vy, 'rgb(255 255 255 / 0.7)');
  }
}

/** Vitroleros de agua fresca en su mesita: jamaica, horchata y limón. */
export function vitroleros(w: number): Art {
  const W = w * TILE;
  const top = 24;
  const H = TILE + top;
  const p = painter(W, H);
  // Mesita con su mantelito.
  p.rect(1, top + 2, W - 2, 3, WOOD.base);
  p.rect(1, top + 2, W - 2, 1, mix(WOOD.base, '#fff4d6', 0.3));
  p.rect(3, top + 5, 2, H - top - 6, WOOD.shadow);
  p.rect(W - 5, top + 5, 2, H - top - 6, WOOD.shadow);
  p.rect(1, top + 5, W - 2, 1, WOOD.shadow);
  const aguas = ['#b3163f', '#f3ead8', '#8fce52'];
  aguas.forEach((agua, i) => {
    const vx = 3 + i * 15;
    const vy = top - 20;
    p.rect(vx + 2, vy - 2, 8, 2, METAL.base);
    p.rect(vx, vy, 12, 22, '#d7ebe8');
    p.rect(vx + 1, vy + 5, 10, 16, agua);
    p.rect(vx + 1, vy + 5, 10, 1, mix(agua, '#ffffff', 0.4));
    p.rect(vx + 1, vy + 1, 1, 18, '#ffffff');
    p.rect(vx + 11, vy, 1, 22, '#b9d2cf');
    // Hielos y rodajas.
    p.px(vx + 4, vy + 8, 'rgb(255 255 255 / 0.8)');
    p.px(vx + 7, vy + 12, 'rgb(255 255 255 / 0.8)');
    p.rect(vx + 8, vy - 5, 1, 6, METAL.shade);
  });
  // Precio en cartulina.
  const label = '$20';
  const lw = signWidth(label) + 4;
  p.rect(W - lw - 2, top + 6, lw, 7, FOSFO[1]);
  sign(p, label, W - lw, top + 7, PLUMON);
  return { canvas: p.canvas, ox: 0, oy: -top };
}

/**
 * Mesa de fonda con hule de cuadros y dos sillas plegables. Cuatro tiles de
 * ancho: silla, mesa (dos tiles) y silla. Encima, café en jarrito y una concha.
 */
export function mesa(variant: string | undefined): Art {
  const W = 4 * TILE;
  const top = 22;
  const H = TILE + top;
  const p = painter(W, H);
  const hule = HULE[variant ?? ''] ?? HULE.rojo ?? '#d23a3a';
  const silla = SILLAS[variant ?? ''] ?? SILLAS.rojo ?? '#2f6b57';

  sillaPlegable(p, 2, top - 8, silla, false);
  sillaPlegable(p, W - 14, top - 8, silla, true);

  // Mesa: cubierta con hule de cuadros y su faldón con festones.
  const mx = 15;
  const mw = 34;
  const my = top - 10;
  for (let y = 0; y < 11; y++) {
    for (let x = 0; x < mw; x++) {
      const cuadro = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0;
      p.px(mx + x, my + y, cuadro ? hule : '#fbf3df');
    }
  }
  p.rect(mx, my, mw, 1, mix(hule, '#ffffff', 0.35));
  // Faldón: el hule cuelga al frente.
  for (let x = 0; x < mw; x++) {
    const d = Math.round(1.5 * Math.sin((Math.PI * ((x % 6) + 0.5)) / 6));
    const cuadro = Math.floor(x / 4) % 2 === 0;
    p.rect(mx + x, my + 11, 1, 4 + d, hundido(cuadro ? hule : '#fbf3df', 0.18));
  }
  // Patas.
  p.rect(mx + 4, my + 15, 2, H - my - 16, WOOD.shadow);
  p.rect(mx + mw - 6, my + 15, 2, H - my - 16, WOOD.shadow);
  p.rect(mx + 3, H - 2, 4, 1, WOOD.gap);
  p.rect(mx + mw - 7, H - 2, 4, 1, WOOD.gap);

  // Encima: dos jarritos con vapor y un plato con concha.
  jarrito(p, mx + 5, my + 3, true);
  jarrito(p, mx + mw - 10, my + 4, true);
  for (const [vx, vy] of [
    [mx + 6, my],
    [mx + 7, my - 1],
    [mx + mw - 9, my + 1],
  ] as const) {
    p.px(vx, vy, 'rgb(255 255 255 / 0.75)');
  }
  p.ellipse(mx + 17, my + 6, 5, 2.5, '#fbf3df');
  concha(p, mx + 14, my + 3, '#ff9ec8');
  return { canvas: p.canvas, ox: 0, oy: -top };
}

/** Silla plegable de lámina: respaldo, asiento y patas en tijera. `derecha` mira hacia la izquierda. */
function sillaPlegable(p: Painter, x: number, y: number, color: string, derecha: boolean): void {
  const light = mix(color, '#ffffff', 0.3);
  const shade = hundido(color, 0.3);
  const bx = derecha ? x + 9 : x;
  // Respaldo.
  p.rect(bx, y, 3, 14, color);
  p.rect(bx, y, 3, 1, light);
  p.rect(derecha ? bx + 2 : bx, y + 1, 1, 13, shade);
  // Asiento.
  p.rect(x, y + 12, 12, 3, color);
  p.rect(x, y + 12, 12, 1, light);
  p.rect(x, y + 14, 12, 1, shade);
  // Patas en tijera.
  for (let i = 0; i < 8; i++) {
    p.px(x + 2 + i, y + 15 + i, METAL.shade);
    p.px(x + 9 - i, y + 15 + i, METAL.base);
  }
}

/** Maceta de barro con monstera, cactus o helecho. */
export function maceta(variant: string | undefined): Art {
  const W = 24;
  const H = 34;
  const p = painter(W, H);
  const pot = (x: number, y: number, w: number, h: number) => {
    p.rect(x, y, w, h, BARRO.base);
    p.rect(x - 1, y, w + 2, 2, BARRO.light);
    p.rect(x + w - 2, y + 2, 2, h - 2, BARRO.shade);
    p.rect(x, y + 4, w - 2, 1, BARRO.shade);
  };
  if (variant === 'cactus') {
    p.rect(10, 8, 4, 18, '#3f9d68');
    p.rect(10, 8, 1, 18, '#56b07a');
    p.rect(6, 12, 3, 8, '#3f9d68');
    p.rect(6, 19, 4, 2, '#3f9d68');
    p.rect(15, 10, 3, 7, '#3f9d68');
    p.rect(14, 16, 4, 2, '#3f9d68');
    p.px(11, 7, '#ff4f9a');
    p.px(12, 6, '#ff4f9a');
    p.px(12, 7, '#ffd23f');
    pot(7, 25, 10, 8);
  } else if (variant === 'helecho') {
    // Frondas que caen hacia los lados.
    for (let i = 0; i < 7; i++) {
      const a = -1.3 + i * 0.43;
      for (let r = 2; r < 13; r++) {
        const fx = Math.round(12 + Math.sin(a) * r);
        const fy = Math.round(20 - Math.cos(a) * r * 0.9 + (r * r) / 18);
        p.px(fx, fy, r % 3 === 0 ? '#7dbd55' : '#4a8637');
        if (r > 4 && r % 2 === 0) p.px(fx + (a < 0 ? -1 : 1), fy + 1, '#5e9f42');
      }
    }
    pot(7, 24, 10, 9);
  } else {
    // Monstera: hojas grandes con sus cortes.
    const hojas: [number, number, number][] = [
      [8, 10, 6],
      [16, 8, 6],
      [12, 4, 5],
      [6, 17, 5],
      [18, 16, 5],
    ];
    for (const [hx, hy, r] of hojas) {
      p.ellipse(hx, hy, r, r * 0.8, '#2f7d4f');
      p.ellipse(hx - 1, hy - 1, r * 0.55, r * 0.4, '#4f9c64');
      p.rect(hx, hy - r + 1, 1, r * 2 - 2, '#256a41');
      p.px(hx + 2, hy - 1, '#ebdcbf');
      p.px(hx - 2, hy + 1, '#ebdcbf');
    }
    pot(6, 24, 12, 9);
  }
  return { canvas: p.canvas, ox: -4, oy: -18 };
}

/** Tapete de petate: palma tejida en diagonal con orilla rosa. */
export function tapete(w: number, h: number): Art {
  const W = w * TILE;
  const H = h * TILE;
  const p = painter(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const weave = (Math.floor((x + y) / 3) + Math.floor((x - y + 64) / 3)) % 2 === 0;
      p.px(x, y, weave ? '#d9b36a' : '#c49a4f');
    }
  }
  p.rect(0, 0, W, 2, LONAS.rosa.base);
  p.rect(0, H - 2, W, 2, LONAS.rosa.base);
  p.rect(0, 0, 2, H, LONAS.rosa.base);
  p.rect(W - 2, 0, 2, H, LONAS.rosa.base);
  return { canvas: p.canvas, ox: 0, oy: 0 };
}

// ─── Focos pelones ─────────────────────────────────────────────────────────

/** Un foco: casquillo, bombilla y su chispa. El halo va aparte (se suma a la luz). */
export function foco(): HTMLCanvasElement {
  const p = painter(5, 9);
  p.rect(2, 0, 1, 2, FAROL.base);
  p.rect(1, 2, 3, 2, FAROL.light);
  p.rect(1, 4, 3, 4, FAROL.glass);
  p.rect(0, 5, 5, 2, FAROL.glass);
  p.px(2, 8, FAROL.glass);
  p.px(1, 5, FAROL.glow);
  p.px(2, 5, '#ffffff');
  return p.canvas;
}

/** Halo cálido de un foco (se dibuja en modo aditivo). */
export function haloDeFoco(): HTMLCanvasElement {
  const r = 12;
  const p = painter(r * 2, r * 2);
  for (let y = 0; y < r * 2; y++) {
    for (let x = 0; x < r * 2; x++) {
      const d = Math.hypot(x + 0.5 - r, y + 0.5 - r) / r;
      if (d >= 1) continue;
      const a = (1 - d) ** 2 * 0.55;
      p.px(x, y, `rgb(255 196 110 / ${a.toFixed(3)})`);
    }
  }
  return p.canvas;
}

/** Charcos de luz de una serie de focos, horneados en el piso. */
export function lucesEnElPiso(p: Painter, x: number, y: number, w: number): void {
  for (const bx of focoXs(w)) {
    p.ellipse(x + bx, y + 22, 13, 5, 'rgb(255 214 140 / 0.12)');
    p.ellipse(x + bx, y + 22, 7, 3, 'rgb(255 226 160 / 0.12)');
  }
}

/** Dónde cuelga cada foco a lo largo de una serie de `w` pixeles. */
export function focoXs(w: number): number[] {
  const out: number[] = [];
  const n = Math.max(2, Math.round(w / 34));
  const step = w / n;
  for (let i = 0; i < n; i++) out.push(Math.round(step * (i + 0.5)));
  return out;
}
