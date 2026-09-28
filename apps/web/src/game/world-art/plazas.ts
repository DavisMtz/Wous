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
 * su placa, al centro de una pileta baja (a la rodilla) de piedra gris oscura.
 * El agua apenas cubre el fondo y brota en chorritos alrededor del dado.
 */
export function monumentoOcampo(wTiles: number, hTiles: number, cuadro = 0): Art {
  const W = Math.round(wTiles * TILE);
  const fondoTotal = Math.round(hTiles * TILE);
  const extra = 36;
  const H = fondoTotal + extra;
  const p = painter(W, H);
  const top = extra + 3;
  const frente = 9;
  const fondo = H - frente - top;
  // Cara del frente (a la rodilla) y la tapa del borde.
  p.rect(0, top + fondo, W, frente, O.shade);
  p.rect(0, top + fondo, W, 1, O.light);
  for (let x = 14; x < W; x += 18) p.rect(x, top + fondo + 1, 1, frente - 1, O.deep);
  p.rect(0, H - 1, W, 1, O.deep);
  p.rect(0, top, W, fondo, O.light);
  p.rect(0, top, W, 1, O.lighter);
  // El agua, bajita y oscura sobre la piedra.
  p.rect(4, top + 4, W - 8, fondo - 8, '#34505c');
  p.rect(5, top + 5, W - 10, fondo - 10, '#44697a');
  for (let i = 0; i < 18; i++) {
    // Los reflejos se mecen un pixel, cada uno a su tiempo.
    const vaiven = (i + cuadro) % 4 < 2 ? 0 : 1;
    const gx = 8 + ((i * 17) % (W - 16)) + vaiven;
    const gy = top + 8 + ((i * 11) % Math.max(1, fondo - 16));
    p.rect(gx, gy, 2, 1, '#6d97a8');
  }
  // El dado al centro, de piedra oscura, con su placa de bronce.
  const cx = Math.round(W / 2);
  const dadoPie = top + Math.round(fondo * 0.62);
  const dadoAlto = 24;
  p.ellipse(cx, dadoPie + 1, 14, 4, '#2f4a55');
  p.rect(cx - 11, dadoPie - 4, 22, 6, O.shade);
  p.rect(cx - 9, dadoPie - dadoAlto, 18, dadoAlto, O.base);
  p.rect(cx - 9, dadoPie - dadoAlto, 2, dadoAlto, O.lighter);
  p.rect(cx + 7, dadoPie - dadoAlto, 2, dadoAlto, O.deep);
  p.rect(cx - 11, dadoPie - dadoAlto - 3, 22, 3, O.light);
  p.rect(cx - 11, dadoPie - dadoAlto - 3, 22, 1, O.lighter);
  p.rect(cx - 5, dadoPie - 16, 10, 7, BRONCE.light);
  p.rect(cx - 5, dadoPie - 16, 10, 1, '#b7ad7a');
  for (const y of [dadoPie - 14, dadoPie - 12]) p.rect(cx - 3, y, 6, 1, BRONCE.shade);
  // Chorritos alrededor del dado.
  for (const dx of [-20, 20]) {
    const x = cx + dx;
    const y = dadoPie + 4;
    const alto = 7 + ((cuadro + (dx > 0 ? 1 : 0)) % 2);
    p.rect(x, y - alto, 1, alto, AGUA.foam);
    p.px(x - 1, y - alto + 2 + (cuadro % 2), AGUA.light);
    p.px(x + 1, y - alto + 3 - (cuadro % 2), AGUA.light);
    p.ellipse(x, y, 3 + (cuadro % 2), 1, AGUA.light);
  }
  // Ocampo: levita larga, el brazo al frente con un papel.
  ocampo(p, cx, dadoPie - dadoAlto - 3, 38);
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

/** Alturas de un chorro danzante a lo largo de su vuelta (px): sube, llega arriba y baja. */
const DANZA = [2, 5, 9, 14, 17, 14, 9, 5] as const;
export const CUADROS_DANZA = DANZA.length;

/**
 * Las fuentes danzantes: boquillas en el piso y chorros que brotan a
 * distintas alturas. Se camina por en medio (no estorban). Encendidas, cada
 * cuadro sube una ola que cruza la retícula en diagonal; apagadas, solo quedan
 * las boquillas y algún charco.
 */
export function chorros(wTiles: number, hTiles: number, cuadro = 0, encendida = true): Art {
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
      // Apagadas, el piso se va secando: quedan charcos sueltos.
      if (!encendida && hash(x >> 3, y >> 3, 93) > 0.22) continue;
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
      if (!encendida) continue;
      // Cada boquilla va a su tiempo en la vuelta: la ola cruza en diagonal.
      const alto = DANZA[(i + j + cuadro) % DANZA.length] ?? 8;
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

/**
 * Una de las esculturas de los mártires junto al muro poniente de la Catedral:
 * figura estilizada de cantera, encapuchada, con las manos juntas y los
 * pliegues en planos, de perfil hacia la Plaza de Armas, sobre un dado bajo
 * y en su corralito de reja negra (el muro cierra el lado de la izquierda).
 */
export function martir(wTiles: number, hTiles: number, id: string): Art {
  const W = Math.round(wTiles * TILE);
  const H = Math.round(hTiles * TILE);
  const A = 34;
  const p = painter(W, H + A);
  const seed = semilla(id);
  const reja = HERRERIA.base;
  // Tramo de reja de lado a lado sobre la línea de suelo `g`: postes con remate y dos travesaños.
  const tramo = (g: number, x0: number, x1: number) => {
    p.rect(x0, g + A - 9, x1 - x0 + 1, 1, reja);
    p.rect(x0, g + A - 4, x1 - x0 + 1, 1, reja);
    for (let x = x0; x <= x1; x += 4) {
      p.rect(x, g + A - 10, 1, 10, reja);
      p.px(x, g + A - 11, HERRERIA.light);
    }
  };
  tramo(2, 1, W - 3);

  // El dado de cantera.
  const cx = 11;
  const pie = 13 + A - 4;
  p.rect(cx - 5, pie - 5, 11, 5, C.lighter);
  p.rect(cx - 5, pie, 11, 4, C.shade);
  p.rect(cx - 5, pie + 3, 11, 1, C.deep);

  // La figura, de perfil mirando a la derecha: capucha, manos juntas, manto en planos.
  const inclina = seed % 2;
  const manos = 11 + (seed % 3);
  const alto = 27;
  for (let i = 0; i < alto; i++) {
    const y = pie - 5 - alto + i;
    let izq: number;
    let der: number;
    if (i < 9) {
      // La capucha, redonda arriba y caída hacia enfrente.
      const r = [2, 3, 4, 4, 4, 4, 4, 4, 5][i] ?? 4;
      izq = -r;
      der = Math.min(3, r - 1) + (i > 2 ? inclina : 0);
    } else {
      izq = -5 - Math.floor((i - 9) / 9);
      der = i >= manos && i < manos + 4 ? 5 : 3 + Math.floor((i - 9) / 12);
    }
    p.rect(cx + izq, y, der - izq + 1, 1, C.base);
    p.px(cx + izq, y, C.light);
    p.px(cx + izq + 1, y, C.light);
    p.px(cx + der, y, C.shade);
    // El hueco de la capucha, en sombra.
    if (i >= 3 && i <= 6) p.rect(cx + 1 + inclina, y, 2, 1, C.deep);
  }
  // Pliegues en planos: dos diagonales del hombro al ruedo y la sombra del lado de enfrente.
  for (let i = 0; i < 17; i++) {
    const y = pie - 5 - alto + 10 + i;
    p.px(cx - 3 + Math.floor(i / 6), y, C.deep);
    if (i > 5) p.px(cx + 1 + Math.floor((i - 6) / 5), y, C.shade);
    p.px(cx + 3, y, C.shade);
  }
  // Las manos juntas, con luz arriba.
  p.rect(cx + 3, pie - 5 - alto + manos, 2, 3, C.light);
  p.px(cx + 4, pie - 5 - alto + manos, C.lighter);

  // La reja de enfrente y la del costado, sobre la figura.
  tramo(H - 2, 1, W - 3);
  for (let g = 2; g <= H - 2; g++) {
    p.px(W - 3, g + A - 9, reja);
    p.px(W - 3, g + A - 4, reja);
  }
  for (let g = 2; g <= H - 2; g += 4) p.rect(W - 3, g + A - 10, 1, 10, reja);
  return { canvas: p.canvas, ox: 0, oy: -A };
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
export function fuenteDeColumna(r: number, cuadro = 0): Art {
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
  // Destellos que cambian de lugar y las ondas donde cae el agua de la copa.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7 + hash(i, cuadro, 73) * 0.1) * Math.PI * 2;
    const k = 0.6 + hash(i, cuadro, 74) * 0.35;
    p.px(
      Math.round(cx + Math.cos(a) * (R - 8) * k),
      Math.round(cy - 1 + Math.sin(a) * (R - 10) * k),
      AGUA.light,
    );
  }
  for (const dx of [-8, 7]) {
    const fase = (cuadro + (dx > 0 ? 2 : 0)) % 4;
    p.ellipse(cx + dx, cy - 1, 1 + fase, 1 + Math.floor(fase / 2), AGUA.light);
    p.ellipse(cx + dx, cy - 1, fase, Math.floor(fase / 2), AGUA.base);
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
    for (let y = copa + 3 + (cuadro % 2); y < base - 1; y += 2) p.px(cx + dx, y, AGUA.light);
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

/**
 * El carrito de gazpacho moreliano (investigacion.md §2.9): vitrina con los
 * vasos de fruta picada —mango, piña, jícama, pepino— con queso y chile, la
 * charola de limones y su rótulo. Se ponen detrás de la Catedral y hacia San
 * Agustín.
 */
export function gazpacho(id: string): Art {
  const W = 34;
  const H = 40;
  const p = painter(W, H);
  const seed = semilla(id);
  const pie = H - 2;
  // Las ruedas y el cajón.
  p.ellipse(7, pie - 2, 3, 3, HERRERIA.base);
  p.ellipse(27, pie - 2, 3, 3, HERRERIA.base);
  p.px(7, pie - 2, '#9aa3aa');
  p.px(27, pie - 2, '#9aa3aa');
  p.rect(2, pie - 14, 30, 10, '#e9edf0');
  p.rect(2, pie - 14, 30, 1, '#ffffff');
  p.rect(2, pie - 5, 30, 1, '#b8c0c7');
  p.rect(2, pie - 11, 30, 3, '#2f6fb0');
  // La vitrina con los vasos: fruta de colores, el blanco del queso y el rojo del chile.
  const vy = pie - 26;
  p.rect(3, vy, 28, 12, '#cfe3ea');
  p.rect(3, vy, 28, 1, '#f4fbfd');
  p.rect(3, vy, 1, 12, '#9fb8c2');
  p.rect(30, vy, 1, 12, '#9fb8c2');
  const FRUTA = ['#f4a21e', '#f7d64a', '#eef0e6', '#8fc45a', '#f06a3a'];
  for (let i = 0; i < 6; i++) {
    const x = 5 + i * 4;
    p.rect(x, vy + 4, 3, 7, '#f3f6f7');
    for (let y = vy + 5; y < vy + 10; y++) p.px(x + (y % 2), y, pick(FRUTA, i, y, seed));
    p.px(x + 1, vy + 4, '#d7262e');
  }
  // Los limones en su charola, arriba.
  p.rect(6, vy - 3, 12, 3, '#9aa3aa');
  for (let i = 0; i < 4; i++) p.px(7 + i * 3, vy - 4, '#8cc63f');
  // El rótulo.
  const texto = 'GAZPACHO';
  const sw = signWidth(texto);
  p.rect(Math.round((W - sw) / 2) - 1, pie - 12, sw + 2, 7, '#ffffff');
  sign(p, texto, Math.round((W - sw) / 2), pie - 11, '#d7262e');
  return { canvas: p.canvas, ox: -1, oy: -(H - TILE) };
}

/**
 * El carrito-bicicleta de elotes y esquites, con su sombrilla roja
 * (investigacion.md §2.9): la olla humeante, las mazorcas y los botes de
 * mayonesa, queso y chile.
 */
export function elotes(id: string): Art {
  const W = 40;
  const H = 62;
  const p = painter(W, H);
  const seed = semilla(id);
  const pie = H - 2;
  // La bicicleta: rueda de enfrente, manubrio y las dos ruedas del cajón.
  p.ellipse(34, pie - 4, 4, 4, HERRERIA.base);
  p.px(34, pie - 4, '#9aa3aa');
  p.rect(30, pie - 14, 1, 10, HERRERIA.base);
  p.rect(28, pie - 15, 5, 1, HERRERIA.light);
  p.ellipse(8, pie - 3, 3, 3, HERRERIA.base);
  p.ellipse(22, pie - 3, 3, 3, HERRERIA.base);
  // El cajón de lámina.
  p.rect(3, pie - 16, 26, 11, '#d9dde0');
  p.rect(3, pie - 16, 26, 1, '#f2f5f7');
  p.rect(3, pie - 6, 26, 1, '#9aa3aa');
  p.rect(3, pie - 13, 26, 4, '#f2c230');
  const texto = 'ELOTES';
  sign(p, texto, 16 - Math.round(signWidth(texto) / 2), pie - 13, '#b3261e');
  // La olla con su tapa, el vapor y las mazorcas.
  p.rect(6, pie - 23, 10, 7, '#aeb6bd');
  p.rect(6, pie - 23, 10, 1, '#dfe4e8');
  p.rect(5, pie - 24, 12, 1, '#8a939a');
  for (let i = 0; i < 3; i++) {
    const x = 8 + i * 3 + Math.floor(hash(i, 1, seed) * 2);
    p.px(x, pie - 27 - i, 'rgb(255 255 255 / 0.7)');
    p.px(x + 1, pie - 30 - i, 'rgb(255 255 255 / 0.45)');
  }
  for (let i = 0; i < 3; i++) {
    p.rect(19 + i * 3, pie - 21, 2, 5, '#f2d25a');
    p.px(19 + i * 3, pie - 22, '#8cae3c');
  }
  // Los botes: mayonesa, queso y chile.
  p.rect(18, pie - 19, 2, 3, '#f7f3e3');
  p.rect(21, pie - 19, 2, 3, '#f3efe6');
  p.rect(24, pie - 19, 2, 3, '#d7262e');
  // La sombrilla roja en su palo.
  const ux = 19;
  p.rect(ux, pie - 50, 1, 34, '#6b6f73');
  const cy = pie - 48;
  for (let y = -9; y <= 0; y++) {
    const half = Math.round(18 * Math.sqrt(1 - (y * y) / 81));
    p.rect(ux - half, cy + y, half * 2 + 1, 1, y < -6 ? '#e04a3c' : '#c8322a');
  }
  // Los gajos de la sombrilla y su orilla.
  for (const dx of [-12, -6, 0, 6, 12]) p.px(ux + dx, cy - 1, '#9e2019');
  p.rect(ux - 18, cy + 1, 37, 1, '#9e2019');
  return { canvas: p.canvas, ox: -4, oy: -(H - TILE) };
}

/**
 * El puesto del bolero: la silla alta de madera con asiento de hule sobre su
 * tarima, los estribos para los zapatos, la caja de grasas y el banquito de
 * quien bolea, bajo una sombrilla verde.
 */
export function bolero(id: string): Art {
  const W = 30;
  const H = 54;
  const p = painter(W, H);
  const seed = semilla(id);
  const pie = H - 2;
  const MADERA = { base: '#7a4a2c', light: '#9a6440', shade: '#553220' };
  // La tarima.
  p.rect(3, pie - 5, 22, 5, MADERA.shade);
  p.rect(3, pie - 6, 22, 2, MADERA.light);
  // La silla alta: patas, asiento de hule rojo y respaldo.
  p.rect(8, pie - 18, 2, 12, MADERA.base);
  p.rect(18, pie - 18, 2, 12, MADERA.base);
  p.rect(7, pie - 20, 14, 3, '#b3261e');
  p.rect(7, pie - 20, 14, 1, '#d8473a');
  p.rect(7, pie - 31, 14, 11, MADERA.base);
  p.rect(7, pie - 31, 14, 1, MADERA.light);
  p.rect(9, pie - 29, 10, 7, '#b3261e');
  // Los estribos de metal, al frente.
  p.rect(10, pie - 11, 3, 1, '#c3cbd2');
  p.rect(15, pie - 11, 3, 1, '#c3cbd2');
  // La caja de grasas y el banquito.
  p.rect(22, pie - 10, 6, 5, MADERA.light);
  p.rect(22, pie - 10, 6, 1, '#c9965e');
  p.px(23, pie - 11, pick(['#1d1a1a', '#6b3a1e', '#1d1a1a'], seed, 1));
  p.px(25, pie - 11, '#6b3a1e');
  p.rect(0, pie - 7, 4, 2, MADERA.base);
  // La sombrilla verde en su palo.
  p.rect(14, pie - 46, 1, 15, '#6b6f73');
  const cy = pie - 44;
  for (let y = -6; y <= 0; y++) {
    const half = Math.round(14 * Math.sqrt(1 - (y * y) / 36));
    p.rect(14 - half, cy + y, half * 2 + 1, 1, y < -3 ? '#3f9a5b' : '#2d7a45');
  }
  p.rect(0, cy + 1, 29, 1, '#1f5a31');
  return { canvas: p.canvas, ox: 0, oy: -(H - TILE) };
}
