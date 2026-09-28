import type { Art } from './morelia.ts';
import { hash, type Painter, painter, pick, sign, signWidth } from './paint.ts';
import {
  AGUA,
  BRONCE,
  BRONCE_OSCURO,
  BUGAMBILIA,
  CAL_TRONCO,
  CANTERA_GRIS,
  CANTERA_ROSA,
  CORTEZA,
  EXPLANADA,
  FAROL,
  HERRERIA,
  hundido,
  NARANJO,
  PIEDRA_OSCURA,
  TILE,
} from './world-palette.ts';

/**
 * El mobiliario de las plazas tal como lo cuenta la investigación del centro
 * (ADR-0013): la estatua de Ocampo en su pileta oscura y las fuentes
 * danzantes que salen del piso, el asta bandera, las jardineras con
 * bugambilias y naranjos, los macetones, los postes de dos faroles de
 * campana, las pilastras-farol de la Plaza de Armas, la fuente de columna
 * del andador, el globero y el carrito de churros, y la losa donde estuvo el
 * Árbol de los Liberales.
 */

const C = CANTERA_ROSA;
const G = CANTERA_GRIS;
const O = PIEDRA_OSCURA;

function semilla(id: string): number {
  let h = 7;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

// ─── Plaza Melchor Ocampo ─────────────────────────────────────────────────

/**
 * Melchor Ocampo de bronce oscuro, de pie sobre un dado de piedra oscura con
 * su placa, al fondo de una pileta baja (a la rodilla) de piedra gris oscura.
 * El agua apenas cubre el fondo y brota en chorritos.
 */
export function monumentoOcampo(wTiles: number, hTiles: number): Art {
  const W = wTiles * TILE;
  const extra = 62;
  const H = hTiles * TILE + extra;
  const p = painter(W, H);
  const top = extra + 3;
  const frente = 9;
  const fondo = H - frente - top;
  // Cara del frente (a la rodilla) y la tapa del borde.
  p.rect(0, top + fondo, W, frente, O.shade);
  p.rect(0, top + fondo, W, 1, O.light);
  for (let x = 12; x < W; x += 16) p.rect(x, top + fondo + 1, 1, frente - 1, O.deep);
  p.rect(0, H - 1, W, 1, O.deep);
  p.rect(0, top, W, fondo, O.light);
  p.rect(0, top, W, 1, O.lighter);
  // El agua, bajita y oscura sobre la piedra, con sus chorritos.
  p.rect(3, top + 3, W - 6, fondo - 6, '#34505c');
  p.rect(4, top + 4, W - 8, fondo - 8, '#44697a');
  for (let i = 0; i < 12; i++) {
    const gx = 7 + ((i * 13) % (W - 14));
    const gy = top + 7 + ((i * 7) % Math.max(1, fondo - 14));
    p.rect(gx, gy, 2, 1, '#6d97a8');
  }
  for (const x of [10, W - 11]) {
    p.rect(x, top + fondo - 14, 1, 6, AGUA.foam);
    p.px(x - 1, top + fondo - 12, AGUA.light);
    p.px(x + 1, top + fondo - 11, AGUA.light);
    p.ellipse(x, top + fondo - 8, 3, 1, AGUA.light);
  }
  // El dado: piedra oscura con su placa de bronce, al fondo de la pileta.
  const cx = Math.round(W / 2);
  const dadoPie = top + 16;
  const dadoAlto = 22;
  p.rect(cx - 10, dadoPie - 4, 20, 6, O.shade);
  p.rect(cx - 8, dadoPie - dadoAlto, 16, dadoAlto, O.base);
  p.rect(cx - 8, dadoPie - dadoAlto, 2, dadoAlto, O.lighter);
  p.rect(cx + 6, dadoPie - dadoAlto, 2, dadoAlto, O.deep);
  p.rect(cx - 10, dadoPie - dadoAlto - 3, 20, 3, O.light);
  p.rect(cx - 10, dadoPie - dadoAlto - 3, 20, 1, O.lighter);
  p.rect(cx - 5, dadoPie - 15, 10, 7, BRONCE.light);
  p.rect(cx - 5, dadoPie - 15, 10, 1, '#b7ad7a');
  for (const y of [dadoPie - 13, dadoPie - 11]) p.rect(cx - 3, y, 6, 1, BRONCE.shade);
  // Ocampo: levita larga, el brazo al frente con un papel.
  ocampo(p, cx, dadoPie - dadoAlto - 3, 34);
  return { canvas: p.canvas, ox: 0, oy: -extra };
}

function ocampo(p: Painter, cx: number, pie: number, h: number): void {
  const B = BRONCE_OSCURO;
  const cabeza = pie - h;
  // Piernas y levita.
  p.rect(cx - 3, pie - 8, 3, 8, B.shade);
  p.rect(cx + 1, pie - 8, 3, 8, B.base);
  p.rect(cx - 5, cabeza + 7, 11, h - 13, B.base);
  p.rect(cx - 5, cabeza + 7, 2, h - 13, B.light);
  p.rect(cx + 4, cabeza + 7, 2, h - 13, B.shade);
  p.rect(cx - 6, pie - 9, 13, 2, B.base);
  // Cabeza con su pelo y patillas.
  p.rect(cx - 2, cabeza, 6, 7, B.base);
  p.rect(cx - 2, cabeza, 6, 2, B.shade);
  p.px(cx - 1, cabeza + 3, B.light);
  // El brazo derecho adelante, con el rollo de papel.
  p.rect(cx + 5, cabeza + 10, 4, 3, B.base);
  p.rect(cx + 8, cabeza + 9, 2, 5, B.light);
  // Pátina en los pliegues.
  p.px(cx + 3, cabeza + 13, B.patina);
  p.px(cx - 3, cabeza + 20, B.patina);
}

/**
 * Las fuentes danzantes: boquillas en el piso y chorros que brotan a
 * distintas alturas. Se camina por en medio (no estorban).
 */
export function chorros(wTiles: number, hTiles: number): Art {
  const W = wTiles * TILE;
  const extra = 22;
  const H = hTiles * TILE + extra;
  const p = painter(W, H);
  // El piso mojado, más oscuro, con charquitos.
  for (let y = 0; y < hTiles * TILE; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - W / 2) / (W / 2);
      const dy = (y - (hTiles * TILE) / 2) / ((hTiles * TILE) / 2);
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      if (d > 0.82 && hash(x, y, 91) < 0.5) continue;
      p.px(x, extra + y, hash(x >> 2, y >> 2, 92) > 0.8 ? '#9bb8c6' : EXPLANADA.wet);
    }
  }
  const n = Math.max(2, wTiles - 1);
  const m = Math.max(2, hTiles - 1);
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < n; i++) {
      const x = Math.round(((i + 1) * W) / (n + 1));
      const y = extra + Math.round(((j + 1) * hTiles * TILE) / (m + 1));
      p.rect(x - 1, y, 3, 2, O.deep);
      p.px(x, y, '#c8d6dc');
      // Cada boquilla con su altura: unas apenas burbujean.
      const alto = [4, 10, 16, 7][(i + j * 3) % 4] ?? 8;
      p.rect(x, y - alto, 1, alto, AGUA.foam);
      p.px(x - 1, y - alto + 2, AGUA.light);
      p.px(x + 1, y - alto + 3, AGUA.light);
      p.px(x - 1, y - alto, AGUA.foam);
      p.px(x + 1, y - alto, AGUA.foam);
      p.ellipse(x, y + 1, 3, 1, 'rgb(230 246 251 / 0.7)');
    }
  }
  return { canvas: p.canvas, ox: 0, oy: -extra };
}

/** La losa de cantera donde estuvo el Árbol de los Liberales, a ras de piso. */
export function losaLiberales(wTiles: number, hTiles: number): Art {
  const W = Math.round(wTiles * TILE);
  const H = Math.round(hTiles * TILE);
  const p = painter(W, H);
  p.rect(1, 2, W - 2, H - 3, C.shade);
  p.rect(1, 1, W - 2, H - 4, C.light);
  p.rect(1, 1, W - 2, 1, C.lighter);
  // Las letras labradas: renglones cortos y la firma.
  for (let r = 0; r < 3; r++) {
    const y = 4 + r * 3;
    for (let x = 4; x < W - 4; x++) {
      if (hash(x, r, 41) < 0.72 && x % 5 !== 0) p.px(x, y, C.deep);
    }
  }
  p.rect(W - 11, H - 5, 6, 1, C.deep);
  return { canvas: p.canvas, ox: 0, oy: 0 };
}

/** El asta bandera, altísima y delgada, gris verdosa, con la bandera al viento. */
export function asta(): Art {
  const W = 52;
  const alto = 176;
  const H = alto + 16;
  const p = painter(W, H);
  const x = 7;
  const pie = H - 3;
  // Base de piedra oscura.
  p.rect(x - 5, pie - 6, 12, 6, O.base);
  p.rect(x - 5, pie - 6, 12, 1, O.lighter);
  p.rect(x + 4, pie - 6, 3, 6, O.shade);
  // El mástil, que se adelgaza.
  const top = pie - alto;
  p.rect(x - 1, top + 60, 3, alto - 66, '#76877d');
  p.rect(x - 1, top + 60, 1, alto - 66, '#9aaba1');
  p.rect(x, top + 2, 2, 60, '#76877d');
  p.rect(x, top + 2, 1, 60, '#9aaba1');
  p.ellipse(x + 1, top + 1, 2, 2, '#c9a45a');
  // La bandera: verde, blanco y rojo, con el águila al centro y la onda del viento.
  const fx = x + 2;
  const fy = top + 6;
  const fw = 42;
  const fh = 26;
  for (let i = 0; i < fw; i++) {
    const onda = Math.round(Math.sin(i / 6) * 2);
    const franja = i < fw / 3 ? 'verde' : i < (2 * fw) / 3 ? 'blanco' : 'rojo';
    const base = franja === 'verde' ? '#0f7a4c' : franja === 'blanco' ? '#f4f1ea' : '#cf2034';
    const sombra = Math.cos(i / 6) < -0.3;
    for (let j = 0; j < fh; j++) {
      p.px(fx + i, fy + j + onda, sombra ? hundido(base, 0.15) : base);
    }
  }
  // El águila (café con su nopal verde), apenas unos pixeles.
  const ax = fx + Math.round(fw / 2);
  const ay = fy + Math.round(fh / 2) + Math.round(Math.sin(fw / 12) * 2);
  p.rect(ax - 2, ay - 3, 4, 4, '#8a5a2b');
  p.px(ax - 3, ay - 2, '#8a5a2b');
  p.px(ax + 2, ay - 4, '#6b4420');
  p.rect(ax - 2, ay + 1, 4, 1, '#3f8a3a');
  // La cuerda.
  for (let y = fy + fh; y < pie - 8; y += 3) p.px(x + 2, y, '#d8d2c6');
  return { canvas: p.canvas, ox: -1, oy: -(H - TILE) };
}

// ─── Jardineras y macetones ───────────────────────────────────────────────

/**
 * Jardinera de cantera: bordillo bajo y, dentro, bugambilias (magenta y
 * morada) o un naranjo con su pie encalado entre arbustos. Macetón: el cubo
 * de cantera clara con su arbusto, de los que van junto a la reja del atrio.
 */
export function jardinera(
  variant: string | undefined,
  wTiles: number,
  hTiles: number,
  id: string,
): Art {
  if (variant === 'maceton') return maceton(id);
  const W = Math.round(wTiles * TILE);
  const fondo = Math.round(hTiles * TILE);
  const conArbol = variant === 'naranjo';
  const extra = conArbol ? 50 : 14;
  const H = fondo + extra;
  const p = painter(W, H);
  const seed = semilla(id);
  const top = extra;
  // Bordillo: tapa clara y su cara al frente.
  p.rect(0, top, W, fondo, C.light);
  p.rect(0, top + fondo - 5, W, 5, C.shade);
  p.rect(0, top + fondo - 5, W, 1, C.lighter);
  p.rect(0, H - 1, W, 1, C.deep);
  // La tierra.
  p.rect(2, top + 2, W - 4, fondo - 8, '#6b4a36');
  // El follaje: montoncitos que suben por encima del bordillo.
  const matas = conArbol ? 10 : 16;
  for (let i = 0; i < matas; i++) {
    const mx = 4 + Math.floor(hash(i, 1, seed) * (W - 8));
    const my = top + 4 + Math.floor(hash(i, 2, seed) * (fondo - 12));
    const r = 4 + Math.floor(hash(i, 3, seed) * 3);
    const flor = !conArbol || hash(i, 4, seed) > 0.4;
    bugambilia(p, mx, my, r, flor, seed + i);
  }
  if (conArbol) naranjo(p, Math.round(W / 2), top + fondo - 10, seed);
  return { canvas: p.canvas, ox: 0, oy: -extra };
}

function bugambilia(p: Painter, cx: number, cy: number, r: number, flor: boolean, seed: number) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y * 1.4 > r * r) continue;
      const h = hash(cx + x, cy + y, seed);
      let c = y < -r / 3 ? BUGAMBILIA.hoja : hundido(BUGAMBILIA.hoja, 0.18);
      if (flor && h > 0.35) {
        c =
          h > 0.85
            ? BUGAMBILIA.light
            : h > 0.62
              ? BUGAMBILIA.magenta
              : h > 0.5
                ? BUGAMBILIA.morada
                : BUGAMBILIA.deep;
      }
      p.px(cx + x, cy + y - 3, c);
    }
  }
}

function naranjo(p: Painter, cx: number, pie: number, seed: number): void {
  // Tronco con su cal.
  p.rect(cx - 2, pie - 26, 4, 26, CORTEZA.base);
  p.rect(cx - 2, pie - 26, 1, 26, CORTEZA.light);
  p.rect(cx - 2, pie - 10, 5, 10, CAL_TRONCO.base);
  p.rect(cx + 2, pie - 10, 1, 10, CAL_TRONCO.shade);
  // Copa redonda, tupida, con sus naranjas.
  const cy = pie - 38;
  const R = 15;
  for (let y = -R; y <= R; y++) {
    for (let x = -R; x <= R; x++) {
      const d = (x * x + y * y) / (R * R);
      if (d > 1) continue;
      if (d > 0.8 && hash(x, y, seed) < 0.35) continue;
      const luz = -x * 0.5 - y * 0.8;
      const h = hash((cx + x) >> 1, (cy + y) >> 1, seed + 3);
      let c = luz > 5 ? NARANJO.light : luz < -6 ? NARANJO.shade : NARANJO.base;
      if (h < 0.1) c = NARANJO.deep;
      p.px(cx + x, cy + y, c);
    }
  }
  for (let i = 0; i < 9; i++) {
    const a = hash(i, 5, seed) * Math.PI * 2;
    const r = 4 + hash(i, 6, seed) * 9;
    const fx = Math.round(cx + Math.cos(a) * r);
    const fy = Math.round(cy + Math.sin(a) * r);
    p.rect(fx, fy, 2, 2, NARANJO.fruta);
    p.px(fx, fy, NARANJO.frutaLuz);
  }
}

function maceton(id: string): Art {
  const p = painter(TILE, 30);
  const seed = semilla(id);
  const piedra = { base: '#b7ae9f', light: '#cac2b4', shade: '#9a9183', deep: '#7c7468' };
  p.rect(1, 12, 14, 5, piedra.light);
  p.rect(1, 12, 14, 1, '#dcd5c8');
  p.rect(1, 17, 14, 12, piedra.shade);
  p.rect(1, 17, 1, 12, piedra.base);
  p.rect(1, 29, 14, 1, piedra.deep);
  // El arbusto.
  for (let y = -7; y <= 4; y++) {
    for (let x = -7; x <= 7; x++) {
      if (x * x + (y + 1) * (y + 1) * 1.6 > 49) continue;
      const h = hash(x, y, seed);
      p.px(
        8 + x,
        12 + y,
        y < -3 ? (h > 0.5 ? '#6aa84a' : '#4f8f3c') : h > 0.8 ? '#4f8f3c' : '#3b7131',
      );
    }
  }
  return { canvas: p.canvas, ox: 0, oy: -14 };
}

// ─── Faroles y pilastras ──────────────────────────────────────────────────

/** Poste negro con dos faroles de campana colgados de su travesaño (Melchor Ocampo). */
export function farolDeCampanas(): Art {
  const W = 30;
  const H = 76;
  const p = painter(W, H);
  const cx = 15;
  const pie = H - 2;
  p.rect(cx - 4, pie - 7, 9, 7, HERRERIA.base);
  p.rect(cx - 4, pie - 7, 9, 1, HERRERIA.light);
  p.rect(cx - 1, pie - 58, 3, 51, HERRERIA.base);
  p.rect(cx - 1, pie - 58, 1, 51, HERRERIA.light);
  for (const y of [pie - 22, pie - 40]) p.rect(cx - 2, y, 5, 2, HERRERIA.base);
  p.ellipse(cx, pie - 60, 2, 2, HERRERIA.base);
  // Travesaño y las dos campanas.
  p.rect(cx - 12, pie - 55, 25, 2, HERRERIA.base);
  p.rect(cx - 12, pie - 55, 25, 1, HERRERIA.light);
  for (const bx of [cx - 11, cx + 11]) campana(p, bx, pie - 53);
  return { canvas: p.canvas, ox: -7, oy: -60 };
}

function campana(p: Painter, cx: number, y: number): void {
  p.rect(cx, y, 1, 2, HERRERIA.base);
  p.rect(cx - 2, y + 2, 5, 2, HERRERIA.base);
  p.rect(cx - 3, y + 4, 7, 3, HERRERIA.base);
  p.rect(cx - 4, y + 7, 9, 2, HERRERIA.base);
  p.px(cx - 2, y + 3, HERRERIA.light);
  // La luz por debajo.
  p.rect(cx - 3, y + 9, 7, 1, FAROL.glass);
  p.rect(cx - 1, y + 10, 3, 1, FAROL.glow);
}

/**
 * Pilastra de cantera: basa, fuste con su tablero rehundido y un adorno
 * labrado, cornisa y remate de piña; un farol negro de vidrio esmerilado
 * sale de un brazo de voluta cerca de la punta.
 */
export function pilastra(brazo: string | undefined): Art {
  const W = 34;
  const H = 88;
  const p = painter(W, H);
  const izquierda = brazo === 'izquierda';
  const cx = 17;
  const pie = H - 4;
  // Basa.
  p.rect(cx - 7, pie - 6, 14, 6, C.shade);
  p.rect(cx - 7, pie - 6, 14, 1, C.lighter);
  p.rect(cx - 7, pie - 1, 14, 1, C.deep);
  // Fuste con su tablero.
  const fusteTop = pie - 58;
  p.rect(cx - 5, fusteTop, 10, 52, C.base);
  p.rect(cx - 5, fusteTop, 2, 52, C.lighter);
  p.rect(cx + 3, fusteTop, 2, 52, C.shade);
  p.rect(cx - 2, fusteTop + 6, 5, 38, C.shade);
  p.rect(cx - 2, fusteTop + 6, 5, 1, C.deep);
  p.rect(cx + 2, fusteTop + 7, 1, 37, C.light);
  // El adorno labrado: un rombo con su flor.
  p.px(cx, fusteTop + 14, C.lighter);
  p.rect(cx - 1, fusteTop + 15, 3, 1, C.lighter);
  p.px(cx, fusteTop + 16, C.lighter);
  // Cornisa y remate de piña.
  p.rect(cx - 7, fusteTop - 4, 14, 4, C.light);
  p.rect(cx - 7, fusteTop - 4, 14, 1, C.lighter);
  p.rect(cx - 6, fusteTop - 1, 12, 1, C.deep);
  p.rect(cx - 3, fusteTop - 7, 6, 3, C.base);
  p.ellipse(cx, fusteTop - 11, 3, 4, C.light);
  p.px(cx - 1, fusteTop - 13, C.lighter);
  p.px(cx, fusteTop - 16, C.shade);
  // Brazo de voluta y el farol.
  const lado = izquierda ? -1 : 1;
  const bx = cx + lado * 5;
  const by = fusteTop + 6;
  for (let i = 0; i < 8; i++) p.px(bx + lado * i, by - Math.round(i / 3), HERRERIA.base);
  p.px(bx + lado * 2, by + 1, HERRERIA.base);
  p.px(bx + lado * 3, by + 2, HERRERIA.base);
  const lx = bx + lado * 9 - 3;
  const ly = by - 4;
  p.rect(lx + 1, ly - 2, 5, 1, HERRERIA.base);
  p.rect(lx, ly - 1, 7, 1, HERRERIA.base);
  p.rect(lx, ly, 7, 8, '#f4ecd6');
  p.rect(lx + 2, ly + 1, 3, 5, FAROL.glow);
  p.rect(lx, ly, 1, 8, HERRERIA.base);
  p.rect(lx + 6, ly, 1, 8, HERRERIA.base);
  p.rect(lx, ly + 8, 7, 1, HERRERIA.base);
  p.px(lx + 3, ly + 9, HERRERIA.base);
  return { canvas: p.canvas, ox: -9, oy: -(H - TILE) + 2 };
}

// ─── Fuente de columna ────────────────────────────────────────────────────

/**
 * La fuente de columna del andador Juárez: pileta redonda con el borde de
 * tableros y un escalón alrededor; al centro, una columna anillada con su
 * copa chica y, arriba, un jarrón con piña. Cantera gris-café.
 */
export function fuenteDeColumna(r: number): Art {
  const d = Math.round(r * 2 * TILE);
  const alto = 44;
  const W = d + 4;
  const H = d + alto + 2;
  const p = painter(W, H);
  const cx = Math.round(W / 2);
  const cy = H - Math.round(d / 2) - 2;
  const R = d / 2;
  // El escalón de alrededor, al ras.
  p.ellipse(cx, cy + 2, R + 1, R, G.light);
  // Borde de tableros: la cara al frente con sus divisiones.
  p.ellipse(cx, cy + 1, R - 1, R - 2, G.shade);
  for (let x = cx - R + 4; x < cx + R - 3; x += 5) {
    const dy = Math.round((R - 3) * Math.sqrt(Math.max(0, 1 - ((x - cx) / (R - 1)) ** 2)));
    p.rect(x, cy + dy - 3, 1, 4, G.deep);
  }
  p.ellipse(cx, cy - 2, R - 1, R - 3, G.lighter);
  p.ellipse(cx, cy - 2, R - 4, R - 6, AGUA.shade);
  p.ellipse(cx, cy - 1, R - 5, R - 7, AGUA.base);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    p.px(
      Math.round(cx + Math.cos(a) * (R - 8)),
      Math.round(cy - 1 + Math.sin(a) * (R - 10)),
      AGUA.light,
    );
  }
  // La columna anillada.
  const base = cy - 2;
  const colTop = base - alto + 10;
  p.rect(cx - 3, colTop, 6, base - colTop, G.base);
  p.rect(cx - 3, colTop, 2, base - colTop, G.lighter);
  p.rect(cx + 2, colTop, 1, base - colTop, G.deep);
  for (let y = colTop + 5; y < base; y += 6) p.rect(cx - 4, y, 8, 2, G.light);
  // La copa chica y su agua que cae.
  const copa = colTop + 14;
  p.ellipse(cx, copa + 2, 8, 3, G.shade);
  p.ellipse(cx, copa, 8, 3, G.light);
  p.ellipse(cx, copa, 6, 2, AGUA.base);
  for (const dx of [-8, 7]) {
    for (let y = copa + 3; y < base - 1; y += 2) p.px(cx + dx, y, AGUA.light);
  }
  // El jarrón con piña.
  p.rect(cx - 2, colTop - 2, 5, 2, G.light);
  p.ellipse(cx, colTop - 6, 4, 4, G.base);
  p.ellipse(cx - 1, colTop - 7, 2, 2, G.lighter);
  p.ellipse(cx, colTop - 12, 2, 3, G.light);
  p.px(cx, colTop - 16, G.shade);
  return { canvas: p.canvas, ox: -2, oy: -(alto + 2) };
}

// ─── Vendimia ─────────────────────────────────────────────────────────────

const GLOBOS = [
  '#c9d1da',
  '#f2f5f8',
  '#3a78d8',
  '#e8384f',
  '#ffd23f',
  '#ff6fb5',
  '#8e5bd6',
  '#35c77a',
] as const;

/**
 * El globero: un racimo enorme de globos metálicos (estrellas, corazones,
 * bolas de playa) amarrados a sus palos. El vendedor anda por ahí.
 */
export function globos(id: string): Art {
  const W = 48;
  const H = 86;
  const p = painter(W, H);
  const seed = semilla(id);
  const cx = 24;
  const pie = H - 3;
  // Los palos y el amarre.
  p.rect(cx - 1, pie - 30, 2, 30, '#8a6a4a');
  p.rect(cx - 3, pie - 3, 7, 3, '#5b4533');
  for (let i = 0; i < 9; i++) {
    const tx = 4 + Math.floor(hash(i, 1, seed) * 40);
    const ty = 6 + Math.floor(hash(i, 2, seed) * 36);
    for (let t = 0; t < 12; t++) {
      const k = t / 12;
      p.px(Math.round(cx + (tx - cx) * k), Math.round(pie - 30 + (ty - pie + 30) * k), '#e8e2d6');
    }
  }
  // El racimo: globos redondos, estrellas y corazones, de atrás para adelante.
  for (let i = 0; i < 26; i++) {
    const gx = 5 + Math.floor(hash(i, 3, seed) * 38);
    const gy = 6 + Math.floor(hash(i, 4, seed) * 40);
    const c = pick(GLOBOS, i, seed, 5);
    const forma = hash(i, 6, seed);
    if (forma < 0.2) estrella(p, gx, gy, c);
    else if (forma < 0.35) corazon(p, gx, gy, c);
    else {
      const r = 4 + Math.floor(hash(i, 7, seed) * 2);
      p.ellipse(gx, gy, r, r, hundido(c, 0.2));
      p.ellipse(gx - 1, gy - 1, r - 1, r - 1, c);
      p.px(gx - 2, gy - 2, '#ffffff');
    }
  }
  return { canvas: p.canvas, ox: -16, oy: -(H - TILE) };
}

function estrella(p: Painter, x: number, y: number, c: string): void {
  const s = ['..#..', '.###.', '#####', '.###.', '#.#.#'];
  s.forEach((row, j) => {
    for (let i = 0; i < 5; i++) if (row[i] === '#') p.px(x - 2 + i, y - 2 + j, c);
  });
  p.px(x - 1, y - 1, '#ffffff');
}

function corazon(p: Painter, x: number, y: number, c: string): void {
  const s = ['##.##', '#####', '#####', '.###.', '..#..'];
  s.forEach((row, j) => {
    for (let i = 0; i < 5; i++) if (row[i] === '#') p.px(x - 2 + i, y - 2 + j, c);
  });
  p.px(x - 2, y - 2, '#ffffff');
}

/** El carrito de churros: charola de lámina en su tijera, las bolsas y el rótulo. */
export function churros(id: string): Art {
  const W = 36;
  const H = 42;
  const p = painter(W, H);
  const seed = semilla(id);
  const pie = H - 2;
  // La tijera.
  for (let i = 0; i < 16; i++) {
    p.px(6 + i, pie - i, HERRERIA.base);
    p.px(29 - i, pie - i, HERRERIA.base);
  }
  p.rect(5, pie, 4, 1, HERRERIA.shade);
  p.rect(27, pie, 4, 1, HERRERIA.shade);
  // La charola de lámina con los churros.
  const ty = pie - 22;
  p.rect(2, ty + 4, 32, 4, '#9aa3aa');
  p.rect(2, ty + 4, 32, 1, '#dde3e8');
  p.rect(3, ty, 30, 4, '#c3cbd2');
  for (let i = 0; i < 9; i++) {
    const x = 5 + i * 3;
    p.rect(x, ty - 1 + (i % 2), 2, 5, '#c9832e');
    p.px(x, ty - 1 + (i % 2), '#e8a655');
  }
  // Bolsitas de papel con azúcar.
  for (let i = 0; i < 3; i++) {
    const bx = 6 + i * 9;
    p.rect(bx, ty - 9, 6, 8, '#f1e8d6');
    p.rect(bx, ty - 9, 6, 1, '#d8ccb5');
    p.rect(bx + 1, ty - 11, 1, 3, pick(['#c9832e', '#b87628'], i, seed, 1));
  }
  // El rótulo.
  const texto = 'CHURROS';
  const sw = signWidth(texto);
  p.rect(Math.round((W - sw) / 2) - 2, ty + 9, sw + 4, 7, '#ffd23f');
  sign(p, texto, Math.round((W - sw) / 2), ty + 10, '#3a2230');
  return { canvas: p.canvas, ox: -2, oy: -(H - TILE) };
}
