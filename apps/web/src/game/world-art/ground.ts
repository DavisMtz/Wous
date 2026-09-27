import {
  BLOCKING_GROUND,
  type GroundKind,
  insideShape,
  type MapDef,
  shapeBounds,
} from '@wous/world-data';
import { WOOD } from '../rendering/palette.ts';
import { lucesEnElPiso, mosaico, muro, paintInterior, repello } from './interior.ts';
import { objectShadow } from './objects.ts';
import { hash, type Painter, painter, pick } from './paint.ts';
import {
  ASFALTO,
  AZOTEA,
  BANQUETA,
  CANTERA,
  EMPEDRADO,
  HIERRO,
  hundido,
  JACARANDA,
  LADRILLO,
  LOSA,
  PASTO,
  SETO,
  TILE,
} from './world-palette.ts';

/**
 * El suelo del mapa en un solo canvas (ancho × alto en tiles, 16 px cada
 * uno). Primero se decide el material de cada pixel —el del tile y, encima,
 * las formas del mapa (andadores en diagonal, el anillo del kiosko, los
 * jardines), que solo cambian el dibujo—; luego se pinta cada pixel con su
 * material mirando a sus vecinos (las guarniciones salen de ahí); al final
 * los interiores y las sombras de los objetos, horneadas: son estáticas y así
 * quedan siempre debajo de las personas.
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
  const mat = materialBuffer(map, w, h);
  const matAt = (gx: number, gy: number): Material | null =>
    gx < 0 || gy < 0 || gx >= w || gy >= h ? null : (MATERIALS[mat[gy * w + gx] ?? 0] ?? null);
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
      const material = matAt(gx, gy) ?? 'adoquin';
      const ctx: Px = {
        gx,
        gy,
        lx: gx % TILE,
        ly: gy % TILE,
        tx,
        ty,
        kindAt,
        matAt,
        backRows,
      };
      let color = PAINTERS[material](ctx);
      // Pétalos de jacaranda caídos cerca de cada árbol (en piso, no en seto).
      if (material === 'adoquin' || material === 'pasto' || material === 'losa') {
        color = petal(gx, gy, petals) ?? color;
      }
      put(image.data, (gy * w + gx) * 4, color);
    }
  }
  p.ctx.putImageData(image, 0, 0);

  paintFences(p, matAt, w, h);
  paintInterior(p, map, kindAt);
  paintShadows(p, map, kindAt, backRows);
  return p.canvas;
}

// ─── Materiales por pixel ──────────────────────────────────────────────────

type Material = GroundKind | 'cebra' | 'jardin';
const MATERIALS: readonly Material[] = [
  'fachada',
  'azotea',
  'banqueta',
  'adoquin',
  'losa',
  'empedrado',
  'portal',
  'ladrillo',
  'pasto',
  'seto',
  'calle',
  'duela',
  'mosaico',
  'pared',
  'cebra',
  'jardin',
];
const INDEX = new Map(MATERIALS.map((m, i) => [m, i]));

/**
 * El material de cada pixel: el de su tile y, encima, las formas en orden.
 * Una forma solo cae donde el tile se pisa (la cebra, solo en la calle): el
 * dibujo nunca contradice a la colisión.
 */
function materialBuffer(map: MapDef, w: number, h: number): Uint8Array {
  const mat = new Uint8Array(w * h);
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const kind = map.ground[ty * map.width + tx] ?? 'adoquin';
      const index = INDEX.get(kind) ?? 0;
      for (let ly = 0; ly < TILE; ly++) {
        mat.fill(index, (ty * TILE + ly) * w + tx * TILE, (ty * TILE + ly) * w + tx * TILE + TILE);
      }
    }
  }
  const calle = INDEX.get('calle');
  for (const shape of map.paint) {
    const index = INDEX.get(shape.kind) ?? 0;
    const street = shape.kind === 'cebra';
    const [x0, y0, x1, y1] = shapeBounds(shape);
    const gx0 = Math.max(0, Math.floor(x0 * TILE));
    const gy0 = Math.max(0, Math.floor(y0 * TILE));
    const gx1 = Math.min(w, Math.ceil(x1 * TILE));
    const gy1 = Math.min(h, Math.ceil(y1 * TILE));
    for (let gy = gy0; gy < gy1; gy++) {
      for (let gx = gx0; gx < gx1; gx++) {
        const tile = map.ground[Math.floor(gy / TILE) * map.width + Math.floor(gx / TILE)];
        const current = mat[gy * w + gx];
        if (street ? current !== calle : tile === undefined || BLOCKING_GROUND.has(tile)) {
          continue;
        }
        if (insideShape(shape, (gx + 0.5) / TILE, (gy + 0.5) / TILE)) mat[gy * w + gx] = index;
      }
    }
  }
  return mat;
}

type Px = {
  gx: number;
  gy: number;
  lx: number;
  ly: number;
  tx: number;
  ty: number;
  kindAt: (tx: number, ty: number) => GroundKind | null;
  matAt: (gx: number, gy: number) => Material | null;
  /** Filas de pared del fondo (interiores): se pintan de frente, no como tapa de muro. */
  backRows: number;
};

const PAINTERS: Record<Material, (px: Px) => string> = {
  adoquin: cantera,
  losa: losa,
  jardin: jardin,
  ladrillo: ladrillo,
  pasto: pasto,
  banqueta: banqueta,
  empedrado: empedrado,
  portal: portal,
  calle: calle,
  cebra: cebra,
  seto: seto,
  azotea: azotea,
  fachada: (px) => aplanado(px, '#efe1c8'),
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

/**
 * Losas grandes de cantera del atrio y de las plazas: piezas de 2×1 tiles a
 * hueso, en hiladas corridas, con la junta apenas marcada (se lee como piso,
 * no como muro), vetas suaves y el desgaste de siglos.
 */
function losa({ gx, gy }: Px): string {
  const row = Math.floor(gy / 16);
  const shift = (row % 2) * 16;
  const col = Math.floor((gx + shift) / 32);
  const lx = (gx + shift) % 32;
  const ly = gy % 16;
  if (ly === 15 || lx === 31) return LOSA.joint;
  const slab = hash(col, row, 17);
  let tint = slab < 0.6 ? LOSA.base : slab < 0.85 ? LOSA.light : LOSA.shade;
  // Veta: una línea suave que cruza algunas losas en diagonal.
  if (slab > 0.9 && (lx + ly * 3 + Math.floor(slab * 9)) % 19 === 0) tint = LOSA.vein;
  // Desgaste: manchas grandes y suaves donde más se pisa.
  if (hash(Math.floor(gx / 5), Math.floor(gy / 4), 19) > 0.93) tint = LOSA.shade;
  if (ly === 0 && lx < 30) return slab < 0.85 ? LOSA.lighter : LOSA.light;
  const speck = hash(gx, gy, 18);
  if (speck < 0.025) return LOSA.shade;
  if (speck > 0.99) return LOSA.lighter;
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

/**
 * Jardín con guarnición de cantera donde termina el pasto, por pixel: así
 * sigue igual de bien la orilla de un andador en diagonal o de una glorieta.
 */
function pasto({ gx, gy, matAt }: Px): string {
  const grass = (dx: number, dy: number) => matAt(gx + dx, gy + dy) === 'pasto';
  // Guarnición: dos pixeles al frente (abajo), uno arriba y a los lados.
  if (!grass(0, 1)) return CANTERA.shade;
  if (!grass(0, 2)) return CANTERA.light;
  if (!grass(0, -1) || !grass(-1, 0)) return CANTERA.light;
  if (!grass(1, 0)) return CANTERA.shade;
  // Sombra de la guarnición sobre el pasto.
  if (!grass(0, -2) || !grass(-2, 0)) return PASTO.deep;
  return pastoTexture(gx, gy);
}

/** El pasto por dentro: matas, florecitas y manchas de tono. */
function pastoTexture(gx: number, gy: number): string {
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

/**
 * Jardín cercado (ADR-0013): el mismo pasto, sin guarnición (la reja baja se
 * pinta encima, en `paintFences`) y con un poco más de sombra en la orilla.
 */
function jardin(px: Px): string {
  const { gx, gy, matAt } = px;
  const inside = (dx: number, dy: number) => matAt(gx + dx, gy + dy) === 'jardin';
  if (!inside(0, 1) || !inside(0, -1) || !inside(1, 0) || !inside(-1, 0)) return PASTO.deep;
  if (!inside(0, -2) || !inside(-2, 0)) return PASTO.shade;
  return pastoTexture(gx, gy);
}

/**
 * La reja baja de los jardines, de hierro verde: se para en la orilla y sube
 * 6 px, con barrotes cada 3 px y el pasamanos con su luz. Horneada en el
 * suelo: quien pasa enfrente la tapa, como debe ser.
 */
function paintFences(
  p: Painter,
  matAt: (gx: number, gy: number) => Material | null,
  w: number,
  h: number,
): void {
  const HEIGHT = 6;
  for (let gy = 0; gy < h; gy++) {
    for (let gx = 0; gx < w; gx++) {
      if (matAt(gx, gy) !== 'jardin') continue;
      const edge =
        matAt(gx, gy + 1) !== 'jardin' ||
        matAt(gx, gy - 1) !== 'jardin' ||
        matAt(gx + 1, gy) !== 'jardin' ||
        matAt(gx - 1, gy) !== 'jardin';
      if (!edge) continue;
      p.px(gx, gy, HIERRO.shade);
      p.px(gx, gy - HEIGHT, HIERRO.light);
      p.px(gx, gy - HEIGHT + 1, HIERRO.base);
      if ((gx + gy) % 3 === 0) {
        for (let k = 1; k < HEIGHT - 1; k++) p.px(gx, gy - k, HIERRO.base);
        // La punta de lanza de cada barrote.
        p.px(gx, gy - HEIGHT - 1, HIERRO.base);
      }
    }
  }
}

/** Banqueta de concreto con juntas por tile y guarnición hacia la calle o el empedrado. */
function banqueta({ gx, gy, lx, ly, tx, ty, kindAt }: Px): string {
  const street = (dx: number, dy: number) => {
    const k = kindAt(tx + dx, ty + dy);
    return k === 'calle' || k === 'empedrado';
  };
  if (street(0, 1)) {
    if (ly === 12) return BANQUETA.light;
    if (ly >= 13) return ly === 15 ? BANQUETA.curbDark : BANQUETA.curb;
  }
  if (street(0, -1) && ly === 0) return BANQUETA.curb;
  if (street(-1, 0) && lx <= 1) return lx === 0 ? BANQUETA.curbDark : BANQUETA.curb;
  if (street(1, 0) && lx >= 14) return lx === 15 ? BANQUETA.curbDark : BANQUETA.curb;
  if (lx === 15 || ly === 15) return BANQUETA.joint;
  const speck = hash(gx, gy, 41);
  if (speck < 0.04) return BANQUETA.shade;
  if (speck > 0.97) return BANQUETA.light;
  return hash(tx, ty, 42) < 0.3 ? BANQUETA.light : BANQUETA.base;
}

/**
 * Empedrado de Allende: piedras boleadas de río, cada una con su tono y su
 * brillo arriba, y la junta oscura entre ellas (celdas de 5 px con azar).
 */
function empedrado({ gx, gy }: Px): string {
  const cell = 5;
  const cx = Math.floor(gx / cell);
  const cy = Math.floor(gy / cell);
  let d1 = Number.POSITIVE_INFINITY;
  let d2 = Number.POSITIVE_INFINITY;
  let best = { x: 0, y: 0, id: 0 };
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const kx = cx + ox;
      const ky = cy + oy;
      const px = kx * cell + 1 + hash(kx, ky, 51) * (cell - 2);
      const py = ky * cell + 1 + hash(kx, ky, 52) * (cell - 2);
      const d = Math.hypot(gx + 0.5 - px, gy + 0.5 - py);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        best = { x: px, y: py, id: kx * 73856093 + ky * 19349663 };
      } else if (d < d2) {
        d2 = d;
      }
    }
  }
  if (d2 - d1 < 0.9) return EMPEDRADO.joint;
  const stone = pick(EMPEDRADO.stones, best.id, 0, 53);
  if (gy + 0.5 < best.y - 0.8 && gx + 0.5 < best.x + 0.6) return hundido(stone, -0.18);
  if (gy + 0.5 > best.y + 1.2) return hundido(stone, 0.16);
  return stone;
}

/**
 * Bajo los portales: la misma losa, en la sombra de los arcos. Más oscuro
 * junto al muro del fondo (la hilera de arriba del andador).
 */
function portal(px: Px): string {
  const base = losa(px);
  const back = px.kindAt(px.tx, px.ty - 1) === 'fachada';
  return hundido(base, back ? 0.3 : 0.18);
}

/**
 * Asfalto. En una avenida acostada (Madero) la raya amarilla va al centro de
 * la franja; en una parada (Morelos, Abasolo), en vertical.
 */
function calle({ gx, gy, lx, ly, tx, ty, kindAt }: Px): string {
  const isCalle = (dx: number, dy: number) => kindAt(tx + dx, ty + dy) === 'calle';
  const vertical = isCalle(0, -1) && isCalle(0, 1) && !(isCalle(-1, 0) && isCalle(1, 0));
  if (vertical) {
    if (!isCalle(-1, 0) && lx === 0) return ASFALTO.shade;
    if (isCalle(1, 0) && !isCalle(-1, 0) && lx === 15 && gy % 24 < 12) return ASFALTO.line;
  } else {
    if (!isCalle(0, -1) && ly === 0) return ASFALTO.shade;
    const top = !isCalle(0, -1);
    const bottom = !isCalle(0, 1);
    // Franja de tres tiles: la raya doble va en el de en medio.
    if (!top && !bottom && (ly === 7 || ly === 9)) return ASFALTO.line;
    if (top && isCalle(0, 1) && !isCalle(0, 2) && ly === 15 && gx % 24 < 12) {
      return ASFALTO.line;
    }
  }
  const speck = hash(gx, gy, 51);
  if (speck < 0.08) return ASFALTO.shade;
  if (speck > 0.93) return ASFALTO.light;
  return ASFALTO.base;
}

/**
 * Paso peatonal: franjas blancas gastadas sobre el asfalto. Como en la calle
 * de verdad, cada franja corre a lo largo del tráfico y se cruza pisándolas
 * una tras otra: en Madero (acostada) las franjas van acostadas.
 */
function cebra(px: Px): string {
  const { gx, gy, tx, ty, kindAt } = px;
  const isCalle = (dx: number, dy: number) => kindAt(tx + dx, ty + dy) === 'calle';
  const vertical = isCalle(0, -1) && isCalle(0, 1) && !(isCalle(-1, 0) && isCalle(1, 0));
  const stripe = (vertical ? gx : gy) % 8 < 4;
  if (!stripe) return calle(px);
  const worn = hash(gx, gy, 57);
  if (worn < 0.08) return ASFALTO.light;
  return worn > 0.9 ? '#d9d3cc' : '#f1ece6';
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

/**
 * Azoteas de Morelia vistas desde arriba: impermeabilizante rojo en cada
 * casa, pretiles claros entre una y otra, tinacos negros. Las casas son
 * bloques de 3×4 tiles; el azar es por casa, no por pixel.
 */
function azotea({ gx, gy, lx, ly, tx, ty }: Px): string {
  const bx = Math.floor(tx / 3);
  const by = Math.floor(ty / 4);
  const tone = pick(AZOTEA.roofs, bx, by, 72);
  // Pretil entre casas: arriba y a la izquierda de cada bloque.
  if ((tx % 3 === 0 && lx <= 1) || (ty % 4 === 0 && ly <= 1)) {
    return lx === 0 || ly === 0 ? AZOTEA.parapetShade : AZOTEA.parapet;
  }
  // Tinaco: un círculo negro con su brillo, en una de cada dos casas.
  const tank = hash(bx, by, 73);
  if (tank < 0.5 && tx % 3 === 1 + (Math.floor(tank * 4) % 2) && ty % 4 === 1) {
    const d = Math.hypot(lx + 0.5 - 8, ly + 0.5 - 8);
    if (d < 4.6) return d < 1.8 && lx < 8 && ly < 8 ? AZOTEA.tankLight : AZOTEA.tank;
    if (d < 5.6 && ly > 7) return AZOTEA.tankShadow;
  }
  const speck = hash(gx, gy, 74);
  if (speck < 0.05) return hundido(tone, 0.12);
  if (speck > 0.97) return hundido(tone, -0.12);
  // Parches de impermeabilizante nuevo.
  if (hash(Math.floor(gx / 7), Math.floor(gy / 5), 75) > 0.9) return hundido(tone, -0.08);
  return tone;
}

function duela({ gx, gy }: Px): string {
  const row = Math.floor(gy / 4);
  const offset = (row % 2) * 12;
  if (gy % 4 === 3 || (gx + offset) % 24 === 23) return WOOD.gap;
  return hash(Math.floor((gx + offset) / 24), row, 71) < 0.4 ? WOOD.shadow : WOOD.base;
}

/** Aplanado de muro: lo que queda de una fachada que ningún objeto tapa. */
function aplanado({ gx, gy }: Px, base: string): string {
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

// ─── Sombras horneadas ────────────────────────────────────────────────────

function paintShadows(
  p: ReturnType<typeof painter>,
  map: MapDef,
  kindAt: (tx: number, ty: number) => GroundKind | null,
  backRows: number,
): void {
  if (backRows > 0) {
    // La sombra de la pared del fondo sobre el piso.
    const y = backRows * TILE;
    for (let i = 0; i < 5; i++) {
      p.rect(0, y + i, map.width * TILE, 1, `rgb(43 18 56 / ${0.24 - i * 0.045})`);
    }
    // Interior: los muros de los lados también dan sombra, y por la puerta entra el día.
    const h = map.height * TILE;
    for (let i = 0; i < 4; i++) {
      const a = (0.18 - i * 0.04).toFixed(3);
      p.rect(TILE + i, backRows * TILE, 1, h - (backRows + 1) * TILE, `rgb(43 18 56 / ${a})`);
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
  } else {
    // Afuera: la sombra de cada fachada sobre lo que tiene enfrente (el sol está alto, al sur).
    for (let ty = 1; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        const above = kindAt(tx, ty - 1);
        const here = kindAt(tx, ty);
        if ((above === 'fachada' || above === 'azotea') && here !== above && here !== 'azotea') {
          for (let i = 0; i < 5; i++) {
            p.rect(tx * TILE, ty * TILE + i, TILE, 1, `rgb(43 18 56 / ${0.24 - i * 0.045})`);
          }
        }
      }
    }
  }
  for (const o of map.objects) objectShadow(p, o);
}
