import type { GroundKind, MapDef } from '@wous/world-data';
import { WOOD } from '../rendering/palette.ts';
import { lucesEnElPiso, mosaico, muro, paintInterior, repello } from './interior.ts';
import { objectShadow } from './objects.ts';
import { hash, type Painter, painter, pick, sign, signWidth } from './paint.ts';
import {
  ASFALTO,
  BANQUETA,
  CAL,
  CANTERA,
  FACHADAS,
  FOSFO,
  hundido,
  JACARANDA,
  LADRILLO,
  METAL,
  PASTO,
  PLUMON,
  SETO,
  TILE,
} from './world-palette.ts';

/**
 * El suelo del mapa en un solo canvas (ancho × alto en tiles, 16 px cada
 * uno). Primero el material pixel por pixel; luego el detalle de las fachadas;
 * al final las sombras de los objetos, horneadas: son estáticas y así quedan
 * siempre debajo de las personas.
 */
export function paintGround(map: MapDef): HTMLCanvasElement {
  const w = map.width * TILE;
  const h = map.height * TILE;
  const p = painter(w, h);
  const image = p.ctx.createImageData(w, h);
  const kindAt = (tx: number, ty: number): GroundKind | null =>
    tx < 0 || ty < 0 || tx >= map.width || ty >= map.height
      ? null
      : (map.ground[ty * map.width + tx] ?? null);
  const petals = map.objects
    .filter((o) => o.kind === 'jacaranda')
    .map((o) => ({ x: (o.x + 0.5) * TILE, y: (o.y + 0.9) * TILE }));
  // Interiores: las primeras filas de pared son la pared del fondo, vista de frente.
  let backRows = 0;
  while (backRows < map.height && kindAt(1, backRows) === 'pared') backRows++;

  for (let gy = 0; gy < h; gy++) {
    for (let gx = 0; gx < w; gx++) {
      const tx = Math.floor(gx / TILE);
      const ty = Math.floor(gy / TILE);
      const kind = kindAt(tx, ty);
      const ctx: Px = { gx, gy, lx: gx % TILE, ly: gy % TILE, tx, ty, kindAt, backRows };
      let color = kind ? MATERIAL[kind](ctx) : CANTERA.base;
      // Pétalos de jacaranda caídos cerca de cada árbol (en piso, no en seto).
      if (kind === 'adoquin' || kind === 'pasto' || kind === 'ladrillo') {
        color = petal(gx, gy, petals) ?? color;
      }
      put(image.data, (gy * w + gx) * 4, color);
    }
  }
  p.ctx.putImageData(image, 0, 0);

  paintFacades(p, map, kindAt);
  paintInterior(p, map, kindAt);
  paintShadows(p, map, kindAt, backRows);
  return p.canvas;
}

type Px = {
  gx: number;
  gy: number;
  lx: number;
  ly: number;
  tx: number;
  ty: number;
  kindAt: (tx: number, ty: number) => GroundKind | null;
  /** Filas de pared del fondo (interiores): se pintan de frente, no como tapa de muro. */
  backRows: number;
};

const MATERIAL: Record<GroundKind, (px: Px) => string> = {
  adoquin: cantera,
  ladrillo: ladrillo,
  pasto: pasto,
  banqueta: banqueta,
  calle: calle,
  seto: seto,
  fachada: (px) => pared(px, '#f2e6cf'),
  duela: duela,
  mosaico: ({ gx, gy, lx, ly, tx, ty, kindAt }) => mosaico(gx, gy, lx, ly, tx, ty, kindAt),
  pared: ({ gx, gy, lx, ly, tx, ty, kindAt, backRows }) =>
    ty < backRows ? repello(gx, gy) : muro(lx, ly, tx, ty, kindAt),
};

/** Losas de cantera de 8×8 con junta; cada losa con su tono y su desgaste. */
function cantera({ gx, gy }: Px): string {
  const sx = Math.floor(gx / 8);
  const sy = Math.floor(gy / 8);
  if (gx % 8 === 7 || gy % 8 === 7) return CANTERA.joint;
  const slab = hash(sx, sy, 11);
  const tint = slab < 0.55 ? CANTERA.base : slab < 0.82 ? CANTERA.light : CANTERA.shade;
  // Grieta diagonal en una de cada ~25 losas.
  if (slab > 0.96 && (gx % 8) - (gy % 8) === 1) return CANTERA.joint;
  const speck = hash(gx, gy, 12);
  if (speck < 0.035) return CANTERA.shade;
  if (speck > 0.975) return CANTERA.lighter;
  // Canto de luz arriba a la izquierda: se lee como losa, no como ruido.
  if (gy % 8 === 0 && gx % 8 < 6 && slab < 0.82) return CANTERA.lighter;
  return tint;
}

/** Ladrillo en petatillo: bloques de 8×8 que alternan acostado y parado. */
function ladrillo({ gx, gy }: Px): string {
  const bx = Math.floor(gx / 8);
  const by = Math.floor(gy / 8);
  const lx = gx % 8;
  const ly = gy % 8;
  const acostado = (bx + by) % 2 === 0;
  if (lx === 7 || ly === 7) return LADRILLO.joint;
  if (acostado && ly === 3) return LADRILLO.joint;
  if (!acostado && lx === 3) return LADRILLO.joint;
  const brick = acostado
    ? hash(bx, by * 2 + (ly > 3 ? 1 : 0), 21)
    : hash(bx * 2 + (lx > 3 ? 1 : 0), by, 22);
  const speck = hash(gx, gy, 23);
  if (speck < 0.025) return LADRILLO.shade;
  if (ly === 0 && brick > 0.5) return LADRILLO.light;
  return brick < 0.22 ? LADRILLO.shade : brick > 0.86 ? LADRILLO.light : LADRILLO.base;
}

/** Jardín con guarnición de cantera donde termina el pasto. */
function pasto({ gx, gy, lx, ly, tx, ty, kindAt }: Px): string {
  const edge = (dx: number, dy: number) => kindAt(tx + dx, ty + dy) !== 'pasto';
  if (edge(0, 1) && ly >= 14) return ly === 15 ? CANTERA.shade : CANTERA.light;
  if (edge(0, -1) && ly === 0) return CANTERA.light;
  if (edge(-1, 0) && lx === 0) return CANTERA.light;
  if (edge(1, 0) && lx === 15) return CANTERA.shade;
  // Sombra de la guarnición sobre el pasto.
  if ((edge(0, -1) && ly === 1) || (edge(-1, 0) && lx === 1)) return PASTO.deep;

  const r = hash(gx, gy, 31);
  if (r > 0.9965) return pick(['#fff6e8', '#ffd84a', '#ff8cc0'], gx, gy, 32);
  // Matas: un pixel de luz con su sombra debajo.
  if (hash(gx, gy - 1, 33) < 0.03) return PASTO.deep;
  if (hash(gx, gy, 33) < 0.03) return PASTO.lighter;
  // Manchas grandes de tono, para que el jardín no sea un solo verde.
  const clump = hash(Math.floor(gx / 6), Math.floor(gy / 5), 34);
  if (r < 0.06) return PASTO.shade;
  if (r < 0.1) return PASTO.light;
  return clump < 0.26 ? PASTO.shade : clump > 0.8 ? PASTO.light : PASTO.base;
}

/** Banqueta de concreto con juntas por tile y guarnición hacia la calle. */
function banqueta({ gx, gy, lx, ly, tx, ty, kindAt }: Px): string {
  if (kindAt(tx, ty + 1) === 'calle') {
    if (ly === 12) return BANQUETA.light;
    if (ly >= 13) return ly === 15 ? BANQUETA.curbDark : BANQUETA.curb;
  }
  if (lx === 15 || ly === 15) return BANQUETA.joint;
  const speck = hash(gx, gy, 41);
  if (speck < 0.04) return BANQUETA.shade;
  if (speck > 0.97) return BANQUETA.light;
  return hash(tx, ty, 42) < 0.3 ? BANQUETA.light : BANQUETA.base;
}

/** Asfalto con su raya amarilla discontinua. */
function calle({ gx, gy, ly }: Px): string {
  if (ly === 0) return ASFALTO.shade;
  if (ly === 9 && gx % 24 < 12) return ASFALTO.line;
  const speck = hash(gx, gy, 51);
  if (speck < 0.08) return ASFALTO.shade;
  if (speck > 0.93) return ASFALTO.light;
  return ASFALTO.base;
}

/** Seto recortado: matas de 2×2 y su cara frontal más oscura al final. */
function seto({ gx, gy, ly, tx, ty, kindAt }: Px): string {
  const front = kindAt(tx, ty + 1) !== 'seto';
  const clump = hash(Math.floor(gx / 2), Math.floor(gy / 2), 61);
  if (front && ly >= 11) {
    if (ly === 15) return SETO.deep;
    return clump < 0.4 ? SETO.deep : SETO.shade;
  }
  if (front && ly === 10) return SETO.lighter;
  const r = hash(gx, gy, 62);
  if (r > 0.96) return SETO.lighter;
  return clump < 0.25
    ? SETO.shade
    : clump < 0.5
      ? SETO.light
      : clump > 0.93
        ? SETO.deep
        : SETO.base;
}

function duela({ gx, gy }: Px): string {
  const row = Math.floor(gy / 4);
  const offset = (row % 2) * 12;
  if (gy % 4 === 3 || (gx + offset) % 24 === 23) return WOOD.gap;
  return hash(Math.floor((gx + offset) / 24), row, 71) < 0.4 ? WOOD.shadow : WOOD.base;
}

/** Aplanado de pared (la fachada lleva además su pintura en paintFacades). */
function pared({ gx, gy }: Px, base: string): string {
  const speck = hash(gx, gy, 81);
  if (speck < 0.05) return hundido(base, 0.12);
  return base;
}

/** Pétalo caído: más denso junto al tronco, ralo lejos. */
function petal(gx: number, gy: number, trees: { x: number; y: number }[]): string | null {
  for (const t of trees) {
    const d = Math.hypot((gx - t.x) / 1.4, gy - t.y);
    if (d > 30) continue;
    const r = hash(gx, gy, 91);
    const density = 0.09 * (1 - d / 30) ** 1.5;
    if (r < density) return r < density * 0.35 ? JACARANDA.lighter : JACARANDA.light;
  }
  return null;
}

function put(data: Uint8ClampedArray, i: number, hex: string): void {
  const n = RGB.get(hex) ?? parse(hex);
  data[i] = (n >> 16) & 255;
  data[i + 1] = (n >> 8) & 255;
  data[i + 2] = n & 255;
  data[i + 3] = 255;
}

const RGB = new Map<string, number>();
function parse(hex: string): number {
  const n = Number.parseInt(hex.slice(1, 7), 16);
  RGB.set(hex, n);
  return n;
}

// ─── Fachadas del barrio ───────────────────────────────────────────────────

/** Anchos de los edificios (tiles). El Café ocupa el de x 28–33. */
const EDIFICIOS = [5, 6, 5, 6, 6, 6, 6];
const COLOR_EDIFICIO = [0, 2, 1, 3, 4, 6, 5];
const COMERCIOS: (string | null)[] = [
  'ABARROTES',
  null,
  'PAPELERIA',
  'TORTILLAS',
  null,
  null,
  'FRUTAS',
];

function paintFacades(
  p: Painter,
  map: MapDef,
  kindAt: (tx: number, ty: number) => GroundKind | null,
): void {
  if (kindAt(0, 0) !== 'fachada') return;
  const rows = countRows(map, kindAt);
  const fh = rows * TILE;
  let startTile = 0;
  EDIFICIOS.forEach((tiles, i) => {
    const x = startTile * TILE;
    const bw = tiles * TILE;
    startTile += tiles;
    if (x >= map.width * TILE) return;
    const color = FACHADAS[(COLOR_EDIFICIO[i] ?? i) % FACHADAS.length] ?? FACHADAS[0];
    paintBuilding(p, x, bw, fh, color, COMERCIOS[i] ?? null, i);
  });
}

function countRows(map: MapDef, kindAt: (tx: number, ty: number) => GroundKind | null): number {
  let rows = 0;
  while (rows < map.height && kindAt(0, rows) === 'fachada') rows++;
  return rows;
}

function paintBuilding(
  p: Painter,
  x: number,
  bw: number,
  fh: number,
  color: { base: string; shadow: string; light: string },
  comercio: string | null,
  seed: number,
): void {
  // Muro pintado con su textura de aplanado.
  p.rect(x, 0, bw, fh, color.base);
  for (let yy = 4; yy < fh - 4; yy++) {
    for (let xx = x; xx < x + bw; xx++) {
      const r = hash(xx, yy, 100 + seed);
      if (r < 0.04) p.px(xx, yy, color.shadow);
      else if (r > 0.975) p.px(xx, yy, color.light);
    }
  }
  // Cornisa de cal y la sombra que deja.
  p.rect(x, 0, bw, 1, CAL.deep);
  p.rect(x, 1, bw, 2, CAL.base);
  p.rect(x, 3, bw, 1, hundido(color.base, 0.3));
  // Pilastras: canto de luz a la izquierda, sombra a la derecha.
  p.rect(x, 4, 1, fh - 8, color.light);
  p.rect(x + bw - 1, 4, 1, fh - 8, color.shadow);
  // Zócalo.
  p.rect(x, fh - 4, bw, 4, hundido(color.base, 0.42));
  p.rect(x, fh - 4, bw, 1, hundido(color.base, 0.2));

  // Planta alta: ventanas con balcón de herrería.
  const windows = Math.max(1, Math.floor((bw - 8) / 22));
  const gap = (bw - windows * 12) / (windows + 1);
  for (let i = 0; i < windows; i++) {
    const wx = Math.round(x + gap + i * (12 + gap));
    ventana(p, wx, 7, seed * 7 + i);
  }

  // Planta baja: cortina metálica con rótulo, o puerta de casa.
  if (comercio) {
    const cw = Math.min(bw - 12, 56);
    const cx = Math.round(x + (bw - cw) / 2);
    cortina(p, cx, 29, cw, fh - 33);
    const label = comercio;
    const lw = signWidth(label) + 6;
    const lx = Math.round(x + (bw - lw) / 2);
    const board = FOSFO[seed % FOSFO.length] ?? FOSFO[0];
    p.rect(lx, 21, lw, 8, board);
    p.rect(lx, 28, lw, 1, hundido(board, 0.3));
    sign(p, label, lx + 3, 22, PLUMON);
  } else {
    puerta(p, Math.round(x + bw / 2 - 6), 26, color, seed);
  }
}

function ventana(p: Painter, x: number, y: number, seed: number): void {
  p.rect(x - 1, y - 1, 14, 15, CAL.base);
  p.rect(x, y, 12, 12, '#3b2c4a');
  p.rect(x + 1, y + 1, 10, 5, '#4d3d60');
  p.px(x + 2, y + 2, '#8f84b8');
  p.px(x + 3, y + 1, '#8f84b8');
  p.rect(x + 5, y, 2, 12, CAL.shade);
  // Balcón: barandal de herrería negra con macetas.
  p.rect(x - 2, y + 12, 16, 1, '#2a2530');
  for (let i = 0; i < 16; i += 2) p.rect(x - 2 + i, y + 13, 1, 3, '#2a2530');
  p.rect(x - 2, y + 16, 16, 1, '#2a2530');
  if (hash(seed, 3, 7) < 0.6) {
    p.rect(x + 1, y + 10, 4, 2, '#b8532e');
    p.px(x + 2, y + 9, '#ff4f9a');
    p.px(x + 3, y + 8, '#ff4f9a');
    p.px(x + 4, y + 9, '#35c77a');
  }
}

function cortina(p: Painter, x: number, y: number, w: number, h: number): void {
  p.rect(x - 1, y - 1, w + 2, 1, METAL.shade);
  for (let yy = 0; yy < h; yy++) {
    const c = yy % 3 === 0 ? METAL.light : yy % 3 === 1 ? METAL.base : METAL.shade;
    p.rect(x, y + yy, w, 1, c);
  }
  p.rect(x + Math.floor(w / 2) - 3, y + h - 3, 6, 1, METAL.shade);
}

function puerta(
  p: Painter,
  x: number,
  y: number,
  color: { base: string; shadow: string; light: string },
  seed: number,
): void {
  p.rect(x - 2, y - 2, 16, 20, CAL.base);
  p.rect(x, y, 12, 18, hundido(color.base, 0.5));
  p.rect(x + 1, y + 1, 4, 16, hundido(color.base, 0.38));
  p.rect(x + 7, y + 1, 4, 16, hundido(color.base, 0.38));
  p.px(x + 6, y + 9, '#f0cf45');
  // Maceta junto a la puerta.
  const mx = x + 15;
  p.rect(mx, y + 12, 5, 4, '#b8532e');
  p.rect(mx, y + 12, 5, 1, '#d4704a');
  p.rect(mx + 1, y + 8, 3, 4, seed % 2 ? '#3f9d68' : '#56a04a');
  p.px(mx + 2, y + 7, seed % 2 ? '#ff4f9a' : '#ffd23f');
}

// ─── Sombras horneadas ────────────────────────────────────────────────────

function paintShadows(
  p: Painter,
  map: MapDef,
  kindAt: (tx: number, ty: number) => GroundKind | null,
  backRows: number,
): void {
  const rows = Math.max(countRows(map, kindAt), backRows);
  if (rows > 0) {
    // La sombra de las fachadas (o de la pared del fondo) sobre el piso.
    const y = rows * TILE;
    for (let i = 0; i < 5; i++) {
      p.rect(0, y + i, map.width * TILE, 1, `rgb(43 18 56 / ${0.24 - i * 0.045})`);
    }
  }
  if (backRows > 0) {
    // Interior: los muros de los lados también dan sombra, y por la puerta entra el día.
    const h = map.height * TILE;
    for (let i = 0; i < 4; i++) {
      const a = (0.18 - i * 0.04).toFixed(3);
      p.rect(TILE + i, rows * TILE, 1, h - (rows + 1) * TILE, `rgb(43 18 56 / ${a})`);
    }
    const door = map.portals[0];
    if (door) {
      const cx = door.x * TILE;
      const bottom = (map.height - 1) * TILE;
      for (let i = 0; i < 26; i++) {
        const half = 16 + i * 0.7;
        const a = (0.2 * (1 - i / 26)).toFixed(3);
        p.rect(cx - half, bottom - 1 - i, half * 2, 1, `rgb(255 248 228 / ${a})`);
      }
    }
    for (const o of map.objects) {
      if (o.kind === 'focos') lucesEnElPiso(p, o.x * TILE, o.y * TILE, o.w * TILE);
    }
  }
  for (const o of map.objects) objectShadow(p, o);
}
