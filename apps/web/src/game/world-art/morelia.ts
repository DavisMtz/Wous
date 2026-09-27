import { mix, WOOD } from '../rendering/palette.ts';
import { hash, type Painter, painter, pick, sign, signWidth } from './paint.ts';
import {
  AGUA,
  BRONCE,
  CAL,
  CAL_TRONCO,
  CANTERA_ROSA,
  CORTEZA,
  FAROL,
  FOSFO,
  HERRERIA,
  hundido,
  LAMINA,
  LAUREL,
  LONAS,
  type LonaId,
  PLUMON,
  TILE,
} from './world-palette.ts';

/**
 * Las piezas del centro de Morelia (ADR-0013), pintadas por código como todo
 * el mundo (ADR-0007): los portales de Allende con sus comercios y el Café,
 * las casas de cantera, la reja del atrio con sus portones, el kiosko, las
 * fuentes de taza, las estatuas, la placa de la UNESCO, las bancas de
 * cantera, los laureles recortados con el pie encalado, los fresnos, los
 * faroles de hierro y los puestos de dulces.
 */

export type Art = { canvas: HTMLCanvasElement; ox: number; oy: number };

const C = CANTERA_ROSA;
const VIDRIO = { dark: '#3b3552', light: '#8f84b8' };
const LUZ = { warm: '#ffd98a', warmDeep: '#f2a24e', glow: '#fff4d6' };

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
function aplanado(
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

function arcoVano(p: Painter, cx: number, bottom: number, w: number, h: number, fill: string) {
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
function vaciarArco(p: Painter, cx: number, bottom: number, w: number, h: number): void {
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

function perillon(p: Painter, cx: number, y: number): void {
  p.rect(cx - 2, y + 6, 5, 2, C.base);
  p.rect(cx - 1, y + 3, 3, 3, C.light);
  p.px(cx - 1, y + 3, C.lighter);
  p.rect(cx - 1, y + 1, 3, 2, C.base);
  p.px(cx, y, C.light);
  p.px(cx + 1, y + 4, C.shade);
}

/** Balcón de herrería con su losa de cantera. */
function balcon(p: Painter, x: number, y: number, w: number): void {
  p.rect(x - 1, y, w + 2, 2, C.light);
  p.rect(x - 1, y + 2, w + 2, 1, C.deep);
  p.rect(x, y - 7, w, 1, HERRERIA.base);
  for (let xx = x; xx < x + w; xx += 2) p.rect(xx, y - 6, 1, 6, HERRERIA.base);
  p.rect(x, y - 3, w, 1, HERRERIA.light);
}

/** Ventana de dos hojas con su marco de cantera (y postigos de madera). */
function ventana(p: Painter, x: number, y: number, w: number, h: number, seed: number): void {
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

// ─── Portales de Allende ──────────────────────────────────────────────────

/**
 * La arquería del portal: pilares de cantera cada 3 tiles, arcos de medio
 * punto y la planta alta con sus ventanas y balcones. Los vanos quedan
 * transparentes: por ahí se ven los comercios y quien camina debajo.
 */
export function portal(wTiles: number): Art {
  const W = wTiles * TILE;
  const H = 7 * TILE;
  const p = painter(W, H);
  const bay = 3 * TILE;
  const pilar = 12;
  const imposta = H - 44;

  sillar(p, 0, 0, W, H, 401);
  // Cornisa y pretil arriba.
  p.rect(0, 0, W, 2, C.lighter);
  p.rect(0, 2, W, 3, C.light);
  p.rect(0, 5, W, 1, C.deep);
  // Planta alta: una ventana con balcón sobre cada arco.
  for (let k = 0; k * bay + pilar < W; k++) {
    const cx = k * bay + pilar + (bay - pilar) / 2;
    ventana(p, Math.round(cx - 5), 12, 10, 18, k);
    balcon(p, Math.round(cx - 8), 33, 16);
    // Gárgola de cantera entre ventana y ventana.
    p.rect(k * bay + 4, 6, 4, 2, C.shade);
  }
  // Cornisa de la arquería.
  p.rect(0, imposta - 22, W, 1, C.lighter);
  p.rect(0, imposta - 21, W, 2, C.light);
  p.rect(0, imposta - 19, W, 1, C.deep);
  // Arcos: la dovela de luz, el vano vacío y los pilares con su imposta.
  for (let k = 0; k * bay + pilar < W; k++) {
    const x0 = k * bay + pilar;
    const w = Math.min(bay - pilar, W - x0);
    const cx = x0 + w / 2;
    arcoVano(p, cx, H, w + 4, H - imposta + w / 2 + 3, C.lighter);
    arcoVano(p, cx, H, w + 2, H - imposta + w / 2 + 1, C.shade);
    vaciarArco(p, cx, H, w, H - imposta + w / 2);
  }
  for (let k = 0; k * bay < W; k++) {
    const x = k * bay;
    p.rect(x, imposta, pilar, H - imposta, C.base);
    p.rect(x, imposta, 2, H - imposta, C.lighter);
    p.rect(x + pilar - 2, imposta, 2, H - imposta, C.shade);
    p.rect(x - 1, imposta - 2, pilar + 2, 3, C.light);
    p.rect(x - 1, imposta + 1, pilar + 2, 1, C.deep);
    p.rect(x - 1, H - 5, pilar + 2, 5, C.shade);
    p.rect(x - 1, H - 5, pilar + 2, 1, C.light);
    // Arbotante en pilares alternos: brazo de hierro y linterna tibia.
    if (k % 2 === 0) {
      const lx = x + pilar / 2 - 2;
      p.rect(lx + 1, imposta + 6, 3, 1, HERRERIA.base);
      p.rect(lx, imposta + 7, 5, 7, HERRERIA.base);
      p.rect(lx + 1, imposta + 8, 3, 5, LUZ.warm);
      p.px(lx + 1, imposta + 8, LUZ.glow);
    }
  }
  return { canvas: p.canvas, ox: 0, oy: 0 };
}

/** Lo que vende cada comercio, arco por arco (el Café en el arco 5). */
const COMERCIOS = [
  'HOTEL',
  'NIEVES',
  'LIBROS',
  'PAN',
  'DULCES',
  'CAFE',
  'CHURROS',
  'ROPA',
  'FARMACIA',
  'HOTEL',
  'DULCES',
  'PAN',
  'NIEVES',
  'LIBROS',
] as const;
/** El arco del Café (entre los pilares de x 71 y 74). */
export const ARCO_CAFE = 5;

/**
 * El fondo del portal: el techo de vigas en sombra y los comercios al fondo,
 * uno por arco, con su puerta, su aparador y su letrero. El Café tiene su
 * puerta verde botella, la luz tibia de adentro y su rótulo.
 */
export function comercios(wTiles: number): Art {
  const W = wTiles * TILE;
  const H = 2 * TILE;
  const p = painter(W, H);
  const bay = 3 * TILE;
  // Techo de vigas (lo que se ve arriba, entre los arcos).
  p.rect(0, 0, W, 7, '#4a3228');
  for (let x = 0; x < W; x += 6) p.rect(x, 0, 2, 7, '#6b4a36');
  p.rect(0, 7, W, 1, '#2f1f18');
  // Muro del fondo.
  for (let y = 8; y < H; y++) {
    for (let x = 0; x < W; x++) {
      p.px(x, y, hash(x, y, 411) < 0.05 ? hundido('#d9c6b3', 0.12) : '#d9c6b3');
    }
  }
  // Sombra del portal sobre el fondo.
  p.rect(0, 8, W, 3, 'rgb(43 18 56 / 0.28)');
  COMERCIOS.forEach((giro, k) => {
    const x0 = k * bay + 12;
    const cx = x0 + (bay - 12) / 2;
    if (giro === 'CAFE') {
      cafe(p, Math.round(cx), H);
      return;
    }
    comercio(p, Math.round(cx), H, giro, k);
  });
  return { canvas: p.canvas, ox: 0, oy: 0 };
}

function comercio(p: Painter, cx: number, bottom: number, giro: string, seed: number): void {
  const tinte = pick(['#7a2f2a', '#2a4f7a', '#355a2a', '#6b3a78', '#7a5a2a'], seed, 3, 4);
  // Puerta al centro y aparadores a los lados.
  p.rect(cx - 5, bottom - 16, 10, 16, hundido(tinte, 0.25));
  p.rect(cx - 4, bottom - 15, 8, 7, LUZ.warm);
  p.rect(cx, bottom - 15, 1, 15, hundido(tinte, 0.45));
  for (const dx of [-14, 9]) {
    p.rect(cx + dx, bottom - 12, 6, 9, hundido(tinte, 0.2));
    p.rect(cx + dx + 1, bottom - 11, 4, 6, mix(LUZ.warm, '#fff4d6', 0.4));
    // Lo del aparador: tres cositas de colores.
    for (let i = 0; i < 3; i++) {
      p.px(
        cx + dx + 1 + i,
        bottom - 7,
        pick(['#ff4f9a', '#ffd23f', '#35c77a', '#3f7bff'], seed, i, 5),
      );
    }
  }
  // Letrero pintado arriba de la puerta.
  const label = giro;
  const w = signWidth(label) + 4;
  p.rect(cx - Math.round(w / 2), bottom - 23, w, 7, tinte);
  sign(p, label, cx - Math.round(w / 2) + 2, bottom - 22, CAL.base);
}

const VERDE_BOTELLA = { base: '#1f5a47', light: '#2e7a60', shade: '#153f32' };

function cafe(p: Painter, cx: number, bottom: number): void {
  // Marco verde botella, la puerta de vidrio con luz tibia y las mesitas asomadas.
  p.rect(cx - 16, bottom - 18, 32, 18, VERDE_BOTELLA.base);
  p.rect(cx - 16, bottom - 18, 32, 1, VERDE_BOTELLA.light);
  p.rect(cx - 7, bottom - 16, 14, 16, WOOD.base);
  for (let y = bottom - 15; y < bottom - 3; y++) {
    p.rect(cx - 6, y, 12, 1, mix(LUZ.warm, LUZ.warmDeep, (y - bottom + 15) / 12));
  }
  p.rect(cx, bottom - 15, 1, 15, WOOD.shadow);
  p.px(cx + 4, bottom - 8, '#f0cf45');
  // Vitrinas con tazas.
  for (const dx of [-14, 8]) {
    p.rect(cx + dx, bottom - 13, 6, 8, LUZ.warm);
    p.px(cx + dx + 1, bottom - 8, '#fff4d6');
    p.px(cx + dx + 3, bottom - 8, LONAS.rosa.luz);
  }
  // Rótulo: CAFÉ en cal sobre verde.
  p.rect(cx - 13, bottom - 25, 26, 8, VERDE_BOTELLA.shade);
  sign(p, 'CAFÉ', cx - 7, bottom - 23, '#fff4d6');
}

// ─── Casas de Allende ─────────────────────────────────────────────────────

const PINTURAS: Record<string, string> = { ocre: '#d7a24e', rosa: '#d98a8a' };

/**
 * Casa de dos pisos de la calle: sillería de cantera o aplanado de color con
 * marcos de cantera, zaguán o comercio abajo, balcones arriba, cornisa con
 * gárgolas. Vista de frente: su pie es la banqueta de Allende.
 */
export function edificio(wTiles: number, variant: string | undefined, seed: number): Art {
  const W = wTiles * TILE;
  const H = 7 * TILE;
  const p = painter(W, H);
  const pintura = variant ? PINTURAS[variant] : undefined;
  if (pintura) aplanado(p, 0, 0, W, H, pintura, 421 + seed);
  else sillar(p, 0, 0, W, H, 421 + seed);
  // Pretil, cornisa y gárgolas.
  p.rect(0, 0, W, 2, C.lighter);
  p.rect(0, 2, W, 3, C.light);
  p.rect(0, 5, W, 1, C.deep);
  for (let x = 6; x < W - 4; x += 22) {
    p.rect(x, 6, 5, 2, C.shade);
    p.px(x + 4, 8, C.deep);
  }
  // Pilastras de las orillas.
  p.rect(0, 6, 3, H - 6, C.light);
  p.rect(W - 3, 6, 3, H - 6, C.shade);
  // Planta alta: balcones.
  const n = Math.max(1, Math.floor(W / 30));
  for (let i = 0; i < n; i++) {
    const cx = Math.round(((i + 0.5) * W) / n);
    ventana(p, cx - 5, 14, 10, 20, seed * 7 + i);
    balcon(p, cx - 8, 37, 16);
  }
  // Faja entre pisos.
  p.rect(0, 46, W, 2, C.light);
  p.rect(0, 48, W, 1, C.deep);
  // Planta baja: zaguán al centro y, si cabe, un comercio a un lado.
  const cx = Math.round(W / 2);
  p.rect(cx - 10, H - 34, 20, 34, C.lighter);
  p.rect(cx - 8, H - 32, 16, 32, WOOD.base);
  p.rect(cx - 8, H - 32, 16, 2, WOOD.shadow);
  p.rect(cx, H - 30, 1, 30, WOOD.shadow);
  for (const y of [H - 24, H - 14]) p.rect(cx - 7, y, 14, 1, WOOD.shadow);
  p.px(cx - 2, H - 16, '#f0cf45');
  if (W >= 80) {
    const sx = seed % 2 === 0 ? 8 : W - 26;
    p.rect(sx, H - 26, 18, 26, C.shade);
    p.rect(sx + 1, H - 25, 16, 12, LUZ.warm);
    p.rect(sx + 1, H - 13, 16, 13, hundido(pintura ?? C.base, 0.35));
    const board = pick(FOSFO, seed, 2, 6);
    p.rect(sx, H - 33, 18, 6, board);
    sign(
      p,
      pick(['PAN', 'ROPA', 'NIEVES', 'DULCES'], seed, 4, 7).slice(0, 4),
      sx + 2,
      H - 32,
      PLUMON,
    );
  }
  return { canvas: p.canvas, ox: 0, oy: 0 };
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
 * Portón del atrio: dos pilares de cantera con perillones y, entre ellos, el
 * arco de herrería con su medallón; las hojas abiertas contra los pilares.
 */
export function porton(wTiles: number): Art {
  const W = wTiles * TILE;
  const top = 44;
  const H = TILE + top;
  const p = painter(W, H);
  const pie = H - 1;
  const pw = 12;
  for (const x of [0, W - pw]) {
    p.rect(x, pie - 40, pw, 40, C.base);
    for (let y = pie - 40; y < pie; y += 5) p.rect(x, y, pw, 1, C.joint);
    p.rect(x, pie - 40, 2, 40, C.lighter);
    p.rect(x + pw - 2, pie - 40, 2, 40, C.shade);
    p.rect(x - 1, pie - 43, pw + 2, 3, C.light);
    p.rect(x - 1, pie - 40, pw + 2, 1, C.deep);
    perillon(p, x + pw / 2, pie - 52);
    // Farol en el pilar.
    p.rect(x + pw / 2 - 1, pie - 30, 3, 5, HERRERIA.base);
    p.px(x + pw / 2, pie - 29, LUZ.warm);
  }
  // Arco de herrería de pilar a pilar y el medallón.
  const cx = W / 2;
  const r = (W - pw * 2) / 2;
  for (let a = 0; a <= 40; a++) {
    const ang = Math.PI + (a / 40) * Math.PI;
    const x = Math.round(cx + Math.cos(ang) * r);
    const y = Math.round(pie - 36 + Math.sin(ang) * (r * 0.7));
    p.px(x, y, HERRERIA.base);
    if (a % 4 === 0) p.px(x, y + 2, HERRERIA.base);
  }
  p.ellipse(cx, pie - 36 - r * 0.7 - 2, 4, 4, HERRERIA.base);
  p.ellipse(cx, pie - 36 - r * 0.7 - 2, 2, 2, '#c9a45a');
  // Hojas abiertas, plegadas junto a los pilares.
  for (const x of [pw, W - pw - 3]) {
    for (let i = 0; i < 3; i++) p.rect(x + i, pie - 30, 1, 30, HERRERIA.base);
  }
  // Escalón.
  p.rect(pw, pie - 2, W - pw * 2, 2, C.light);
  return { canvas: p.canvas, ox: 0, oy: -top };
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
 * El kiosko de la Plaza de Armas: plataforma ochavada de cantera (su tapa
 * vista desde arriba, 5.5 × 4 tiles) con la escalinata al frente, columnas
 * delgadas de hierro, barandal y la cúpula de lámina gris con su
 * linternilla. La huella es de 6×5 tiles y el pie de la plataforma cae en su
 * orilla de abajo.
 */
export function kiosko(): Art {
  const W = 112;
  const H = 176;
  const p = painter(W, H);
  const cx = W / 2;
  const tapa = 96;
  const tapaH = 64;
  const frente = tapa + tapaH;

  // Tapa de la plataforma: losas de cantera, más oscura bajo la cúpula.
  octagono(p, 12, tapa, 88, tapaH, 14, C.light);
  for (let y = tapa; y < frente; y++) {
    for (let x = 12; x < 100; x++) {
      if ((x - 12) % 11 === 10 || (y - tapa) % 8 === 7) p.px(x, y, C.joint);
    }
  }
  mascaraOctagono(p, 12, tapa, 88, 14);
  for (let y = tapa; y < tapa + 40; y++) {
    const a = (0.42 - (y - tapa) * 0.009).toFixed(3);
    p.rect(12, y, 88, 1, `rgb(43 18 56 / ${a})`);
  }
  mascaraOctagono(p, 12, tapa, 88, 14);
  // Barandal y columnas del fondo (en la orilla de atrás de la tapa).
  p.rect(26, tapa + 4, 60, 1, LAMINA.shade);
  for (let x = 28; x < 84; x += 4) p.rect(x, tapa + 5, 1, 6, LAMINA.deep);
  for (const x of [30, 55, 80]) columna(p, x, tapa - 34, 40, true);

  // Cara del frente de la plataforma y la escalinata.
  p.rect(14, frente, 84, 12, C.shade);
  p.rect(14, frente, 84, 1, C.lighter);
  for (let x = 14; x < 98; x += 11) p.rect(x, frente + 1, 1, 11, C.joint);
  p.rect(14, frente, 8, 12, hundido(C.shade, 0.12));
  p.rect(90, frente, 8, 12, hundido(C.shade, 0.22));
  p.rect(14, frente + 12, 84, 2, C.deep);
  for (let i = 0; i < 3; i++) {
    const sx = 40 - i * 3;
    const sw = 32 + i * 6;
    const sy = frente - 2 + i * 5;
    p.rect(sx, sy, sw, 5, i === 0 ? C.lighter : C.light);
    p.rect(sx, sy, sw, 1, C.lighter);
    p.rect(sx, sy + 4, sw, 1, C.shade);
  }

  // Barandal del frente (abierto en la escalinata): hierro claro.
  for (const [x0, x1] of [
    [16, 40],
    [72, 96],
  ] as const) {
    p.rect(x0, frente - 12, x1 - x0, 1, LAMINA.light);
    for (let x = x0; x < x1; x += 3) p.rect(x, frente - 11, 1, 10, LAMINA.base);
    p.rect(x0, frente - 2, x1 - x0, 1, LAMINA.deep);
  }
  // Columnas del frente.
  for (const x of [15, 38, 72, 95]) columna(p, x, tapa - 38, frente - tapa + 38, false);

  // Lambrequín: la cenefa de lámina calada bajo la cúpula.
  const alero = tapa - 34;
  p.rect(4, alero - 6, W - 8, 6, LAMINA.light);
  p.rect(4, alero - 6, W - 8, 1, '#ffffff');
  for (let x = 4; x < W - 4; x++) {
    const k = x % 6;
    const d = Math.round(2.5 * Math.sin((Math.PI * (k + 0.5)) / 6));
    if (d > 0) p.rect(x, alero, 1, d, LAMINA.base);
    p.px(x, alero + Math.max(0, d), LAMINA.deep);
  }
  // La cúpula de lámina con sus costillas.
  const domoBase = alero - 6;
  const domoH = 30;
  for (let y = 0; y < domoH; y++) {
    const t = (domoH - y) / domoH;
    const half = Math.round(52 * Math.sqrt(Math.max(0, 1 - t * t)));
    for (let x = -half; x < half; x++) {
      const u = (x + half) / Math.max(1, half * 2);
      let c = u < 0.3 ? LAMINA.light : u > 0.72 ? LAMINA.shade : LAMINA.base;
      const costilla =
        Math.floor(u * 10) !== Math.floor(((x - 1 + half) / Math.max(1, half * 2)) * 10);
      if (costilla) c = u < 0.5 ? '#ffffff' : LAMINA.deep;
      if (x === -half || x === half - 1) c = LAMINA.deep;
      p.px(cx + x, domoBase - domoH + y, c);
    }
  }
  // Linternilla, su cupulín y la punta.
  const lt = domoBase - domoH - 12;
  p.rect(cx - 7, lt, 14, 12, LAMINA.light);
  p.rect(cx + 3, lt, 4, 12, LAMINA.shade);
  for (const dx of [-4, 1]) p.rect(cx + dx, lt + 3, 2, 6, VIDRIO.dark);
  p.ellipse(cx, lt - 1, 8, 4, LAMINA.base);
  p.ellipse(cx - 2, lt - 2, 4, 2, LAMINA.light);
  p.rect(cx, lt - 12, 1, 8, HERRERIA.base);
  p.ellipse(cx, lt - 5, 2, 2, '#c9a45a');
  // Pie de la plataforma en la orilla de abajo de la huella (5 tiles).
  return { canvas: p.canvas, ox: -8, oy: 5 * TILE - (frente + 14) };
}

function columna(p: Painter, x: number, top: number, h: number, fondo: boolean): void {
  const c = fondo ? HERRERIA.shade : HERRERIA.base;
  p.rect(x, top, 3, h, c);
  if (!fondo) {
    p.rect(x, top, 1, h, HERRERIA.light);
    p.rect(x - 1, top + h - 3, 5, 3, C.base);
    p.rect(x - 1, top, 5, 2, HERRERIA.light);
    // Ménsula calada bajo el alero.
    p.px(x - 2, top + 3, c);
    p.px(x + 4, top + 3, c);
  }
}

function octagono(p: Painter, x: number, y: number, w: number, h: number, cut: number, c: string) {
  for (let yy = 0; yy < h; yy++) {
    const inset = yy < cut ? cut - yy : 0;
    p.rect(x + inset, y + yy, w - inset * 2, 1, c);
  }
}

function mascaraOctagono(p: Painter, x: number, y: number, w: number, cut: number): void {
  for (let yy = 0; yy < cut; yy++) {
    const inset = cut - yy;
    p.ctx.clearRect(x, y + yy, inset, 1);
    p.ctx.clearRect(x + w - inset, y + yy, inset, 1);
  }
}

// ─── Fuentes ──────────────────────────────────────────────────────────────

/**
 * Fuente de taza: la pileta redonda de cantera con su agua, el pedestal y la
 * taza al centro con su chorrito. `r` en tiles.
 */
export function fuenteDeTaza(r: number): Art {
  const d = Math.round(r * 2 * TILE);
  const alto = Math.round(d * 0.75);
  const W = d + 2;
  const H = d + alto;
  const p = painter(W, H);
  const cx = W / 2;
  const cy = H - d / 2 - 1;
  const R = d / 2;
  // Pileta: el borde de cantera (con su cara al frente) y el agua dentro.
  p.ellipse(cx, cy + 3, R, R - 1, C.shade);
  p.ellipse(cx, cy, R, R - 1, C.light);
  p.ellipse(cx, cy, R - 3, R - 4, C.base);
  p.ellipse(cx, cy + 1, R - 4, R - 5, AGUA.shade);
  p.ellipse(cx, cy + 1, R - 5, R - 6, AGUA.base);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    p.px(
      Math.round(cx + Math.cos(a) * (R - 7)),
      Math.round(cy + Math.sin(a) * (R - 8)),
      AGUA.light,
    );
  }
  // Ondas del chorro que cae.
  p.ellipse(cx, cy + 1, Math.max(3, R / 3), Math.max(2, R / 4), AGUA.light);
  p.ellipse(cx, cy + 1, Math.max(2, R / 3) - 1, Math.max(1, R / 4) - 1, AGUA.base);
  // Pedestal y taza.
  const tazaY = cy - Math.round(alto * 0.72);
  p.rect(cx - 3, tazaY, 6, cy - tazaY, C.base);
  p.rect(cx - 3, tazaY, 2, cy - tazaY, C.lighter);
  p.rect(cx + 2, tazaY, 1, cy - tazaY, C.shade);
  const tr = Math.max(6, Math.round(R * 0.55));
  p.ellipse(cx, tazaY + 2, tr, 3, C.shade);
  p.ellipse(cx, tazaY, tr, 3, C.light);
  p.ellipse(cx, tazaY, tr - 2, 2, AGUA.base);
  // Remate y chorrito.
  p.rect(cx - 1, tazaY - 8, 3, 8, C.base);
  p.px(cx - 1, tazaY - 8, C.lighter);
  p.rect(cx, tazaY - 12, 1, 4, AGUA.foam);
  p.px(cx - 1, tazaY - 11, AGUA.light);
  p.px(cx + 1, tazaY - 10, AGUA.light);
  // El agua que cae de la taza.
  for (const dx of [-tr, tr - 1]) {
    for (let y = tazaY + 2; y < cy - 1; y += 2) p.px(cx + dx, y, AGUA.light);
  }
  return { canvas: p.canvas, ox: -1, oy: -alto };
}

/**
 * Las piletas cuadradas de la Melchor Ocampo, bajitas, de piedra gris
 * oscura. La del sur sostiene la estatua de Melchor Ocampo en su pedestal.
 */
export function pileta(conEstatua: boolean): Art {
  const W = 3 * TILE;
  const extra = conEstatua ? 58 : 18;
  const H = 3 * TILE + extra;
  const p = painter(W, H);
  const top = extra;
  const GRIS = { base: '#6b666e', light: '#8a858d', shade: '#4b474f', deep: '#35323a' };
  // Borde de piedra y su cara al frente.
  p.rect(0, top + 2, W, 3 * TILE - 2, GRIS.shade);
  p.rect(0, top, W, 3 * TILE - 6, GRIS.light);
  p.rect(0, top + 3 * TILE - 6, W, 6, GRIS.base);
  p.rect(0, H - 1, W, 1, GRIS.deep);
  // Agua.
  p.rect(4, top + 4, W - 8, 3 * TILE - 14, AGUA.shade);
  p.rect(5, top + 5, W - 10, 3 * TILE - 16, AGUA.base);
  for (let i = 0; i < 8; i++) {
    p.px(8 + ((i * 11) % (W - 16)), top + 9 + ((i * 7) % (3 * TILE - 22)), AGUA.light);
  }
  const cx = W / 2;
  if (conEstatua) {
    // Pedestal de piedra oscura con su placa, y Ocampo de bronce, de levita.
    const pie = top + 30;
    p.rect(cx - 7, pie - 26, 14, 26, GRIS.base);
    p.rect(cx - 7, pie - 26, 2, 26, GRIS.light);
    p.rect(cx + 5, pie - 26, 2, 26, GRIS.deep);
    p.rect(cx - 9, pie - 28, 18, 3, GRIS.light);
    p.rect(cx - 4, pie - 18, 8, 6, BRONCE.light);
    p.rect(cx - 3, pie - 17, 6, 1, BRONCE.shade);
    p.rect(cx - 3, pie - 15, 6, 1, BRONCE.shade);
    estatuaDeBronce(p, cx, pie - 28, 26);
  } else {
    // Chorro al centro.
    p.rect(cx - 1, top + 12, 2, 10, AGUA.foam);
    p.ellipse(cx, top + 22, 5, 2, AGUA.light);
  }
  return { canvas: p.canvas, ox: 0, oy: -extra };
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
 * Laurel de la India recortado en caja redondeada, como los de la Plaza de
 * Armas y el andador Juárez, con el pie del tronco encalado.
 */
export function laurel(seedId: string): Art {
  const W = 44;
  const H = 74;
  const p = painter(W, H);
  const seed = semilla(seedId);
  // Tronco con su cal.
  p.rect(20, 42, 5, 30, CORTEZA.base);
  p.rect(20, 42, 1, 30, CORTEZA.light);
  p.rect(24, 42, 1, 30, CORTEZA.shade);
  p.rect(19, 60, 7, 12, CAL_TRONCO.base);
  p.rect(24, 60, 2, 12, CAL_TRONCO.shade);
  p.rect(18, 71, 9, 2, CORTEZA.shade);
  // Copa recortada: caja de esquinas redondas, tupida.
  const x0 = 2;
  const y0 = 4;
  const cw = 40;
  const ch = 40;
  const radio = 9;
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const dx = Math.max(0, Math.max(radio - x, x - (cw - 1 - radio)));
      const dy = Math.max(0, Math.max(radio - y, y - (ch - 1 - radio)));
      if (dx * dx + dy * dy > radio * radio) continue;
      const orilla = dx * dx + dy * dy > (radio - 1.5) ** 2;
      if (orilla && hash(x, y, seed) < 0.3) continue;
      const hoja = hash(Math.floor((x + (y % 2)) / 2), Math.floor(y / 2), seed + 1);
      const luz = (1 - x / cw) * 0.55 + (1 - y / ch) * 0.8;
      let c = luz > 0.95 ? LAUREL.light : luz < 0.45 ? LAUREL.shade : LAUREL.base;
      if (hoja > 0.88) c = luz > 0.7 ? LAUREL.lighter : LAUREL.light;
      else if (hoja < 0.12) c = LAUREL.deep;
      if (y > ch - 5) c = hoja < 0.5 ? LAUREL.deep : LAUREL.shade;
      p.px(x0 + x, y0 + y, c);
    }
  }
  return { canvas: p.canvas, ox: -14, oy: -58 };
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
  const W = grande ? 88 : 72;
  const H = grande ? 104 : 90;
  const p = painter(W, H);
  const seed = semilla(seedId);
  const s = grande ? 1.2 : 1;
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
  return { canvas: p.canvas, ox: -5, oy: -58 };
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

// ─── Puestos de dulces ────────────────────────────────────────────────────

const GIROS: Record<string, { lona: LonaId; rotulo: string; precio: string }> = {
  dulces: { lona: 'rosa', rotulo: 'DULCES', precio: '$20' },
  ates: { lona: 'naranja', rotulo: 'ATES', precio: '$35' },
};

const ATE = ['#b8323a', '#d9582a', '#e8a13a', '#7a2a5a', '#c9463c'] as const;
const DULCE = ['#ff4f9a', '#ffd23f', '#35c77a', '#f7f0e0', '#ff7a2a'] as const;

/**
 * Puesto de la vendimia de la Melchor Ocampo: lona de color, cenefa
 * rotulada, mesa con hule y la mercancía: ates en barras y dulces en frascos.
 */
export function puesto(variant: string | undefined, seedId: string): Art {
  const giro = GIROS[variant ?? ''] ??
    GIROS.dulces ?? { lona: 'rosa', rotulo: 'DULCES', precio: '$20' };
  const lona = LONAS[giro.lona];
  const W = 72;
  const H = 72;
  const p = painter(W, H);
  const seed = semilla(seedId);
  // Postes traseros.
  p.rect(7, 18, 2, 30, '#7c7482');
  p.rect(63, 18, 2, 30, '#7c7482');
  // Repisa trasera con frascos de dulces.
  p.rect(8, 30, 56, 2, WOOD.base);
  for (let i = 0; i < 8; i++) {
    const x = 10 + i * 7;
    const c = pick(DULCE, seed, i, 3);
    p.rect(x, 22, 5, 8, '#dfe8ee');
    p.rect(x + 1, 24, 3, 5, c);
    p.rect(x, 21, 5, 1, WOOD.shadow);
  }
  p.rect(6, 20, 60, 26, `${lona.hondo}33`);
  // Mesa con hule.
  p.rect(8, 44, 56, 8, CAL.base);
  for (let y = 44; y < 52; y += 2) {
    for (let x = 8 + ((y / 2) % 2) * 2; x < 64; x += 4) {
      p.rect(x, y, 2, 2, mix(lona.luz, '#ffffff', 0.35));
    }
  }
  p.rect(8, 44, 56, 1, '#ffffff');
  // La mercancía: ates en barras o dulces en montoncitos.
  for (let i = 0; i < 6; i++) {
    const x = 11 + i * 9;
    if (giro.rotulo === 'ATES') {
      for (let l = 0; l < 3; l++) {
        const c = pick(ATE, seed + l, i, 4);
        p.rect(x, 43 - l * 3, 7, 3, c);
        p.rect(x, 43 - l * 3, 7, 1, hundido(c, -0.2));
      }
    } else {
      for (let l = 0; l < 4; l++) p.px(x + l * 2, 42 - (l % 2), pick(DULCE, seed, i + l, 5));
      p.rect(x, 43, 7, 1, pick(DULCE, seed, i, 6));
    }
  }
  // Faldón y patas.
  p.rect(8, 52, 56, 11, mix(lona.luz, '#ffffff', 0.55));
  for (let x = 12; x < 64; x += 6) p.rect(x, 52, 1, 11, mix(lona.luz, '#ffffff', 0.2));
  p.rect(11, 63, 2, 6, WOOD.shadow);
  p.rect(59, 63, 2, 6, WOOD.shadow);
  // Precio en cartulina.
  const board = pick(FOSFO, seed, 1, 8);
  const bw = signWidth(giro.precio) + 6;
  const bx = 36 - Math.floor(bw / 2);
  p.rect(bx, 54, bw, 9, board);
  sign(p, giro.precio, bx + 3, 56, PLUMON);
  // Postes del frente.
  for (const x of [4, 66]) {
    p.rect(x, 16, 2, 54, '#b8b1bd');
    p.rect(x, 16, 1, 54, '#dcd6df');
  }
  // La lona con su cenefa rotulada y flecos.
  for (let y = 3; y < 18; y++) {
    const inset = Math.round(7 * (1 - (y - 3) / 15));
    for (let x = inset; x < W - inset; x++) {
      const fold = (x + y * 2) % 13;
      let c = fold < 2 ? lona.luz : fold > 10 ? lona.hondo : lona.base;
      if (y === 3 || x === inset || x === W - inset - 1) c = lona.hondo;
      p.px(x, y, c);
    }
  }
  p.rect(0, 18, W, 6, lona.base);
  p.rect(0, 18, W, 1, lona.luz);
  sign(p, giro.rotulo, Math.round((W - signWidth(giro.rotulo)) / 2), 19, CAL.base);
  for (let x = 0; x < W; x += 6) {
    p.rect(x, 24, 5, 1, lona.hondo);
    p.rect(x + 1, 25, 3, 1, lona.hondo);
    p.px(x + 2, 26, lona.hondo);
  }
  return { canvas: p.canvas, ox: -4, oy: -40 };
}
