import { mix, WOOD } from '../rendering/palette.ts';
import { hash, type Painter, painter } from './paint.ts';
import { relieve } from './relieve.ts';
import {
  AGUA,
  BRONCE,
  CAL_TRONCO,
  CANTERA_GRIS,
  CANTERA_ROSA,
  CORTEZA,
  FAROL,
  HERRERIA,
  hundido,
  LAMINA,
  LAUREL,
  MIEL,
  TILE,
} from './world-palette.ts';

/**
 * Las piezas del centro de Morelia (ADR-0013), pintadas por código como todo
 * el mundo (ADR-0007): los portales de Allende con sus comercios y el Café,
 * las casas de cantera, la reja del atrio con sus portones, el kiosko, las
 * fuentes de taza, las estatuas, la placa de la UNESCO, las bancas de
 * cantera, los laureles recortados con el pie encalado, los fresnos y los
 * faroles de hierro. El mobiliario de cada plaza va en `plazas.ts`.
 */

/** Un punto de luz de una pieza (px de su lienzo) y el radio de su halo de noche. */
export type Luz = { x: number; y: number; r?: number };

export type Art = {
  canvas: HTMLCanvasElement;
  ox: number;
  oy: number;
  /** Dónde tiene faroles: de noche, de ahí sale su halo (ambiente). */
  luces?: readonly Luz[];
};

const C = CANTERA_ROSA;
const G = CANTERA_GRIS;
const VIDRIO = { dark: '#3b3552', light: '#8f84b8' };

// ─── Utilidades de cantera ────────────────────────────────────────────────

/** Muro de sillares (hiladas de 5 px), como el de la Catedral pero más chico. */
export function sillar(p: Painter, x: number, y: number, w: number, h: number, seed: number): void {
  for (let yy = 0; yy < h; yy++) {
    const course = Math.floor((y + yy) / 5);
    const offset = (course % 2) * 5;
    for (let xx = 0; xx < w; xx++) {
      const gx = x + xx;
      const gy = y + yy;
      if ((y + yy) % 5 === 4 || (gx + offset) % 10 === 9) {
        p.px(gx, gy, C.joint);
        continue;
      }
      const tone = hash(Math.floor((gx + offset) / 10), course, seed);
      let c = tone < 0.2 ? C.shade : tone > 0.85 ? C.light : C.base;
      if ((y + yy) % 5 === 0 && tone > 0.45) c = C.light;
      const speck = hash(gx, gy, seed + 1);
      if (speck < 0.03) c = C.shade;
      else if (speck > 0.985) c = C.lighter;
      p.px(gx, gy, c);
    }
  }
}

/** Aplanado pintado (ocre, rosa) con sus poros. */
export function aplanado(
  p: Painter,
  x: number,
  y: number,
  w: number,
  h: number,
  base: string,
  seed: number,
) {
  p.rect(x, y, w, h, base);
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const r = hash(xx, yy, seed);
      if (r < 0.045) p.px(xx, yy, hundido(base, 0.1));
      else if (r > 0.985) p.px(xx, yy, hundido(base, -0.12));
    }
  }
}

export function arcoVano(
  p: Painter,
  cx: number,
  bottom: number,
  w: number,
  h: number,
  fill: string,
) {
  const r = w / 2;
  for (let yy = 0; yy < h; yy++) {
    const y = bottom - h + yy;
    if (yy < r) {
      const dy = r - yy - 0.5;
      const half = Math.sqrt(Math.max(0, r * r - dy * dy));
      p.rect(Math.round(cx - half), y, Math.round(half * 2), 1, fill);
    } else {
      p.rect(Math.round(cx - r), y, w, 1, fill);
    }
  }
}

/** Borra (transparente) un vano de medio punto: por ahí se ve lo de atrás. */
export function vaciarArco(p: Painter, cx: number, bottom: number, w: number, h: number): void {
  const r = w / 2;
  for (let yy = 0; yy < h; yy++) {
    const y = bottom - h + yy;
    if (yy < r) {
      const dy = r - yy - 0.5;
      const half = Math.sqrt(Math.max(0, r * r - dy * dy));
      p.ctx.clearRect(Math.round(cx - half), y, Math.round(half * 2), 1);
    } else {
      p.ctx.clearRect(Math.round(cx - r), y, w, 1);
    }
  }
}

export function perillon(p: Painter, cx: number, y: number): void {
  p.rect(cx - 2, y + 6, 5, 2, C.base);
  p.rect(cx - 1, y + 3, 3, 3, C.light);
  p.px(cx - 1, y + 3, C.lighter);
  p.rect(cx - 1, y + 1, 3, 2, C.base);
  p.px(cx, y, C.light);
  p.px(cx + 1, y + 4, C.shade);
}

/** Balcón de herrería con su losa de cantera. */
export function balcon(p: Painter, x: number, y: number, w: number): void {
  p.rect(x - 1, y, w + 2, 2, C.light);
  p.rect(x - 1, y + 2, w + 2, 1, C.deep);
  p.rect(x, y - 7, w, 1, HERRERIA.base);
  for (let xx = x; xx < x + w; xx += 2) p.rect(xx, y - 6, 1, 6, HERRERIA.base);
  p.rect(x, y - 3, w, 1, HERRERIA.light);
}

/** Ventana de dos hojas con su marco de cantera (y postigos de madera). */
export function ventana(
  p: Painter,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
): void {
  p.rect(x - 2, y - 2, w + 4, h + 3, C.lighter);
  p.rect(x - 1, y - 1, w + 2, h + 1, C.shade);
  p.rect(x, y, w, h, VIDRIO.dark);
  p.rect(x + 1, y + 1, w - 2, Math.floor(h / 2) - 1, '#4d3d60');
  p.px(x + 1, y + 1, VIDRIO.light);
  p.px(x + 2, y + 2, VIDRIO.light);
  p.rect(x + Math.floor(w / 2), y, 1, h, C.shade);
  if (hash(seed, 1, 5) < 0.5) {
    // Un postigo abierto.
    p.rect(x - 4, y, 2, h, WOOD.base);
    p.rect(x - 4, y, 1, h, mix(WOOD.base, '#fff4d6', 0.3));
  }
}

// ─── Reja del atrio y portones ────────────────────────────────────────────

const REJA_ALTO = 16;

/**
 * Tramo de reja: el murete de cantera y los barrotes de hierro con punta de
 * lanza. Acostada (corre de izquierda a derecha) o parada (de arriba abajo).
 */
export function reja(wTiles: number, hTiles: number, acostada: boolean): Art {
  if (acostada) {
    const W = wTiles * TILE;
    const H = TILE + REJA_ALTO;
    const p = painter(W, H);
    const pie = H - 1;
    // Murete: tapa de luz y cara.
    p.rect(0, pie - 9, W, 2, C.lighter);
    p.rect(0, pie - 7, W, 7, C.base);
    p.rect(0, pie - 1, W, 1, C.deep);
    for (let x = 0; x < W; x += 11) p.rect(x, pie - 7, 1, 7, C.joint);
    // Barrotes y pasamanos.
    p.rect(0, pie - 10, W, 1, HERRERIA.base);
    p.rect(0, pie - 21, W, 1, HERRERIA.base);
    for (let x = 1; x < W; x += 3) {
      p.rect(x, pie - 24, 1, 14, HERRERIA.base);
      p.px(x, pie - 25, HERRERIA.light);
    }
    return { canvas: p.canvas, ox: 0, oy: -REJA_ALTO };
  }
  const W = 10;
  const H = hTiles * TILE + REJA_ALTO;
  const p = painter(W, H);
  // Parada: la tapa del murete corre hacia abajo; los barrotes, vistos de
  // canto, suben 14 px desde cada punto y hacen una franja con puntas.
  p.rect(0, REJA_ALTO, 8, H - REJA_ALTO, C.base);
  p.rect(0, REJA_ALTO, 2, H - REJA_ALTO, C.lighter);
  p.rect(6, REJA_ALTO, 2, H - REJA_ALTO, C.deep);
  for (let y = REJA_ALTO; y < H; y += 11) p.rect(0, y, 8, 1, C.joint);
  p.rect(2, 2, 4, H - 8, HERRERIA.base);
  p.rect(2, 2, 1, H - 8, HERRERIA.light);
  for (let y = 0; y < H - 8; y += 3) p.px(4, y, HERRERIA.light);
  p.rect(0, H - 3, 8, 3, C.shade);
  return { canvas: p.canvas, ox: 0, oy: -REJA_ALTO };
}

/**
 * Portón del atrio (reja de 1854): dos pilares cuadrados de sillar de ≈4.5 m
 * con su cornisa volada, el jarrón con piña encima y un farol negro de brazo;
 * entre ellos, el copete semicircular de filigrana con su medallón oval, y las
 * dos hojas de barrotes abiertas contra los pilares.
 */
export function porton(wTiles: number): Art {
  const W = Math.round(wTiles * TILE);
  const top = 70;
  const H = TILE + top;
  // Los faroles salen hacia afuera de los pilares: el lienzo lleva margen para ellos.
  const M = 10;
  const p = painter(W + M * 2, H);
  p.ctx.translate(M, 0);
  const pie = H - 1;
  const pw = 16;
  const alto = 58;
  for (const x of [0, W - pw]) {
    p.rect(x, pie - alto, pw, alto, C.base);
    for (let y = pie - alto; y < pie; y += 6) p.rect(x, y, pw, 1, C.joint);
    p.rect(x + pw / 2, pie - alto, 1, alto, C.joint);
    p.rect(x, pie - alto, 2, alto, C.lighter);
    p.rect(x + pw - 2, pie - alto, 2, alto, C.shade);
    // Pilastra rehundida al frente.
    p.rect(x + 4, pie - alto + 8, pw - 8, alto - 20, C.shade);
    p.rect(x + 4, pie - alto + 8, pw - 8, 1, C.deep);
    // Cornisa volada y el jarrón con piña.
    p.rect(x - 2, pie - alto - 4, pw + 4, 4, C.light);
    p.rect(x - 2, pie - alto - 4, pw + 4, 1, C.lighter);
    p.rect(x - 1, pie - alto, pw + 2, 1, C.deep);
    const vx = x + pw / 2;
    p.rect(vx - 3, pie - alto - 6, 7, 2, C.base);
    p.ellipse(vx, pie - alto - 10, 5, 4, C.light);
    p.px(vx - 3, pie - alto - 12, C.lighter);
    p.rect(vx - 1, pie - alto - 17, 3, 4, C.base);
    p.px(vx, pie - alto - 18, C.lighter);
    // Voluta de piedra en la base.
    p.rect(x - 2, pie - 5, pw + 4, 5, C.shade);
    p.rect(x - 2, pie - 5, pw + 4, 1, C.light);
    // Farol negro de brazo, hacia afuera del portón.
    const hacia = x === 0 ? -1 : 1;
    const bx = x + (hacia < 0 ? 0 : pw);
    p.rect(Math.min(bx, bx + hacia * 5), pie - 40, 5, 1, HERRERIA.base);
    const lx = bx + hacia * 6 - 2;
    p.rect(lx, pie - 44, 5, 1, HERRERIA.base);
    p.rect(lx, pie - 43, 5, 6, '#f4ecd6');
    p.rect(lx + 1, pie - 42, 3, 4, '#fff6d4');
    p.rect(lx, pie - 37, 5, 1, HERRERIA.base);
  }
  // El copete de filigrana de pilar a pilar y su medallón oval.
  const cx = W / 2;
  const r = (W - pw * 2) / 2;
  const arranque = pie - 40;
  for (let a = 0; a <= 60; a++) {
    const ang = Math.PI + (a / 60) * Math.PI;
    const x = Math.round(cx + Math.cos(ang) * r);
    const y = Math.round(arranque + Math.sin(ang) * r * 0.85);
    p.px(x, y, HERRERIA.base);
    p.px(x, y + 1, HERRERIA.shade);
    if (a % 5 === 0) {
      // Rizos hacia adentro.
      const ix = Math.round(cx + Math.cos(ang) * (r - 4));
      const iy = Math.round(arranque + Math.sin(ang) * (r - 4) * 0.85);
      p.px(ix, iy, HERRERIA.base);
      p.px(ix + 1, iy - 1, HERRERIA.base);
    }
  }
  p.rect(pw, arranque, W - pw * 2, 1, HERRERIA.base);
  const my = Math.round(arranque - r * 0.85 * 0.55);
  p.ellipse(cx, my, 5, 6, HERRERIA.base);
  p.ellipse(cx, my, 3, 4, '#c9a45a');
  p.px(cx, my - 1, '#e8d08a');
  // Las hojas abiertas, plegadas junto a los pilares.
  for (const x of [pw, W - pw - 4]) {
    for (let i = 0; i < 4; i++) p.rect(x + i, pie - 36, 1, 36, HERRERIA.base);
    p.rect(x, pie - 30, 4, 1, HERRERIA.light);
    p.rect(x, pie - 12, 4, 1, HERRERIA.light);
  }
  // Escalón.
  p.rect(pw, pie - 2, W - pw * 2, 2, C.light);
  p.ctx.setTransform(1, 0, 0, 1, 0, 0);
  return {
    canvas: p.canvas,
    ox: -M,
    oy: -top,
    luces: [
      { x: M - 6, y: pie - 40, r: 18 },
      { x: M + W + 6, y: pie - 40, r: 18 },
    ],
  };
}

/** Portón en una reja parada: dos pilares de cantera con perillón, uno en cada punta. */
export function portonLado(hTiles: number): Art {
  const H = hTiles * TILE + 30;
  const W = 14;
  const p = painter(W, H);
  for (const top of [0, hTiles * TILE - 12]) {
    // Tapa del pilar (12×10) y su cara al frente (20 px), con juntas.
    const y = top + 18;
    p.rect(0, y, 12, 30 - 18 + 12, C.base);
    for (let yy = y; yy < y + 24; yy += 5) p.rect(0, yy, 12, 1, C.joint);
    p.rect(0, y, 2, 24, C.lighter);
    p.rect(10, y, 2, 24, C.shade);
    p.rect(-1, y - 3, 14, 3, C.light);
    p.rect(-1, y + 24, 14, 1, C.deep);
    perillon(p, 6, y - 12);
  }
  return { canvas: p.canvas, ox: 0, oy: -30 };
}

// ─── Kiosko ───────────────────────────────────────────────────────────────

/**
 * El kiosko de la Plaza de Armas (1887), como en las fotos: la base alta de
 * cantera gris con un tablero rehundido por cara, su cornisa y la puertita de
 * lámina negra al frente; las ocho columnas torsas de hierro negro con el
 * barandal; el alero octagonal con su friso calado, el plafón de madera miel
 * que se asoma por la orilla y la crestería de florones; y encima el cupulín
 * de lámina plateada en forma de campana, con sus costillas y la cruz de
 * hierro. `wTiles`/`hTiles` es la huella; la base ocupa su centro.
 */
export function kiosko(wTiles: number, hTiles: number): Art {
  const W = Math.round(wTiles * TILE);
  const fondo = Math.round(hTiles * TILE);
  const alto = 132;
  const H = fondo + alto;
  const p = painter(W, H);
  const cx = Math.round(W / 2);
  /** Centro de la huella de la base (en el mapa, el centro del octágono). */
  const GY = alto + Math.round(fondo / 2);
  /** Apotema de la base (3.5 tiles), alto de la base y de las columnas. */
  const A = Math.round(3.5 * TILE);
  const PH = 26;
  const CH = 54;
  const tapaY = GY - PH;
  const esquina = Math.round(A * 0.414);
  /** Medio alto de un octágono de apotema `a` (con esquinas de `e`) a `x` de su centro. */
  const octagono = (a: number, e: number) => (x: number) => Math.min(a, a + e - Math.abs(x));
  const bordeBase = octagono(A, esquina);

  // ── La base: su tapa y las caras del frente con sus tableros.
  for (let x = -A; x <= A; x++) {
    const b = bordeBase(x);
    for (let y = -b; y <= b; y++) {
      const junta = (x + A) % 14 === 0 || (y + A) % 11 === 0;
      p.px(cx + x, tapaY + y, junta ? G.joint : G.light);
    }
  }
  for (let x = -A; x <= A; x++) {
    const y0 = tapaY + bordeBase(x);
    const faceta = Math.abs(x) <= esquina ? G.base : x < 0 ? G.lighter : G.shade;
    p.rect(cx + x, y0, 1, PH, faceta);
    p.px(cx + x, y0, G.lighter);
    p.px(cx + x, y0 + 1, G.light);
    p.px(cx + x, y0 + 2, G.deep);
    p.px(cx + x, y0 + PH - 1, G.deep);
    p.px(cx + x, y0 + PH - 2, G.shade);
  }
  const tablero = (x0: number, x1: number) => {
    for (let x = x0; x <= x1; x++) {
      const yy = tapaY + bordeBase(x);
      p.rect(cx + x, yy + 6, 1, PH - 12, x === x0 ? G.deep : x === x1 ? G.lighter : G.shade);
      p.px(cx + x, yy + 6, G.deep);
      p.px(cx + x, yy + PH - 7, G.lighter);
    }
  };
  tablero(-A + 4, -esquina - 4);
  tablero(esquina + 4, A - 4);
  tablero(-esquina + 3, -8);
  tablero(8, esquina - 3);
  // La puertita de lámina negra (la bodega) al centro del frente.
  const puertaY = tapaY + A + 6;
  p.rect(cx - 6, puertaY, 12, PH - 6, HERRERIA.base);
  p.rect(cx - 6, puertaY, 12, 1, HERRERIA.light);
  p.rect(cx - 7, puertaY - 1, 14, 1, G.lighter);
  p.px(cx + 4, puertaY + 10, '#c9a45a');
  // Cornisa sobre la tapa: su orilla clara.
  for (let x = -A; x <= A; x++) p.px(cx + x, tapaY - bordeBase(x), G.lighter);

  // ── Columnas torsas y barandal: primero las de atrás.
  const V = Math.round(A * 0.88);
  const ve = Math.round(V * 0.414);
  const vertices: [number, number][] = [
    [-ve, -V],
    [ve, -V],
    [V, -ve],
    [V, ve],
    [ve, V],
    [-ve, V],
    [-V, ve],
    [-V, -ve],
  ];
  const barandal = (x0: number, y0: number, x1: number, y1: number, color: string) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n);
      const y = Math.round(y0 + ((y1 - y0) * i) / n);
      p.px(cx + x, tapaY + y - 10, color);
      p.px(cx + x, tapaY + y - 3, color);
      if (i % 3 === 0) p.rect(cx + x, tapaY + y - 9, 1, 7, color);
      else if (i % 3 === 1) p.px(cx + x, tapaY + y - 6, color);
    }
  };
  const columna = (x: number, y: number, frente: boolean) => {
    const pie = tapaY + y;
    const c = frente ? HERRERIA.base : HERRERIA.shade;
    p.rect(cx + x - 1, pie - CH, 3, CH, c);
    for (let yy = pie - CH + 2; yy < pie; yy += 4) {
      p.px(cx + x - 1 + (Math.floor(yy / 4) % 2) * 2, yy, frente ? HERRERIA.light : HERRERIA.base);
    }
    p.rect(cx + x - 2, pie - 3, 5, 3, c);
    p.rect(cx + x - 2, pie - CH, 5, 3, c);
    // Ménsula de encaje hacia arriba.
    p.px(cx + x - 3, pie - CH + 3, c);
    p.px(cx + x + 3, pie - CH + 3, c);
  };
  for (let i = 0; i < vertices.length; i++) {
    const [x0, y0] = vertices[i] as [number, number];
    const [x1, y1] = vertices[(i + 1) % vertices.length] as [number, number];
    if (y0 < 0 || y1 < 0) barandal(x0, y0, x1, y1, HERRERIA.shade);
  }
  for (const [x, y] of vertices.filter(([, vy]) => vy < 0)) columna(x, y, false);
  for (let i = 0; i < vertices.length; i++) {
    const [x0, y0] = vertices[i] as [number, number];
    const [x1, y1] = vertices[(i + 1) % vertices.length] as [number, number];
    if (y0 >= 0 && y1 >= 0) barandal(x0, y0, x1, y1, HERRERIA.base);
  }
  for (const [x, y] of vertices.filter(([, vy]) => vy >= 0)) columna(x, y, true);

  // ── El alero: la lámina del techo vista desde arriba, casi plana.
  const E = Math.round(A * 1.12);
  const ee = Math.round(E * 0.414);
  const bordeAlero = octagono(E, ee);
  const aleroY = tapaY - CH;
  // El alero es casi plano: lámina oscura con sus costuras a lo largo de cada falda.
  for (let x = -E; x <= E; x++) {
    const b = bordeAlero(x);
    for (let y = -b; y <= b; y++) {
      const orilla = b - Math.abs(y) < 2 || E - Math.abs(x) < 2;
      let c = x < -E * 0.4 ? '#5d6670' : x > E * 0.45 ? '#3f4750' : '#4f5861';
      if ((Math.abs(x) + Math.abs(y)) % 6 === 0) c = hundido(c, 0.14);
      if (orilla) c = '#2c3238';
      p.px(cx + x, aleroY + y, c);
    }
  }
  // El canto del alero al frente, el plafón miel que se asoma y el friso calado.
  for (let x = -E; x <= E; x++) {
    const y = aleroY + bordeAlero(x);
    p.px(cx + x, y, HERRERIA.base);
    p.px(cx + x, y + 1, MIEL.light);
    p.px(cx + x, y + 2, MIEL.base);
    p.px(cx + x, y + 3, MIEL.shade);
    const k = (x + E) % 6;
    p.px(cx + x, y + 4, HERRERIA.base);
    if (k === 0 || k === 3) p.px(cx + x, y + 5, HERRERIA.base);
    if (k === 0) p.px(cx + x, y + 6, HERRERIA.base);
  }
  // La crestería de florones en toda la orilla.
  for (let x = -E; x <= E; x++) {
    for (const lado of [-1, 1]) {
      const y = aleroY + lado * bordeAlero(x);
      p.px(cx + x, y - 1, HERRERIA.base);
      if ((x + E) % 4 === 0) {
        p.px(cx + x, y - 2, HERRERIA.base);
        p.px(cx + x, y - 3, HERRERIA.light);
      }
    }
  }
  // El farol que cuelga al centro se asoma apenas bajo el alero del frente.
  p.rect(cx - 1, aleroY + E + 3, 2, 3, HERRERIA.base);
  p.rect(cx - 2, aleroY + E + 6, 4, 4, '#ffe7a0');

  // ── El cupulín de lámina plateada, en forma de campana, con sus costillas.
  const R = Math.round(E * 0.62);
  const cupAlto = 42;
  const cupBase = aleroY + 2;
  for (let yy = 0; yy < cupAlto; yy++) {
    const t = yy / cupAlto;
    // Media esfera un poco alargada, que se abre en la falda como campana.
    const half = Math.round(R * Math.sqrt(Math.max(0, 1 - (1 - t) ** 2)) * (0.92 + t * 0.08));
    for (let x = -half; x <= half; x++) {
      const u = (x + half) / Math.max(1, half * 2);
      let c =
        u < 0.25 ? '#ffffff' : u < 0.45 ? LAMINA.light : u > 0.78 ? LAMINA.shade : LAMINA.base;
      const costilla = Math.round((x / Math.max(1, half)) * 4);
      if (Math.abs(x - Math.round((costilla / 4) * half)) < 1 && yy > 3) {
        c = u < 0.5 ? LAMINA.base : LAMINA.deep;
      }
      p.px(cx + x, cupBase - cupAlto + yy, c);
    }
  }
  p.rect(cx - R + 2, cupBase - 1, R * 2 - 3, 2, LAMINA.deep);
  // Remate y la cruz de hierro.
  p.rect(cx - 2, cupBase - cupAlto - 4, 5, 4, LAMINA.light);
  p.rect(cx, cupBase - cupAlto - 16, 1, 12, HERRERIA.base);
  p.rect(cx - 3, cupBase - cupAlto - 13, 7, 1, HERRERIA.base);
  return { canvas: p.canvas, ox: 0, oy: -alto, luces: [{ x: cx, y: aleroY + E + 8, r: 26 }] };
}

// ─── Fuentes ──────────────────────────────────────────────────────────────

/**
 * Fuente de taza de la Plaza de Armas: pileta redonda de cantera gris con su
 * agua, el pedestal abalaustrado y la copa ancha al centro con su borbotón.
 * `r` en tiles.
 */
export function fuenteDeTaza(r: number, cuadro = 0): Art {
  const d = Math.round(r * 2 * TILE);
  const alto = Math.round(d * 0.75);
  const W = d + 2;
  const H = d + alto;
  const p = painter(W, H);
  const cx = W / 2;
  const cy = H - d / 2 - 1;
  const R = d / 2;
  // Pileta: el borde de cantera gris, de tres molduras redondeadas apiladas
  // (se ven en su cara al frente), y el agua dentro.
  p.ellipse(cx, cy + 4, R, R - 1, G.deep);
  p.ellipse(cx, cy + 3, R, R - 1, G.shade);
  p.ellipse(cx, cy + 2, R, R - 1, G.base);
  p.ellipse(cx, cy + 1, R, R - 1, G.shade);
  p.ellipse(cx, cy, R, R - 1, G.lighter);
  p.ellipse(cx, cy, R - 3, R - 4, G.base);
  p.ellipse(cx, cy + 1, R - 4, R - 5, AGUA.shade);
  p.ellipse(cx, cy + 1, R - 5, R - 6, AGUA.base);
  // Destellos en el agua: cada cuadro brillan otros.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6 + hash(i, cuadro, 71) * 0.12) * Math.PI * 2;
    const k = 0.55 + hash(i, cuadro, 72) * 0.4;
    p.px(
      Math.round(cx + Math.cos(a) * (R - 6) * k),
      Math.round(cy + 1 + Math.sin(a) * (R - 7) * k),
      AGUA.light,
    );
  }
  // Ondas del agua que cae de la taza: se abren y se desvanecen, una tras otra.
  for (const fase of [cuadro % 4, (cuadro + 2) % 4]) {
    const rx = Math.max(3, R / 3) + fase * 1.5;
    const ry = Math.max(2, R / 4) + fase;
    if (rx > R - 5) continue;
    p.ellipse(cx, cy + 1, rx, ry, fase < 3 ? AGUA.light : AGUA.base);
    p.ellipse(cx, cy + 1, rx - 1, ry - 1, AGUA.base);
  }
  // Pedestal y taza.
  const tazaY = cy - Math.round(alto * 0.72);
  p.rect(cx - 4, cy - 4, 8, 4, G.shade);
  p.rect(cx - 3, tazaY, 6, cy - tazaY, G.base);
  p.rect(cx - 3, tazaY, 2, cy - tazaY, G.lighter);
  p.rect(cx + 2, tazaY, 1, cy - tazaY, G.deep);
  for (const y of [tazaY + 6, cy - 7]) p.rect(cx - 4, y, 8, 2, G.light);
  const tr = Math.max(6, Math.round(R * 0.55));
  p.ellipse(cx, tazaY + 2, tr, 3, G.shade);
  p.ellipse(cx, tazaY, tr, 3, G.lighter);
  p.ellipse(cx, tazaY, tr - 2, 2, AGUA.base);
  // Remate y el borbotón, que sube y baja un pixel.
  p.rect(cx - 1, tazaY - 8, 3, 8, G.base);
  p.px(cx - 1, tazaY - 8, G.lighter);
  const borbollon = 4 + (cuadro % 2);
  p.rect(cx, tazaY - 8 - borbollon, 1, borbollon, AGUA.foam);
  p.px(cx - 1, tazaY - 7 - borbollon + (cuadro % 2), AGUA.light);
  p.px(cx + 1, tazaY - 6 - borbollon + ((cuadro + 1) % 2), AGUA.light);
  // El agua que cae de la taza: las gotas bajan un pixel por cuadro.
  for (const dx of [-tr, tr - 1]) {
    for (let y = tazaY + 2 + (cuadro % 2); y < cy - 1; y += 2) p.px(cx + dx, y, AGUA.light);
    p.px(cx + dx + (cuadro % 2 ? 1 : -1), cy, AGUA.foam);
  }
  return { canvas: p.canvas, ox: -1, oy: -alto };
}

/** Una figura de bronce de pie: cabeza, levita, pantalón y la mano al pecho. */
function estatuaDeBronce(p: Painter, cx: number, pie: number, h: number): void {
  const cabeza = pie - h;
  p.rect(cx - 2, cabeza, 5, 5, BRONCE.base);
  p.px(cx - 1, cabeza + 1, BRONCE.light);
  p.rect(cx - 4, cabeza + 5, 9, h - 12, BRONCE.base);
  p.rect(cx - 4, cabeza + 5, 2, h - 12, BRONCE.light);
  p.rect(cx + 3, cabeza + 5, 2, h - 12, BRONCE.shade);
  p.rect(cx - 3, pie - 7, 3, 7, BRONCE.shade);
  p.rect(cx + 1, pie - 7, 3, 7, BRONCE.base);
  p.rect(cx - 1, cabeza + 8, 3, 2, BRONCE.light);
  // Pátina verdosa en los pliegues.
  p.px(cx + 2, cabeza + 9, BRONCE.patina);
  p.px(cx - 3, cabeza + 14, BRONCE.patina);
}

/** Juárez de bronce en su pedestal de cantera. */
export function estatua(): Art {
  const W = 26;
  const H = 26 + 44;
  const p = painter(W, H);
  const cx = 13;
  const pie = H - 4;
  p.rect(2, pie - 16, 22, 20, C.shade);
  p.rect(3, pie - 18, 20, 18, C.base);
  p.rect(3, pie - 18, 2, 18, C.lighter);
  p.rect(21, pie - 18, 2, 18, C.deep);
  p.rect(1, pie - 20, 24, 3, C.light);
  p.rect(8, pie - 12, 10, 6, BRONCE.light);
  p.rect(9, pie - 11, 8, 1, BRONCE.shade);
  p.rect(9, pie - 9, 8, 1, BRONCE.shade);
  estatuaDeBronce(p, cx, pie - 20, 30);
  return { canvas: p.canvas, ox: 0, oy: -44 };
}

/** La placa de la UNESCO: bronce sobre un poste bajo de cantera. */
export function placa(): Art {
  const W = 16;
  const H = 26;
  const p = painter(W, H);
  p.rect(3, 8, 10, 17, C.base);
  p.rect(3, 8, 2, 17, C.lighter);
  p.rect(11, 8, 2, 17, C.deep);
  p.rect(2, 6, 12, 3, C.light);
  p.rect(4, 11, 8, 8, BRONCE.base);
  p.rect(4, 11, 8, 1, BRONCE.light);
  p.ellipse(8, 14, 2, 2, BRONCE.light);
  p.rect(5, 17, 6, 1, BRONCE.light);
  return { canvas: p.canvas, ox: 0, oy: -10 };
}

// ─── Bancas de cantera ────────────────────────────────────────────────────

/**
 * Banca de cantera con respaldo de orillas curvas, como las de la Plaza de
 * Armas. Mira abajo (se ve de frente), arriba (se ve el respaldo por detrás)
 * o a un lado (se ve de canto).
 */
export function banca(variant: string | undefined): Art {
  if (variant?.startsWith('hierro-')) return bancaDeHierro(variant.slice(7));
  switch (variant) {
    case 'arriba':
      return bancaDeEspaldas();
    case 'izquierda':
    case 'derecha':
      return bancaDeLado(variant === 'derecha');
    case 'cubo':
      return cubo();
    default:
      return bancaDeFrente();
  }
}

const HIERRO_VERDE = { base: '#214a2e', light: '#2f5a3a', lighter: '#4f7a55', shade: '#153220' };

/**
 * Banca de hierro fundido verde botella, de las porfirianas del andador:
 * listones de madera pintada, respaldo de rizos y patas curvas. De lado
 * (mira a la izquierda o a la derecha) o de frente.
 */
function bancaDeHierro(mira: string): Art {
  const V = HIERRO_VERDE;
  if (mira === 'izquierda' || mira === 'derecha') {
    const derecha = mira === 'derecha';
    const W = 16;
    const H = 2 * TILE + 14;
    const p = painter(W, H);
    const pie = H - 3;
    const sx = derecha ? 5 : 1;
    const rx = derecha ? 1 : 12;
    // Asiento de listones (corre hacia abajo) con su cara al frente.
    for (let x = 0; x < 10; x++) {
      p.rect(sx + x, 14, 1, pie - 19, x % 3 === 2 ? V.shade : x % 3 === 0 ? V.lighter : V.light);
    }
    p.rect(sx, pie - 5, 10, 4, V.shade);
    p.rect(sx, pie - 5, 10, 1, V.lighter);
    // Respaldo de rizos: su canto arriba y el calado.
    p.rect(rx, 4, 3, pie - 8, V.base);
    p.rect(rx, 4, 3, 1, V.lighter);
    for (let y = 8; y < pie - 8; y += 5) {
      p.px(rx + (derecha ? 3 : -1), y, V.base);
      p.px(rx + (derecha ? 3 : -1), y + 1, V.shade);
    }
    // Patas curvas en las puntas.
    for (const y of [13, pie - 2]) {
      p.rect(sx - (derecha ? 1 : 0), y, 11, 2, V.shade);
      p.px(derecha ? sx - 1 : sx + 10, y + 2, V.shade);
    }
    p.rect(sx + 1, pie, 2, 3, V.shade);
    p.rect(sx + 7, pie, 2, 3, V.shade);
    return { canvas: p.canvas, ox: 0, oy: -14 };
  }
  const W = 32;
  const H = 30;
  const p = painter(W, H);
  const espaldas = mira === 'arriba';
  // Respaldo de rizos y el asiento de listones.
  p.rect(1, espaldas ? 9 : 3, 30, 12, V.base);
  p.rect(1, espaldas ? 9 : 3, 30, 1, V.lighter);
  for (let x = 3; x < 29; x += 4) {
    p.ellipse(x + 1, (espaldas ? 9 : 3) + 6, 1.5, 3, V.shade);
  }
  p.rect(0, 16, 32, 4, V.light);
  for (let x = 0; x < 32; x += 3) p.px(x, 17, V.shade);
  p.rect(0, 20, 32, 2, V.shade);
  p.rect(2, 22, 3, 6, V.shade);
  p.rect(27, 22, 3, 6, V.shade);
  p.px(1, 27, V.shade);
  p.px(30, 27, V.shade);
  return { canvas: p.canvas, ox: 0, oy: -14 };
}

function respaldo(p: Painter, x: number, y: number, w: number, h: number): void {
  p.rect(x, y + 2, w, h - 2, C.base);
  p.rect(x + 3, y, w - 6, 2, C.base);
  p.rect(x + 1, y + 1, 2, 1, C.base);
  p.rect(x + w - 3, y + 1, 2, 1, C.base);
  // Luz del canto y el volado de las orillas.
  p.rect(x + 3, y, w - 6, 1, C.lighter);
  p.rect(x, y + 2, 1, h - 2, C.lighter);
  p.rect(x + w - 1, y + 2, 1, h - 2, C.shade);
  p.px(x + 1, y + 1, C.light);
  p.px(x + w - 2, y + 1, C.light);
  // Veta.
  p.rect(x + 4, y + Math.round(h / 2), w - 8, 1, C.joint);
}

function bancaDeFrente(): Art {
  const W = 32;
  const H = 30;
  const p = painter(W, H);
  respaldo(p, 1, 2, 30, 13);
  // Asiento: tapa de luz y cara al frente, y las dos patas.
  p.rect(0, 15, 32, 5, C.light);
  p.rect(0, 15, 32, 1, C.lighter);
  p.rect(0, 20, 32, 4, C.shade);
  p.rect(0, 20, 32, 1, C.deep);
  p.rect(2, 24, 5, 5, C.base);
  p.rect(25, 24, 5, 5, C.base);
  p.rect(2, 24, 1, 5, C.lighter);
  p.rect(29, 24, 1, 5, C.deep);
  return { canvas: p.canvas, ox: 0, oy: -14 };
}

function bancaDeEspaldas(): Art {
  const W = 32;
  const H = 30;
  const p = painter(W, H);
  // El asiento se asoma detrás del respaldo.
  p.rect(0, 12, 32, 3, C.light);
  p.rect(0, 12, 32, 1, C.lighter);
  // Respaldo por detrás: liso, al frente.
  respaldo(p, 1, 9, 30, 18);
  p.rect(1, 25, 30, 2, C.deep);
  p.rect(3, 27, 4, 2, C.shade);
  p.rect(25, 27, 4, 2, C.shade);
  return { canvas: p.canvas, ox: 0, oy: -14 };
}

function bancaDeLado(derecha: boolean): Art {
  const W = 16;
  const H = 2 * TILE + 14;
  const p = painter(W, H);
  // El asiento (su tapa corre hacia abajo) y, del lado contrario a donde
  // mira, el respaldo: más alto, así que se dibuja más arriba y tapa su orilla.
  const sx = derecha ? 5 : 1;
  const rx = derecha ? 1 : 11;
  const pie = H - 3;
  p.rect(sx, 12, 10, pie - 12 - 5, C.light);
  p.rect(sx, 12, 10, 1, C.lighter);
  for (let y = 18; y < pie - 5; y += 9) p.rect(sx + 1, y, 8, 1, C.joint);
  // Cara del frente del asiento (la punta de abajo).
  p.rect(sx, pie - 5, 10, 5, C.shade);
  p.rect(sx, pie - 5, 10, 1, C.deep);
  // Respaldo: canto de luz arriba, cara hacia el asiento en sombra.
  p.rect(rx, 4, 4, pie - 10, C.base);
  p.rect(rx, 4, 4, 2, C.lighter);
  p.rect(derecha ? rx + 3 : rx, 6, 1, pie - 12, derecha ? C.deep : C.lighter);
  p.rect(derecha ? rx : rx + 3, 6, 1, pie - 12, derecha ? C.lighter : C.deep);
  p.rect(rx, pie - 6, 4, 6, C.shade);
  // La sombra del respaldo sobre el asiento y las patas.
  p.rect(derecha ? sx : sx + 8, 13, 2, pie - 19, 'rgb(58 34 48 / 0.16)');
  p.rect(sx + 1, pie, 3, 3, C.deep);
  p.rect(sx + 6, pie, 3, 3, C.deep);
  return { canvas: p.canvas, ox: 0, oy: -14 };
}

/** La curva de una banca del kiosko, de su `variant`: `curva:desde:hasta:radio:cx:cy`. */
export type ArcoDeBanca = { desde: number; hasta: number; r: number; cx: number; cy: number };

export function arcoDeBanca(variant: string): ArcoDeBanca {
  const [, desde = 0, hasta = 0, r = 0, cx = 0, cy = 0] = variant.split(':').map(Number);
  return { desde, hasta, r, cx, cy };
}

/** Medio grueso de la banca curva en pixeles (0.35 tiles, como en los datos). */
const CURVA_MEDIO = 0.35 * TILE;

/**
 * ¿El pixel de suelo (x, y), desde la esquina de la banca, cae en ella? Si
 * cae: cuánto se lleva recorrido de la curva (`s`), su largo y qué tan afuera
 * queda (`d`, negativo hacia el kiosko), todo en pixeles.
 */
export function enBancaCurva(
  g: ArcoDeBanca,
  x: number,
  y: number,
): { s: number; largo: number; d: number } | null {
  const dx = x + 0.5 - g.cx * TILE;
  const dy = y + 0.5 - g.cy * TILE;
  const R = g.r * TILE;
  const d = Math.hypot(dx, dy) - R;
  if (Math.abs(d) > CURVA_MEDIO) return null;
  let a = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (a < g.desde - 180) a += 360;
  if (a < g.desde || a > g.hasta) return null;
  const aPx = (grados: number) => ((grados * Math.PI) / 180) * R;
  return { s: aPx(a - g.desde), largo: aPx(g.hasta - g.desde), d };
}

/**
 * Banca curva de cantera del anillo del kiosko: asiento macizo con la losa
 * volada un pixel y, en la orilla de afuera, el respaldo calado de óculos
 * ovales. Se pinta en relieve sobre su curva, así la misma pieza se ve de
 * frente (arriba del kiosko), de espaldas (abajo) o de lado.
 */
export function bancaCurva(variant: string, wTiles: number, hTiles: number): Art {
  const g = arcoDeBanca(variant);
  const W = Math.round(wTiles * TILE);
  const H = Math.round(hTiles * TILE);
  const ALZADO = 22;
  const ASIENTO = 9;
  const LOSA = 3;
  const RESPALDO = 20;
  const GRUESO = 3;
  const OCULO = { paso: 12, medio: 3, desde: ASIENTO + 3, hasta: RESPALDO - 2 };
  // Las caras paradas que se ven son las que dan hacia abajo de la pantalla, con la normal de
  // la curva (afuera o adentro). Con el sol a la izquierda, la que ve a la izquierda sale clara
  // y la que ve a la derecha, oscura: un tono por banca, del ángulo de en medio.
  const medio = ((g.desde + g.hasta) / 2) * (Math.PI / 180);
  const nx = Math.sin(medio) < 0 ? -Math.cos(medio) : Math.cos(medio);
  const nivel = nx < -0.35 ? 0 : nx > 0.35 ? 2 : 1;
  const p = painter(W, H + ALZADO);
  relieve(
    p,
    W,
    H,
    ALZADO,
    (x, y) => {
      const b = enBancaCurva(g, x, y);
      if (!b) return null;
      // La losa del asiento vuela sobre su base del lado del kiosko.
      const pie = b.d < -CURVA_MEDIO + 1.2 ? ASIENTO - LOSA : 0;
      if (b.d <= CURVA_MEDIO - GRUESO) return [[pie, ASIENTO]];
      // El respaldo, con sus óculos repartidos a lo largo y lejos de las puntas.
      const n = Math.max(0, Math.floor((b.largo - 8) / OCULO.paso));
      const u = b.s - (b.largo - n * OCULO.paso) / 2;
      const t = (u % OCULO.paso) - OCULO.paso / 2;
      if (n === 0 || u < 0 || u >= n * OCULO.paso || Math.abs(t) >= OCULO.medio) {
        return [[pie, RESPALDO]];
      }
      // Óvalo parado: más bajo hacia sus orillas.
      const c = (OCULO.desde + OCULO.hasta) / 2;
      const alto = ((OCULO.hasta - OCULO.desde) / 2) * Math.sqrt(1 - (t / OCULO.medio) ** 2);
      return [
        [pie, Math.round(c - alto)],
        [Math.round(c + alto), RESPALDO],
      ];
    },
    (x, y, z, cara) => {
      if (cara === 'tapa') {
        if (z >= RESPALDO - 1) return C.lighter;
        // Las juntas de la losa del asiento, cada 16 px de curva.
        const b = enBancaCurva(g, x, y);
        return b && z === ASIENTO - 1 && Math.round(b.s) % 16 === 8 ? C.joint : C.light;
      }
      const tonos = z >= ASIENTO ? [C.light, C.base, C.shade] : [C.base, C.shade, C.deep];
      return tonos[nivel] ?? C.base;
    },
  );
  return { canvas: p.canvas, ox: 0, oy: -ALZADO };
}

/** Cubo de cantera del atrio (sirve de asiento). */
function cubo(): Art {
  const p = painter(TILE, 28);
  p.rect(1, 10, 14, 8, C.light);
  p.rect(1, 10, 14, 1, C.lighter);
  p.rect(1, 18, 14, 9, C.shade);
  p.rect(1, 18, 1, 9, C.base);
  p.rect(1, 27, 14, 1, C.deep);
  return { canvas: p.canvas, ox: 0, oy: -12 };
}

// ─── Árboles ──────────────────────────────────────────────────────────────

/**
 * Laurel de la India (ficus) podado en bloque, como las hileras de la Plaza
 * de Armas y el andador Juárez (la firma de la plaza): copa de 4–5 m con la
 * tapa plana y lisa, lima donde le da el sol, caras que bajan a plomo con las
 * esquinas redondeadas, y el tronco (a veces doble) encalado hasta la mitad.
 */
export function laurel(seedId: string): Art {
  const W = 64;
  const H = 76;
  const p = painter(W, H);
  const seed = semilla(seedId);
  const cx = 32;
  const doble = hash(seed, 3, 11) < 0.35;
  // Tronco (o dos) con su cal.
  const troncos = doble ? [cx - 4, cx + 3] : [cx];
  for (const tx of troncos) {
    p.rect(tx - 3, 44, 6, 30, CORTEZA.base);
    p.rect(tx - 3, 44, 1, 30, CORTEZA.light);
    p.rect(tx + 2, 44, 1, 30, CORTEZA.shade);
    p.rect(tx - 4, 58, 8, 15, CAL_TRONCO.base);
    p.rect(tx + 2, 58, 2, 15, CAL_TRONCO.shade);
  }
  p.rect(cx - 7, 72, 14, 2, CORTEZA.shade);
  // Copa: la tapa (una elipse aplanada) y las caras hacia abajo.
  const x0 = 2;
  const cw = 60;
  const tapaAlto = 20;
  const caraAlto = 24;
  const top = 2;
  for (let y = 0; y < tapaAlto + caraAlto; y++) {
    for (let x = 0; x < cw; x++) {
      const u = (x - cw / 2 + 0.5) / (cw / 2);
      const tapaY = (tapaAlto / 2) * (1 - Math.sqrt(Math.max(0, 1 - u * u)));
      const baseY =
        tapaAlto + caraAlto - 1 - (caraAlto / 4) * (1 - Math.sqrt(Math.max(0, 1 - u * u)));
      if (y < tapaY || y > baseY) continue;
      const hoja = hash(Math.floor((x + (y % 2)) / 2), Math.floor(y / 2), seed + 1);
      const borde = y - tapaY < 1.2 || baseY - y < 1.2 || Math.abs(u) > 0.97;
      if (borde && hash(x, y, seed) < 0.35) continue;
      let c: string;
      if (y < tapaY + tapaAlto / 2 + 3) {
        // Tapa plana: lima al sol, un poco más oscura hacia atrás a la derecha.
        c = u < 0.2 ? LAUREL.lighter : LAUREL.light;
        if (hoja < 0.14) c = LAUREL.base;
        else if (hoja > 0.93) c = '#a9d85e';
      } else {
        // Caras: del medio a la sombra, con hojas sueltas.
        const t = (y - tapaAlto) / caraAlto;
        c = u > 0.45 ? LAUREL.shade : t > 0.7 ? LAUREL.shade : LAUREL.base;
        if (hoja > 0.88) c = LAUREL.light;
        else if (hoja < 0.12 || t > 0.9) c = LAUREL.deep;
      }
      p.px(x0 + x, top + y, c);
    }
  }
  return { canvas: p.canvas, ox: -(cx - 8), oy: -(H - TILE) };
}

/**
 * Liquidámbar (plantados en 2004): copa en punta, tupida, de hojas en
 * estrella; verde de primavera a otoño, rojizo en invierno.
 */
export function liquidambar(seedId: string, otono = false): Art {
  const W = 56;
  const H = 104;
  const p = painter(W, H);
  const seed = semilla(seedId);
  const cx = 28;
  p.rect(cx - 3, 60, 6, 42, '#6d5b4d');
  p.rect(cx - 3, 60, 1, 42, '#8c7867');
  p.rect(cx + 2, 60, 1, 42, '#4f4137');
  p.rect(cx - 3, 86, 7, 15, CAL_TRONCO.base);
  p.rect(cx + 2, 86, 2, 15, CAL_TRONCO.shade);
  p.rect(cx - 6, 100, 12, 2, CORTEZA.shade);
  const hojas = otono
    ? { base: '#b8542e', light: '#d9753c', lighter: '#f0a04a', shade: '#8f3a22', deep: '#62261a' }
    : { base: '#4f8a38', light: '#6aa647', lighter: '#8cc25c', shade: '#3c6f2c', deep: '#29501f' };
  for (let y = 0; y < 76; y++) {
    const t = y / 76;
    // Pirámide redondeada: angosta arriba, ancha abajo.
    const half = Math.round(
      26 * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.08)) * (0.35 + t * 0.7),
    );
    for (let x = -half; x <= half; x++) {
      const borde = Math.abs(x) > half - 2;
      if (borde && hash(x, y, seed) < 0.5) continue;
      const luz = -x / Math.max(1, half) - (t - 0.5);
      const hoja = hash(Math.floor((cx + x) / 2), Math.floor(y / 2), seed + 2);
      let c = luz > 0.5 ? hojas.light : luz < -0.4 ? hojas.shade : hojas.base;
      if (hoja > 0.9) c = hojas.lighter;
      else if (hoja < 0.1) c = hojas.deep;
      p.px(cx + x, 2 + y, c);
    }
  }
  return { canvas: p.canvas, ox: -(cx - 8), oy: -(H - TILE) };
}

const COPA_FRESNO: [number, number, number][] = [
  [36, 28, 22],
  [18, 36, 15],
  [54, 36, 16],
  [26, 18, 14],
  [48, 16, 15],
  [36, 44, 14],
  [10, 46, 8],
  [62, 46, 8],
];

/** Fresno grande: tronco gris, ramas y una copa irregular de muchos verdes. */
export function fresno(seedId: string, grande = false): Art {
  const W = grande ? 96 : 72;
  const H = grande ? 118 : 90;
  const p = painter(W, H);
  const seed = semilla(seedId);
  const s = grande ? 1.35 : 1;
  const cx = W / 2;
  const tw = grande ? 10 : 6;
  p.rect(cx - tw / 2 - 2, H - 6, tw + 4, 5, CORTEZA.shade);
  p.rect(cx - tw / 2, H - 46, tw, 42, '#7d6f64');
  p.rect(cx - tw / 2, H - 46, 1, 42, '#9c8d80');
  p.rect(cx + tw / 2 - 2, H - 46, 2, 42, '#5d5149');
  for (let y = H - 44; y < H - 6; y += 5) p.px(cx - 1 + (y % 3), y, '#5d5149');
  if (grande) {
    p.rect(cx - 7, H - 12, 3, 8, '#7d6f64');
    p.rect(cx + 5, H - 10, 3, 6, '#5d5149');
  }
  const verdes = {
    base: '#4a7d3a',
    light: '#63994a',
    lighter: '#86b561',
    shade: '#3a6630',
    deep: '#284a22',
  };
  const copaH = Math.round(62 * s);
  for (let y = 0; y < copaH; y++) {
    for (let x = 0; x < W; x++) {
      let best = -1;
      let bx = 0;
      let by = 0;
      for (const [ccx, ccy, r] of COPA_FRESNO) {
        const px0 = (ccx * W) / 72;
        const py0 = ccy * s;
        const rr = r * s;
        const d = 1 - Math.hypot(x - px0, (y - py0) * 1.1) / rr;
        if (d > best) {
          best = d;
          bx = (x - px0) / rr;
          by = (y - py0) / rr;
        }
      }
      if (best <= 0) continue;
      if (best < 0.14 && hash(x, y, seed) < 0.4) continue;
      const light = -bx * 0.6 - by * 0.8;
      const hoja = hash(Math.floor(x / 2), Math.floor(y / 2), seed + 1);
      let c = light > 0.35 ? verdes.light : light < -0.35 ? verdes.shade : verdes.base;
      if (best < 0.12) c = light > 0 ? verdes.base : verdes.deep;
      if (hoja > 0.9 && light > -0.2) c = verdes.lighter;
      else if (hoja < 0.08) c = verdes.deep;
      p.px(x, y, c);
    }
  }
  return { canvas: p.canvas, ox: -(W / 2 - 8), oy: -(H - 16) };
}

function semilla(id: string): number {
  return [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
}

// ─── Faroles ──────────────────────────────────────────────────────────────

/**
 * Farol de hierro de Morelia: zócalo, poste acanalado y un brazo con dos
 * linternas más la de arriba, de vidrio tibio (de día apagadas, pero cálidas).
 */
export function farol(): Art {
  const W = 26;
  const H = 74;
  const p = painter(W, H);
  const cx = 13;
  const pie = H - 2;
  // Zócalo.
  p.rect(cx - 4, pie - 8, 9, 8, HERRERIA.base);
  p.rect(cx - 4, pie - 8, 9, 1, HERRERIA.light);
  p.rect(cx - 5, pie - 1, 11, 1, HERRERIA.shade);
  // Poste con anillos.
  p.rect(cx - 1, pie - 50, 3, 42, HERRERIA.base);
  p.rect(cx - 1, pie - 50, 1, 42, HERRERIA.light);
  for (const y of [pie - 20, pie - 36]) p.rect(cx - 2, y, 5, 2, HERRERIA.base);
  // Brazo con sus rizos.
  p.rect(cx - 9, pie - 50, 19, 1, HERRERIA.base);
  p.px(cx - 8, pie - 49, HERRERIA.base);
  p.px(cx + 8, pie - 49, HERRERIA.base);
  for (const lx of [cx - 11, cx + 7, cx - 2]) {
    const ly = lx === cx - 2 ? pie - 66 : pie - 60;
    linterna(p, lx, ly);
  }
  return {
    canvas: p.canvas,
    ox: -5,
    oy: -58,
    luces: [
      { x: cx - 9, y: pie - 56 },
      { x: cx + 9, y: pie - 56 },
      { x: cx, y: pie - 62 },
    ],
  };
}

/**
 * Poste negro alto de Madero, cada 20–25 m: zócalo, fuste con anillos, la
 * corona ornamental y un doble brazo curvo con faroles de globo blanco.
 */
export function posteDeGlobos(): Art {
  const W = 40;
  const H = 104;
  const p = painter(W, H);
  const cx = 20;
  const pie = H - 2;
  p.rect(cx - 4, pie - 10, 9, 10, HERRERIA.base);
  p.rect(cx - 4, pie - 10, 9, 1, HERRERIA.light);
  p.rect(cx - 5, pie - 1, 11, 1, HERRERIA.shade);
  p.rect(cx - 1, pie - 80, 3, 70, HERRERIA.base);
  p.rect(cx - 1, pie - 80, 1, 70, HERRERIA.light);
  for (const y of [pie - 26, pie - 50, pie - 70]) p.rect(cx - 2, y, 5, 2, HERRERIA.base);
  // Los brazos: dos curvas que suben hacia los lados.
  for (const lado of [-1, 1]) {
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const x = Math.round(cx + lado * (1 + t * 12));
      const y = Math.round(pie - 78 - Math.sin(t * Math.PI * 0.9) * 6);
      p.px(x, y, HERRERIA.base);
      p.px(x, y + 1, HERRERIA.base);
    }
    const gx = cx + lado * 13;
    // Rizo bajo el brazo.
    p.px(cx + lado * 4, pie - 75, HERRERIA.base);
    p.px(cx + lado * 5, pie - 74, HERRERIA.base);
    // El globo blanco con su cuello.
    p.rect(gx - 1, pie - 84, 3, 3, HERRERIA.base);
    p.ellipse(gx, pie - 90, 5, 6, '#e9e4dc');
    p.ellipse(gx - 1, pie - 91, 3, 4, '#fbf9f4');
    p.px(gx - 2, pie - 93, '#ffffff');
  }
  // La corona al centro, arriba.
  p.rect(cx - 2, pie - 86, 5, 6, HERRERIA.base);
  p.px(cx - 2, pie - 87, HERRERIA.light);
  p.px(cx + 2, pie - 87, HERRERIA.light);
  p.px(cx, pie - 89, HERRERIA.base);
  return {
    canvas: p.canvas,
    ox: -(cx - 8),
    oy: -(H - TILE),
    luces: [-1, 1].map((lado) => ({ x: cx + lado * 13, y: pie - 90, r: 30 })),
  };
}

function linterna(p: Painter, x: number, y: number): void {
  p.rect(x + 1, y, 3, 1, HERRERIA.base);
  p.rect(x, y + 1, 5, 1, HERRERIA.base);
  p.rect(x, y + 2, 5, 6, FAROL.glass);
  p.rect(x + 1, y + 3, 2, 3, FAROL.glow);
  p.rect(x, y + 2, 1, 6, HERRERIA.base);
  p.rect(x + 4, y + 2, 1, 6, HERRERIA.base);
  p.rect(x, y + 8, 5, 1, HERRERIA.base);
  p.px(x + 2, y + 9, HERRERIA.base);
}
