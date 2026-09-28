import { hash, type Painter, painter } from './paint.ts';
import { AZULEJO, CANTERA_ROSA, HERRERIA, hundido, TECHO, TILE } from './world-palette.ts';

/**
 * La Catedral de Morelia vista desde Madero (ADR-0013), a la escala de la
 * Plaza v3 (ADR-0014): la huella mide 40 × 56 tiles y el dibujo cabe en ella.
 *
 * Abajo, la fachada norte de cantera rosa: las dos torres de 62 m (fuste liso
 * con sus ventanitas, la cornisa volada, el primer cuerpo con el reloj de
 * marco de sol y el gran vano de la campana con balcón, el cuerpo ochavado, la
 * linternilla con pináculos de trompo, el cupulín de gajos y la cruz) y, entre
 * ellas, el cuerpo central de barroco tablerado con sus tres puertas, el gran
 * relieve, la ventana oval, los nichos con santos blancos, los medallones
 * papales y el remate de frontones con perillones. Los cuerpos altos de la
 * torre oriente son salmón, como en las fotos.
 *
 * Detrás, lo que se ve desde arriba: las bóvedas de rojo terracota con sus
 * nervaduras claras y los pretiles de balaustrada, el crucero, la cúpula de
 * azulejo en rombos azul y blanco sobre su tambor, la cúpula de la sacristía
 * con su santo, el ábside y, junto a la torre oriente, el anexo blanco de
 * ventanas rojas con su cupulita.
 *
 * Las alturas van a ≈0.8 del piso (en 3/4 se lee mejor): las torres suben
 * 600 px desde el pie de la fachada.
 */

type Piedra = {
  base: string;
  light: string;
  lighter: string;
  shade: string;
  deep: string;
  joint: string;
};

const C: Piedra = CANTERA_ROSA;
/** La portada: la misma cantera, más malva por la sombra de tanto relieve. */
const MALVA: Piedra = {
  base: '#b68b85',
  light: '#c8a099',
  lighter: '#d9b7af',
  shade: '#98706a',
  deep: '#7a5650',
  joint: '#a67d76',
};
/** Los cuerpos altos de la torre oriente. */
const SALMON: Piedra = {
  base: '#c98a7a',
  light: '#d9a191',
  lighter: '#e8b8a8',
  shade: '#a96a5e',
  deep: '#8b554a',
  joint: '#b87868',
};
/** Relieves, tableros papales y santos: blanquecinos. */
const BLANCO = { base: '#e0d8cf', shade: '#b9afa6', deep: '#968b83', light: '#f0ebe4' };
const OSCURO = '#3a2230';
const VIDRIO = { dark: '#3b3552', light: '#8f84b8' };
const MADERA = { base: '#6b4526', light: '#8a5d35', shade: '#4a2f1a', deep: '#33200f' };
const BRONCE = { base: '#9c7a3c', light: '#c9a45a', shade: '#6d5323', deep: '#4d3a17' };

/** Ancho del dibujo para el que está hecha la planta (40 tiles). */
const ANCHO = 40 * TILE;

/** Planta en pixeles del lienzo (el pie de la fachada es la última fila). */
const TORRE_ORIENTE = { x: 64, w: 154 };
const TORRE_PONIENTE = { x: 438, w: 154 };
const CENTRO = { x: TORRE_ORIENTE.x + TORRE_ORIENTE.w, w: TORRE_PONIENTE.x - 218 };
/** Altura del cuerpo central hasta su remate (px sobre el pie). */
const CENTRO_ALTO = 250;
/** Las torres: el fuste liso, la cornisa con su balaustrada y el primer cuerpo (px). */
const FUSTE = 258;
const BALAUSTRADA = 16;
const PRIMER_CUERPO = 168;
/** El vano de la campana grande: su pie sobre el del primer cuerpo, su ancho y su alto (px). */
const VANO = { sobre: 58, w: 40, h: 78 };

/** La boca de la campana grande (px). */
const BOCA = Math.max(6, Math.round(VANO.w * 0.36));

/**
 * Dónde cuelga la campana grande de cada torre, desde la esquina del lienzo
 * de la Catedral (px): el eje de su yugo. De ahí se mece y salen las
 * campanadas del ambiente.
 */
export function campanasDeCatedral(wTiles: number, hTiles: number): { x: number; y: number }[] {
  const dx = Math.round((Math.round(wTiles * TILE) - ANCHO) / 2);
  const pieDelVano = Math.round(hTiles * TILE) - FUSTE - BALAUSTRADA - VANO.sobre;
  // Como en `campanario`: la campana arranca media anchura abajo del arco; el yugo, encima.
  const y = pieDelVano - VANO.h + Math.round(VANO.w / 2) + 4 - 2;
  return [TORRE_ORIENTE, TORRE_PONIENTE].map((t) => ({ x: dx + t.x + Math.round(t.w / 2), y }));
}

/** La campana grande sola, con su yugo, para mecerla: el eje del yugo en (`x`, `y`). */
export function campanaSola(): { canvas: HTMLCanvasElement; x: number; y: number } {
  const p = painter(BOCA + 6, BOCA + 10);
  const cx = Math.round((BOCA + 6) / 2);
  pintarCampana(p, cx, 3, BOCA);
  return { canvas: p.canvas, x: cx, y: 1 };
}

/** El hueco oscuro del vano donde cuelga la campana (tapa la del dibujo mientras se mece). */
export function huecoDeCampana(): { canvas: HTMLCanvasElement; x: number; y: number } {
  const p = painter(BOCA + 6, BOCA + 10);
  p.rect(0, 0, BOCA + 6, BOCA + 10, OSCURO);
  return { canvas: p.canvas, x: Math.round((BOCA + 6) / 2), y: 1 };
}

/** La campana de bronce con su yugo de madera; `by` es donde empieza el bronce. */
function pintarCampana(p: Painter, cx: number, by: number, cw: number): void {
  p.rect(cx - cw / 2 - 2, by - 3, cw + 4, 2, MADERA.shade);
  for (let yy = 0; yy < cw + 4; yy++) {
    const half = Math.min(cw / 2 + 1, 2 + Math.floor(yy / 2));
    for (let xx = -half; xx < half; xx++) {
      const c = xx < -half + 2 ? BRONCE.light : xx > half - 2 ? BRONCE.shade : BRONCE.base;
      p.px(cx + xx, by + yy, c);
    }
  }
  p.rect(cx - cw / 2 - 1, by + cw + 4, cw + 2, 1, BRONCE.deep);
  p.px(cx, by + cw + 5, BRONCE.deep);
}

export function catedral(
  wTiles: number,
  hTiles: number,
): { canvas: HTMLCanvasElement; ox: number; oy: number } {
  const W = Math.round(wTiles * TILE);
  const H = Math.round(hTiles * TILE);
  const p = painter(W, H);
  // La planta está hecha para 40 tiles de ancho; otro ancho la centra.
  const dx = Math.round((W - ANCHO) / 2);
  p.ctx.translate(dx, 0);
  const base = H;

  // ── Lo de atrás primero: techos, crucero, cúpulas.
  abside(p, 128, 8, 384, 152);
  naves(p, 64, 160, 528, 192, 351);
  crucero(p, 0, 352, ANCHO, 160);
  naves(p, 64, 512, 528, 250, 352);
  cupulaChica(p, 470, 170, 30, true);
  capillas(p);
  cupula(p, 320, 470);
  anexo(p, 16, base);

  // ── La fachada.
  torre(p, TORRE_ORIENTE.x, TORRE_ORIENTE.w, base, SALMON, false);
  torre(p, TORRE_PONIENTE.x, TORRE_PONIENTE.w, base, C, true);
  cuerpoCentral(p, CENTRO.x, CENTRO.w, base);
  gradas(p, TORRE_ORIENTE.x - 8, TORRE_PONIENTE.x + TORRE_PONIENTE.w - TORRE_ORIENTE.x + 16, base);
  p.ctx.setTransform(1, 0, 0, 1, 0, 0);
  return { canvas: p.canvas, ox: 0, oy: 0 };
}

// ─── Piedra ───────────────────────────────────────────────────────────────

/**
 * Muro de sillares de cantera: hiladas de `bh` px con juntas claras, cada
 * sillar con su tono, manchas de intemperie y la luz de la mañana (izquierda).
 */
function sillares(
  p: Painter,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
  s: Piedra = C,
  bw = 16,
  bh = 7,
): void {
  for (let yy = 0; yy < h; yy++) {
    const course = Math.floor(yy / bh);
    const offset = (course % 2) * Math.round(bw / 2);
    for (let xx = 0; xx < w; xx++) {
      const gx = x + xx;
      const gy = y + yy;
      const block = Math.floor((xx + offset) / bw);
      if (yy % bh === bh - 1 || (xx + offset) % bw === bw - 1) {
        p.px(gx, gy, s.joint);
        continue;
      }
      const tone = hash(block, course, seed);
      let c = tone < 0.18 ? s.shade : tone > 0.84 ? s.light : s.base;
      const stain = hash(Math.floor(gx / 3), Math.floor(gy / 9), seed + 3);
      if (stain > 0.94) c = hundido(c, 0.1);
      if (yy % bh === 0 && tone > 0.4) c = s.light;
      const speck = hash(gx, gy, seed + 7);
      if (speck < 0.03) c = s.shade;
      else if (speck > 0.985) c = s.lighter;
      p.px(gx, gy, c);
    }
  }
  p.rect(x, y, 1, h, s.lighter);
  p.rect(x + w - 1, y, 1, h, s.deep);
}

/** Cornisa: una moldura que sale, con su luz arriba y la sombra que deja. */
function cornisa(p: Painter, x: number, y: number, w: number, salida = 3, s: Piedra = C): void {
  p.rect(x - salida, y, w + salida * 2, 1, s.lighter);
  p.rect(x - salida, y + 1, w + salida * 2, 2, s.light);
  p.rect(x - salida + 1, y + 3, w + salida * 2 - 2, 1, s.base);
  p.rect(x - salida, y + 4, w + salida * 2, 1, s.deep);
  p.rect(x, y + 5, w, 2, 'rgb(58 34 48 / 0.3)');
}

/** Perillón: el remate de jarrón o piña que corona pilastras y esquinas. */
function perillon(p: Painter, cx: number, y: number, s: Piedra = C, grande = false): void {
  if (grande) {
    p.rect(cx - 4, y + 11, 9, 3, s.base);
    p.rect(cx - 3, y + 6, 7, 5, s.light);
    p.px(cx - 3, y + 6, s.lighter);
    p.rect(cx + 2, y + 7, 2, 4, s.shade);
    p.rect(cx - 2, y + 3, 5, 3, s.base);
    p.rect(cx - 1, y + 1, 3, 2, s.light);
    p.px(cx, y, s.lighter);
    return;
  }
  p.rect(cx - 2, y + 6, 5, 2, s.base);
  p.rect(cx - 1, y + 3, 3, 3, s.light);
  p.px(cx - 1, y + 3, s.lighter);
  p.rect(cx - 1, y + 1, 3, 2, s.base);
  p.px(cx, y, s.light);
  p.px(cx + 1, y + 4, s.shade);
}

/** Pináculo de trompo (los de la linternilla de las torres). */
function trompo(p: Painter, cx: number, y: number, s: Piedra): void {
  p.rect(cx - 2, y + 8, 5, 3, s.shade);
  p.rect(cx - 2, y + 5, 5, 3, s.base);
  p.px(cx - 2, y + 5, s.light);
  p.rect(cx - 1, y + 2, 3, 3, s.light);
  p.px(cx, y, s.lighter);
  p.px(cx, y + 1, s.light);
}

/** Balaustrada: pasamanos, balaustres y su zoclo. */
function balaustrada(p: Painter, x: number, y: number, w: number, s: Piedra = C): void {
  p.rect(x, y, w, 1, s.lighter);
  p.rect(x, y + 1, w, 1, s.base);
  for (let xx = x + 1; xx < x + w - 1; xx += 3) {
    p.rect(xx, y + 2, 2, 5, s.light);
    p.px(xx + 1, y + 4, s.shade);
  }
  p.rect(x, y + 7, w, 2, s.shade);
  p.rect(x, y + 9, w, 1, s.deep);
}

/** Vano de medio punto relleno de `fill`. */
function arco(p: Painter, cx: number, bottom: number, w: number, h: number, fill: string): void {
  const r = w / 2;
  const x0 = Math.round(cx - r);
  for (let yy = 0; yy < h; yy++) {
    const y = bottom - h + yy;
    if (yy < r) {
      const dy = r - yy - 0.5;
      const half = Math.sqrt(Math.max(0, r * r - dy * dy));
      p.rect(Math.round(cx - half), y, Math.round(half * 2), 1, fill);
    } else {
      p.rect(x0, y, w, 1, fill);
    }
  }
}

/** Marco de cantera alrededor de un vano (se pinta antes que el vano). */
function marco(p: Painter, cx: number, bottom: number, w: number, h: number, s: Piedra = C): void {
  arco(p, cx, bottom, w + 6, h + 3, s.lighter);
  arco(p, cx + 1, bottom, w + 5, h + 2, s.shade);
  arco(p, cx, bottom, w + 2, h + 1, s.deep);
}

/** Pilastra tablerada: el fuste con tableros rehundidos, la basa y el capitel. */
function pilastra(p: Painter, x: number, y: number, w: number, h: number, s: Piedra): void {
  p.rect(x, y, w, h, s.base);
  p.rect(x, y, 1, h, s.lighter);
  p.rect(x + w - 1, y, 1, h, s.deep);
  p.rect(x - 1, y, w + 2, 3, s.light);
  p.rect(x - 1, y + 3, w + 2, 1, s.deep);
  p.rect(x - 1, y + h - 4, w + 2, 4, s.shade);
  p.rect(x - 1, y + h - 4, w + 2, 1, s.light);
  // Tableros: rectángulos rehundidos, uno encima de otro.
  const n = Math.max(1, Math.floor((h - 12) / 22));
  const th = Math.floor((h - 12) / n) - 4;
  for (let i = 0; i < n; i++) {
    const ty = y + 6 + i * (th + 4);
    p.rect(x + 2, ty, w - 4, th, s.shade);
    p.rect(x + 2, ty, w - 4, 1, s.deep);
    p.rect(x + 2, ty + th - 1, w - 4, 1, s.light);
    p.rect(x + w - 3, ty + 1, 1, th - 2, s.light);
  }
}

// ─── Torres ───────────────────────────────────────────────────────────────

/**
 * Una torre, de abajo arriba: el fuste de sillar liso con sus ventanitas
 * (≈43 %), la cornisa volada con su balaustrada, el primer cuerpo cuadrado
 * (≈28 %) con el reloj en su marco de sol, el gran vano de la campana con su
 * balcón y los nichos con santos, el segundo cuerpo ochavado (≈14 %), la
 * linternilla con pináculos de trompo y el cupulín de gajos (≈10 %) y la cruz
 * con su aro de hierro. `alta` es la piedra de los cuerpos altos.
 */
function torre(
  p: Painter,
  x: number,
  w: number,
  base: number,
  alta: Piedra,
  poniente: boolean,
): void {
  const cx = x + Math.round(w / 2);
  const seed = poniente ? 300 : 310;
  // Fuste.
  const fusteTop = base - FUSTE;
  sillares(p, x, fusteTop, w, FUSTE, seed, C, 18, 8);
  // Zócalo.
  p.rect(x - 2, base - 14, w + 4, 14, C.shade);
  p.rect(x - 2, base - 14, w + 4, 1, C.lighter);
  p.rect(x - 2, base - 1, w + 4, 1, C.deep);
  // Las ventanitas cuadradas apiladas y una rendija.
  for (const vy of [base - 70, base - 130, base - 190]) {
    p.rect(cx - 5, vy - 1, 10, 12, C.lighter);
    p.rect(cx - 4, vy, 8, 10, OSCURO);
    p.px(cx - 3, vy + 1, VIDRIO.light);
  }
  p.rect(cx - 1, base - 236, 2, 10, OSCURO);
  // Relojes en la cara lateral: se asoman en el canto de la torre.
  cornisa(p, x, fusteTop - 6, w, 6);
  balaustrada(p, x - 4, fusteTop - 16, w + 8);
  for (const px of [x - 2, x + w + 1]) perillon(p, px, fusteTop - 30, C, true);

  // Primer cuerpo (cuadrado, un poco más angosto).
  const c1x = x + 10;
  const c1w = w - 20;
  const c1Alto = PRIMER_CUERPO;
  const c1Top = fusteTop - BALAUSTRADA - c1Alto;
  sillares(p, c1x, c1Top, c1w, c1Alto, seed + 1, alta, 14, 7);
  pilastra(p, c1x, c1Top, 12, c1Alto, alta);
  pilastra(p, c1x + c1w - 12, c1Top, 12, c1Alto, alta);
  // El reloj en su marco de sol de piedra, abajo del vano.
  reloj(p, cx, c1Top + c1Alto - 34, 13, alta);
  // El gran vano de la campana con su balcón de balaustres.
  campanario(p, cx, c1Top + c1Alto - VANO.sobre, VANO.w, VANO.h, alta);
  // Nichos con santos a los lados del vano.
  for (const nx of [c1x + 26, c1x + c1w - 26]) {
    nicho(p, nx, c1Top + 66, 12, 26, alta);
    nicho(p, nx, c1Top + c1Alto - 52, 12, 26, alta);
  }
  cornisa(p, c1x, c1Top - 6, c1w, 5, alta);
  for (const px of [c1x + 2, c1x + c1w - 3]) perillon(p, px, c1Top - 20, alta, true);

  // Segundo cuerpo (ochavado): las caras en diagonal más oscuras.
  const c2w = Math.round(c1w * 0.8);
  const c2x = cx - Math.round(c2w / 2);
  const c2Alto = 84;
  const c2Top = c1Top - 6 - c2Alto;
  sillares(p, c2x, c2Top, c2w, c2Alto, seed + 2, alta, 12, 6);
  const ochavo = Math.round(c2w * 0.2);
  p.rect(c2x, c2Top, ochavo, c2Alto, 'rgb(58 34 48 / 0.18)');
  p.rect(c2x + c2w - ochavo, c2Top, ochavo, c2Alto, 'rgb(58 34 48 / 0.3)');
  for (const px of [c2x + ochavo, c2x + c2w - ochavo]) {
    p.rect(px - 2, c2Top, 4, c2Alto, alta.light);
    p.rect(px + 1, c2Top, 1, c2Alto, alta.deep);
  }
  // Vano con balconcito y un medallón papal arriba.
  campanario(p, cx, c2Top + c2Alto - 12, 22, 48, alta);
  medallon(p, cx, c2Top + 12, 7, 6);
  for (const vx of [c2x + ochavo / 2, c2x + c2w - ochavo / 2]) {
    arco(p, vx, c2Top + c2Alto - 18, 6, 26, OSCURO);
  }
  // Pináculos alrededor de su arranque.
  for (const px of [c2x - 8, c2x + c2w + 7]) trompo(p, px, c1Top - 16, alta);
  cornisa(p, c2x, c2Top - 5, c2w, 4, alta);

  // Linternilla ochavada con sus vanos rectangulares y pináculos de trompo.
  const c3w = Math.round(c2w * 0.6);
  const c3x = cx - Math.round(c3w / 2);
  const c3Alto = 34;
  const c3Top = c2Top - 5 - c3Alto;
  sillares(p, c3x, c3Top, c3w, c3Alto, seed + 3, alta, 10, 6);
  p.rect(c3x, c3Top, 5, c3Alto, 'rgb(58 34 48 / 0.18)');
  p.rect(c3x + c3w - 5, c3Top, 5, c3Alto, 'rgb(58 34 48 / 0.3)');
  for (const vx of [cx - 9, cx, cx + 9]) {
    p.rect(vx - 2, c3Top + 9, 5, 16, alta.lighter);
    p.rect(vx - 1, c3Top + 10, 3, 14, OSCURO);
  }
  for (const px of [c3x - 5, c3x + 4, c3x + c3w - 5, c3x + c3w + 4])
    trompo(p, px, c2Top - 16, alta);
  cornisa(p, c3x, c3Top - 4, c3w, 3, alta);

  // Cupulín de ocho gajos, el jarrón y la cruz con su aro de hierro.
  const cupAlto = 22;
  const cupTop = c3Top - 4 - cupAlto;
  const rr = Math.round(c3w / 2) - 2;
  for (let yy = 0; yy < cupAlto; yy++) {
    const t = yy / cupAlto;
    const half = Math.round(rr * Math.sqrt(Math.max(0, 1 - (1 - t) ** 2)));
    for (let xx = -half; xx < half; xx++) {
      const u = (xx + half) / Math.max(1, half * 2);
      let c = u < 0.3 ? alta.light : u > 0.72 ? alta.shade : alta.base;
      const gajo = Math.round((xx / Math.max(1, half)) * 3);
      if (Math.abs(xx - Math.round((gajo / 3) * half)) < 1 && yy > 2) c = alta.deep;
      p.px(cx + xx, cupTop + yy, c);
    }
  }
  p.rect(cx - 5, cupTop - 4, 10, 4, alta.base);
  p.rect(cx - 5, cupTop - 4, 10, 1, alta.lighter);
  p.ellipse(cx, cupTop - 8, 4, 4, alta.light);
  p.px(cx - 2, cupTop - 10, alta.lighter);
  // Aro de hierro con brazos rizados y la cruz.
  const aroY = cupTop - 16;
  p.rect(cx - 6, aroY + 4, 13, 1, HERRERIA.base);
  for (const bx of [-6, -3, 3, 6]) {
    p.px(cx + bx, aroY + 3, HERRERIA.base);
    p.px(cx + bx + Math.sign(bx), aroY + 2, HERRERIA.base);
  }
  cruz(p, cx, aroY - 16, poniente);
}

/** Carátula del reloj: blanca con números oscuros, dentro de un sol de piedra. */
function reloj(p: Painter, cx: number, cy: number, r: number, s: Piedra): void {
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const l = i % 2 === 0 ? r + 7 : r + 4;
    for (let t = r; t < l; t++) {
      p.px(
        Math.round(cx + Math.cos(a) * t),
        Math.round(cy + Math.sin(a) * t),
        i % 2 ? s.light : s.lighter,
      );
    }
  }
  p.ellipse(cx, cy, r + 2, r + 2, s.deep);
  p.ellipse(cx, cy, r + 1, r + 1, s.lighter);
  p.ellipse(cx, cy, r, r, '#f4efe6');
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    p.px(
      Math.round(cx + Math.cos(a) * (r - 2)),
      Math.round(cy + Math.sin(a) * (r - 2)),
      HERRERIA.base,
    );
  }
  // Las diez y diez.
  p.rect(cx, cy - r + 4, 1, r - 4, HERRERIA.base);
  p.rect(cx - 6, cy - 3, 6, 1, HERRERIA.base);
  p.rect(cx + 1, cy - 2, 5, 1, HERRERIA.base);
  p.px(cx, cy, BRONCE.light);
}

/** Vano del campanario con su campana de bronce, el yugo y el balcón de balaustres. */
function campanario(p: Painter, cx: number, bottom: number, w: number, h: number, s: Piedra): void {
  marco(p, cx, bottom, w, h, s);
  arco(p, cx, bottom, w, h, OSCURO);
  // Campana.
  pintarCampana(p, cx, bottom - h + Math.round(w / 2) + 4, Math.max(6, Math.round(w * 0.36)));
  // Balcón de balaustres al pie del vano.
  const bw = w + 8;
  balaustrada(p, cx - bw / 2, bottom - 9, bw, s);
}

/** Nicho con su santo blanco y la repisa. */
function nicho(p: Painter, cx: number, bottom: number, w: number, h: number, s: Piedra): void {
  marco(p, cx, bottom, w, h, s);
  arco(p, cx, bottom, w, h, s.deep);
  santo(p, cx, bottom - 2, h - 6);
  p.rect(cx - w / 2 - 3, bottom, w + 6, 2, s.lighter);
  p.rect(cx - w / 2 - 2, bottom + 2, w + 4, 1, s.deep);
}

/** Un santo blanquecino de pie: cabeza, túnica y la mano con su atributo. */
function santo(p: Painter, cx: number, pie: number, h: number): void {
  const cabeza = pie - h;
  p.rect(cx - 1, cabeza, 3, 3, BLANCO.light);
  p.rect(cx - 2, cabeza + 3, 5, h - 3, BLANCO.base);
  p.rect(cx + 2, cabeza + 3, 1, h - 3, BLANCO.shade);
  p.rect(cx - 3, pie - 2, 7, 2, BLANCO.shade);
  p.px(cx - 3, cabeza + 6, BLANCO.base);
}

/** Medallón papal: el óvalo blanco con la tiara y las llaves. */
function medallon(p: Painter, cx: number, cy: number, rx: number, ry: number): void {
  p.ellipse(cx, cy, rx + 1, ry + 1, BLANCO.deep);
  p.ellipse(cx, cy, rx, ry, BLANCO.base);
  p.rect(cx - 2, cy - 3, 5, 3, BLANCO.shade);
  p.px(cx, cy - 4, BLANCO.shade);
  p.px(cx - 3, cy + 1, BLANCO.deep);
  p.px(cx - 2, cy + 2, BLANCO.deep);
  p.px(cx + 3, cy + 1, BLANCO.deep);
  p.px(cx + 2, cy + 2, BLANCO.deep);
}

function oculo(p: Painter, cx: number, cy: number, r: number, s: Piedra): void {
  p.ellipse(cx, cy, r + 2, r + 2, s.lighter);
  p.ellipse(cx, cy, r + 1, r + 1, s.deep);
  p.ellipse(cx, cy, r, r, '#231a24');
  p.px(cx - 2, cy - 2, VIDRIO.dark);
}

function cruz(p: Painter, cx: number, y: number, veleta: boolean): void {
  p.rect(cx, y, 1, 16, HERRERIA.base);
  p.rect(cx - 4, y + 4, 9, 1, HERRERIA.base);
  p.px(cx - 4, y + 3, HERRERIA.base);
  p.px(cx + 4, y + 3, HERRERIA.base);
  p.px(cx, y - 1, HERRERIA.base);
  if (veleta) {
    p.rect(cx + 1, y + 9, 5, 1, HERRERIA.light);
    p.px(cx + 6, y + 8, HERRERIA.light);
  }
  p.px(cx, y, HERRERIA.light);
}

// ─── Cuerpo central ───────────────────────────────────────────────────────

/**
 * La portada de barroco tablerado: tres calles separadas por pilastras de
 * tableros y tres cuerpos separados por cornisas. En la calle de en medio, la
 * puerta mayor, el gran relieve de la Transfiguración con santos en nichos a
 * los lados, la ventana oval con su busto y el tablero blanco del remate bajo
 * su frontón con el perillón y el mástil; en las calles de los lados, la
 * puerta menor, el relieve de escena, el óculo negro, el medallón papal y los
 * frontones curvos con jarrones.
 */
function cuerpoCentral(p: Painter, x: number, w: number, base: number): void {
  const cx = x + Math.round(w / 2);
  const s = MALVA;
  const primero = 104;
  const segundo = 86;
  const top1 = base - 12 - primero;
  const top2 = top1 - 6 - segundo;
  const remate = CENTRO_ALTO - 12 - primero - 6 - segundo - 6;
  const top3 = top2 - 6 - remate;
  const calle = Math.round(w * 0.27);
  const izq = x + calle;
  const der = x + w - calle;

  // Primer cuerpo.
  sillares(p, x, top1, w, primero + 12, 321, s, 12, 6);
  puerta(p, cx, base - 12, 50, 86, s);
  puerta(p, x + Math.round(calle / 2), base - 12, 32, 60, s);
  puerta(p, x + w - Math.round(calle / 2), base - 12, 32, 60, s);
  // Relieves de escenas sobre las puertas menores.
  for (const rx of [x + Math.round(calle / 2), x + w - Math.round(calle / 2)]) {
    relieve(p, rx, top1 + 6, 30, 26, 2);
  }
  for (const px of [x + 2, izq - 7, der - 7, x + w - 14]) pilastra(p, px, top1, 12, primero, s);
  cornisa(p, x, top1 - 6, w, 4, s);

  // Segundo cuerpo: el gran relieve con santos en nichos; óculos y medallones a los lados.
  sillares(p, x + 4, top2, w - 8, segundo, 322, s, 12, 6);
  relieve(p, cx, top2 + 14, 50, 48, 3);
  for (const nx of [cx - 36, cx + 36]) nicho(p, nx, top2 + segundo - 10, 12, 30, s);
  for (const lx of [x + Math.round(calle / 2), x + w - Math.round(calle / 2)]) {
    oculo(p, lx, top2 + 58, 11, s);
    medallon(p, lx, top2 + 24, 10, 12);
  }
  for (const px of [x + 6, izq - 6, der - 6, x + w - 16]) pilastra(p, px, top2, 10, segundo, s);
  cornisa(p, x + 4, top2 - 6, w - 8, 3, s);

  // Remate: la ventana oval con su busto, el tablero blanco con medallón y los frontones.
  const rw = Math.round(w * 0.5);
  sillares(p, cx - rw / 2, top3, rw, remate, 323, s, 12, 6);
  p.ellipse(cx, top3 + remate - 16, 14, 10, s.lighter);
  p.ellipse(cx, top3 + remate - 16, 12, 8, s.deep);
  p.ellipse(cx, top3 + remate - 16, 10, 6, '#2a2130');
  santo(p, cx, top3 + remate - 12, 8);
  // Tablero blanco del remate con su medallón.
  p.rect(cx - 13, top3 + 2, 26, 20, BLANCO.shade);
  p.rect(cx - 12, top3 + 3, 24, 18, BLANCO.base);
  medallon(p, cx, top3 + 12, 7, 7);
  // Frontón curvo con el perillón grande y el mástil detrás.
  p.rect(cx, top3 - 40, 1, 36, '#6c6a70');
  for (let i = 0; i <= 20; i++) {
    const a = Math.PI + (i / 20) * Math.PI;
    p.rect(
      Math.round(cx + Math.cos(a) * 16),
      Math.round(top3 + 1 + Math.sin(a) * 9),
      2,
      2,
      s.light,
    );
  }
  perillon(p, cx, top3 - 22, s, true);
  // Las calles de los lados rematan con frontones curvos y jarrones.
  for (const fx of [x + Math.round(calle / 2) + 8, x + w - Math.round(calle / 2) - 8]) {
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI + (i / 12) * Math.PI;
      p.rect(
        Math.round(fx + Math.cos(a) * 12),
        Math.round(top2 - 4 + Math.sin(a) * 7),
        2,
        2,
        s.light,
      );
    }
    perillon(p, fx, top2 - 22, s, true);
  }
  for (const px of [x + 6, x + w - 7, cx - rw / 2 - 2, cx + rw / 2 + 1])
    perillon(p, px, top2 - 16, s);
  for (const px of [cx - rw / 2 + 4, cx + rw / 2 - 5]) perillon(p, px, top3 - 14, s, true);
  cornisa(p, cx - rw / 2, top3 - 3, rw, 2, s);
}

/** Puerta de madera tallada en su arco de cantera, con tableros y clavos dorados. */
function puerta(p: Painter, cx: number, bottom: number, w: number, h: number, s: Piedra): void {
  marco(p, cx, bottom, w, h, s);
  arco(p, cx, bottom, w, h, MADERA.base);
  const top = bottom - h + w / 2;
  for (let yy = top + 3; yy < bottom - 6; yy += 12) {
    p.rect(cx - w / 2 + 4, yy, w - 8, 1, MADERA.light);
    p.rect(cx - w / 2 + 4, yy + 8, w - 8, 1, MADERA.deep);
    for (let xx = cx - w / 2 + 6; xx < cx + w / 2 - 5; xx += 6) p.px(xx, yy + 4, BRONCE.light);
  }
  p.rect(cx, top - 2, 1, h - w / 2 + 2, MADERA.deep);
  // Tímpano con su abanico tallado.
  const r = w / 2 - 3;
  for (let a = 0; a <= 10; a++) {
    const ang = Math.PI + (a / 10) * Math.PI;
    for (let t = 3; t < r; t += 2) {
      p.px(Math.round(cx + Math.cos(ang) * t), Math.round(top + Math.sin(ang) * t), MADERA.shade);
    }
  }
}

/** Relieve de escena: un tablero blanquecino con figuras en bajorrelieve. */
function relieve(p: Painter, cx: number, y: number, w: number, h: number, figuras: number): void {
  const x = Math.round(cx - w / 2);
  p.rect(x - 2, y - 2, w + 4, h + 4, BLANCO.deep);
  p.rect(x - 1, y - 1, w + 2, h + 2, BLANCO.light);
  p.rect(x, y, w, h, BLANCO.base);
  const paso = w / (figuras + 1);
  for (let i = 1; i <= figuras; i++) {
    const fx = Math.round(x + paso * i);
    const alto = i === Math.ceil(figuras / 2) ? h - 8 : h - 14;
    const fy = y + h - 3 - alto;
    p.rect(fx - 1, fy, 3, 3, BLANCO.light);
    p.rect(fx - 2, fy + 3, 5, alto - 3, BLANCO.shade);
    p.rect(fx - 2, fy + 3, 1, alto - 3, BLANCO.light);
  }
  // La nube de abajo.
  for (let xx = 2; xx < w - 2; xx += 5) p.ellipse(x + xx + 2, y + h - 3, 3, 2, BLANCO.light);
}

/** Gradas del atrio al pie de toda la fachada. */
function gradas(p: Painter, x: number, w: number, base: number): void {
  for (let i = 0; i < 3; i++) {
    const y = base - 12 + i * 4;
    p.rect(x - i * 3, y, w + i * 6, 4, i === 0 ? C.light : C.base);
    p.rect(x - i * 3, y, w + i * 6, 1, C.lighter);
  }
  p.rect(x - 9, base - 1, w + 18, 1, C.deep);
}

// ─── Techos y cúpulas (desde arriba) ──────────────────────────────────────

/**
 * Tres naves de bóvedas vistas desde arriba: la de en medio más ancha y alta,
 * cada tramo con su lomo rojo (luz a la izquierda) y la nervadura clara, y
 * los pretiles de balaustrada con perillones en las orillas.
 */
function naves(p: Painter, x: number, y: number, w: number, h: number, seed: number): void {
  const lateral = Math.round(w * 0.27);
  bovedas(p, x, y, lateral, h, 26, seed);
  bovedas(p, x + w - lateral, y, lateral, h, 26, seed + 1);
  bovedas(p, x + lateral, y, w - lateral * 2, h, 34, seed + 2);
  // La nave central va más alta: su pretil da sombra sobre las de los lados.
  for (const px of [x + lateral, x + w - lateral]) {
    p.rect(px - 3, y, 6, h, C.base);
    p.rect(px - 3, y, 1, h, C.lighter);
    p.rect(px + 2, y, 1, h, C.deep);
    p.rect(px + 3, y, 3, h, 'rgb(58 34 48 / 0.18)');
    for (let yy = y + 6; yy < y + h - 6; yy += 22) perillon(p, px, yy - 8);
  }
  for (const px of [x, x + w - 6]) {
    p.rect(px, y, 6, h, C.base);
    p.rect(px, y, 1, h, C.lighter);
    p.rect(px + 5, y, 1, h, C.deep);
    for (let yy = y + 10; yy < y + h - 6; yy += 22) perillon(p, px + 3, yy - 8);
  }
}

function bovedas(
  p: Painter,
  x: number,
  y: number,
  w: number,
  h: number,
  tramo: number,
  seed: number,
): void {
  for (let yy = 0; yy < h; yy++) {
    const bay = yy % tramo;
    for (let xx = 0; xx < w; xx++) {
      const u = xx / w;
      let c = u < 0.3 ? TECHO.light : u > 0.72 ? TECHO.shade : TECHO.base;
      if (bay === 0 || bay === 1) c = TECHO.rib;
      else if (bay === 2) c = TECHO.ribShade;
      else if (bay > tramo - 4) c = hundido(c, 0.08);
      const speck = hash(x + xx, y + yy, seed);
      if (speck < 0.04) c = hundido(c, 0.1);
      else if (speck > 0.985) c = hundido(c, -0.08);
      p.px(x + xx, y + yy, c);
    }
  }
}

/** El crucero: los brazos del transepto de orilla a orilla, con bóvedas atravesadas. */
function crucero(p: Painter, x: number, y: number, w: number, h: number): void {
  for (let yy = 0; yy < h; yy++) {
    const v = yy / h;
    for (let xx = 0; xx < w; xx++) {
      const col = xx % 32;
      let c = v < 0.3 ? TECHO.light : v > 0.72 ? TECHO.shade : TECHO.base;
      if (col === 0 || col === 1) c = TECHO.rib;
      else if (col === 2) c = TECHO.ribShade;
      if (hash(x + xx, y + yy, 361) < 0.04) c = hundido(c, 0.1);
      p.px(x + xx, y + yy, c);
    }
  }
  // Pretiles con balaustrada arriba y abajo, y las puntas de las portadas laterales.
  balaustrada(p, x, y - 4, w);
  balaustrada(p, x, y + h - 6, w);
  for (let xx = x + 8; xx < x + w; xx += 40) {
    perillon(p, xx, y - 14);
    perillon(p, xx, y + h - 16);
  }
  for (const ex of [x, x + w - 10]) {
    p.rect(ex, y - 6, 10, h + 8, C.base);
    p.rect(ex, y - 6, 10, 2, C.lighter);
    p.rect(ex + (ex === x ? 0 : 9), y - 6, 1, h + 8, ex === x ? C.lighter : C.deep);
    perillon(p, ex + 5, y - 18, C, true);
  }
}

/**
 * La cabecera: el presbiterio con sus bóvedas y, al fondo, el ábside redondo
 * con sus gajos rojos, su pretil de balaustrada y perillones alrededor.
 */
function abside(p: Painter, x: number, y: number, w: number, h: number): void {
  const r = Math.round(w * 0.34);
  const cx = x + w / 2;
  const cy = y + r;
  // Presbiterio: bóvedas como las de la nave, del ábside al crucero.
  bovedas(p, x, cy, w, y + h - cy, 30, 371);
  for (const px of [x, x + w - 6]) {
    p.rect(px, cy, 6, y + h - cy, C.base);
    p.rect(px, cy, 1, y + h - cy, C.lighter);
    p.rect(px + 5, cy, 1, y + h - cy, C.deep);
  }
  // El ábside: medio círculo de gajos con la luz a la izquierda.
  for (let yy = y; yy < cy; yy++) {
    for (let xx = Math.round(cx - r); xx < cx + r; xx++) {
      const dx = xx - cx;
      const dy = yy - cy;
      if (dx * dx + dy * dy > r * r) continue;
      const ang = Math.atan2(dy, dx);
      const gajo = ((ang + Math.PI) / Math.PI) * 6;
      const d = Math.hypot(dx, dy);
      let c = dx < -r * 0.3 ? TECHO.light : dx > r * 0.4 ? TECHO.shade : TECHO.base;
      // Nervaduras de un pixel de ancho (no se engordan hacia la orilla).
      const aNervio = (Math.abs(gajo - Math.round(gajo)) * Math.PI * d) / 6;
      if (aNervio < 0.9 && d > 8) c = TECHO.rib;
      else if (d > r - 3) c = hundido(c, 0.12);
      if (hash(xx, yy, 372) < 0.04) c = hundido(c, 0.1);
      p.px(xx, yy, c);
    }
  }
  // Pretil alrededor del ábside, con perillones.
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI + (i / 24) * Math.PI;
    const px = Math.round(cx + Math.cos(a) * r);
    const py = Math.round(cy + Math.sin(a) * r);
    p.rect(px - 1, py - 1, 3, 3, C.light);
    if (i % 4 === 0) perillon(p, px, py - 9);
  }
  p.ellipse(cx, cy - 2, 7, 5, C.base);
  p.ellipse(cx - 1, cy - 3, 3, 2, C.lighter);
  balaustrada(p, x, y + h - 4, w);
}

/**
 * La cúpula del crucero: el tambor ochavado de cantera con sus ventanas y
 * pilastras con jarrones, la media naranja de ocho gajos con azulejo en
 * rombos azul cobalto y blanco separados por nervios de cantera, la
 * linternilla con su cupulín de azulejo y la cruz de hierro con volutas.
 */
function cupula(p: Painter, cx: number, base: number): void {
  // Tambor.
  const tw = 170;
  const th = 58;
  sillares(p, cx - tw / 2, base - th, tw, th, 341, C, 12, 6);
  for (const dx of [-60, -30, 0, 30, 60]) {
    p.rect(cx + dx - 6, base - th + 10, 12, 30, C.lighter);
    arco(p, cx + dx, base - th + 40, 10, 28, VIDRIO.dark);
    p.px(cx + dx - 2, base - th + 18, VIDRIO.light);
  }
  for (const dx of [-45, -15, 15, 45]) {
    p.rect(cx + dx - 3, base - th, 6, th, C.base);
    p.rect(cx + dx - 3, base - th, 1, th, C.lighter);
    p.rect(cx + dx + 2, base - th, 1, th, C.deep);
  }
  p.rect(cx - tw / 2, base - th, 16, th, 'rgb(58 34 48 / 0.12)');
  p.rect(cx + tw / 2 - 22, base - th, 22, th, 'rgb(58 34 48 / 0.28)');
  cornisa(p, cx - tw / 2, base - th - 5, tw, 5);
  for (const dx of [-tw / 2 - 2, -45, -15, 15, 45, tw / 2 + 1])
    perillon(p, cx + dx, base - th - 20, C, true);
  // Media naranja de azulejo en rombos.
  const rx = 76;
  const ry = 84;
  const dBase = base - th - 5;
  for (let yy = 0; yy < ry; yy++) {
    const t = (ry - yy) / ry;
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - t * t)));
    for (let xx = -half; xx < half; xx++) {
      // Rombos: un damero girado 45°, que se achica hacia los lados de la esfera.
      const u = xx / Math.max(1, half);
      const lat = Math.asin(Math.max(-1, Math.min(1, u)));
      const blanco = rombo(((lat + Math.PI / 2) / Math.PI) * 30, yy / 4.6);
      const luz = (xx + half) / Math.max(1, half * 2);
      let c = blanco ? AZULEJO.white : AZULEJO.blue;
      if (luz > 0.7) c = blanco ? AZULEJO.whiteShade : AZULEJO.blueDeep;
      else if (luz < 0.22 && yy < ry * 0.75) c = blanco ? '#ffffff' : AZULEJO.blueLight;
      // Nervios de cantera: ocho gajos (se ven cinco de frente).
      for (let g = -2; g <= 2; g++) {
        const nx = Math.round(Math.sin((g / 4) * (Math.PI / 2) * 1.6) * half);
        if (Math.abs(xx - nx) < 2) c = Math.abs(xx - nx) < 1 ? C.light : C.shade;
      }
      p.px(cx + xx, dBase - ry + yy, c);
    }
  }
  // Perillones en el arranque de los nervios.
  for (let g = -2; g <= 2; g++) {
    const nx = Math.round(Math.sin((g / 4) * (Math.PI / 2) * 1.6) * rx);
    perillon(p, cx + nx, dBase - 12);
  }
  // Linternilla con sus ventanitas en arco, cupulín de azulejo y cruz de volutas.
  const lt = dBase - ry - 34;
  sillares(p, cx - 16, lt, 32, 34, 342, C, 10, 6);
  for (const dx of [-8, 0, 8]) arco(p, cx + dx, lt + 26, 5, 16, VIDRIO.dark);
  p.rect(cx + 10, lt, 6, 34, 'rgb(58 34 48 / 0.25)');
  cornisa(p, cx - 16, lt - 4, 32, 3);
  for (let yy = 0; yy < 14; yy++) {
    const half = Math.round(17 * Math.sqrt(Math.max(0, 1 - ((14 - yy) / 14) ** 2)));
    for (let xx = -half; xx < half; xx++) {
      const blanco = (Math.floor((xx + 40) / 3) + Math.floor(yy / 3)) % 2 === 0;
      p.px(cx + xx, lt - 4 - 14 + yy, blanco ? AZULEJO.white : AZULEJO.blue);
    }
  }
  for (const dx of [-15, -8, 8, 15]) perillon(p, cx + dx, lt - 14);
  cruz(p, cx, lt - 38, false);
  for (const s of [-1, 1]) {
    p.px(cx + s * 3, lt - 32, HERRERIA.base);
    p.px(cx + s * 4, lt - 33, HERRERIA.base);
  }
}

/** ¿Blanco o azul? Rombos de un damero girado 45° (u a lo ancho, v a lo alto, en rombos). */
function rombo(u: number, v: number): boolean {
  return (Math.floor(u + v) + Math.floor(u - v)) % 2 === 0;
}

/**
 * Cúpula menor de azulejo sobre su tambor. `santo`: la de la sacristía, que en
 * vez de linternilla lleva un santo con su cruz encima.
 */
function cupulaChica(p: Painter, cx: number, base: number, r: number, conSanto: boolean): void {
  sillares(p, cx - r - 4, base - 22, r * 2 + 8, 22, 351, C, 10, 6);
  for (const dx of [-r + 6, 0, r - 6]) arco(p, cx + dx, base - 4, 6, 14, VIDRIO.dark);
  cornisa(p, cx - r - 4, base - 26, r * 2 + 8, 3);
  const dBase = base - 26;
  for (let yy = 0; yy < r; yy++) {
    const t = (r - yy) / r;
    const half = Math.round(r * Math.sqrt(Math.max(0, 1 - t * t)));
    for (let xx = -half; xx < half; xx++) {
      const u0 = xx / Math.max(1, half);
      const blanco = rombo(
        ((Math.asin(Math.max(-1, Math.min(1, u0))) + Math.PI / 2) / Math.PI) * 18,
        yy / 2.6,
      );
      const u = (xx + half) / Math.max(1, half * 2);
      let c = blanco ? AZULEJO.white : AZULEJO.blue;
      if (u > 0.7) c = blanco ? AZULEJO.whiteShade : AZULEJO.blueDeep;
      p.px(cx + xx, dBase - r + yy, c);
    }
  }
  if (conSanto) {
    santo(p, cx, dBase - r + 2, 16);
    p.rect(cx + 2, dBase - r - 18, 1, 9, BLANCO.shade);
    p.rect(cx + 1, dBase - r - 15, 3, 1, BLANCO.shade);
  } else {
    p.rect(cx - 2, dBase - r - 6, 4, 6, C.base);
    cruz(p, cx, dBase - r - 20, false);
  }
}

/** Capillas a los lados de las naves: su techo plano y una linternita cada una. */
function capillas(p: Painter): void {
  for (const [x, y] of [
    [96, 590],
    [96, 680],
    [560, 590],
    [560, 250],
    [96, 250],
    [560, 680],
  ] as const) {
    p.rect(x - 14, y - 16, 28, 26, TECHO.shade);
    p.rect(x - 14, y - 16, 28, 2, TECHO.rib);
    p.rect(x - 5, y - 14, 10, 12, C.base);
    p.rect(x - 5, y - 14, 10, 1, C.lighter);
    p.ellipse(x, y - 16, 5, 4, AZULEJO.blue);
    p.ellipse(x - 1, y - 17, 2, 2, AZULEJO.white);
  }
}

/**
 * El anexo del costado oriente, junto a la torre: dos niveles aplanados en
 * blanco con marcos de ventana rojos, y su cupulita de azulejo detrás.
 */
function anexo(p: Painter, x: number, base: number): void {
  const w = 48;
  const alto = 96;
  const pie = base - 40;
  const top = pie - alto;
  // Techo (se ve desde arriba) y la cupulita.
  p.rect(x, top - 60, w, 60, '#d9cfc4');
  p.rect(x, top - 60, w, 2, '#ebe4dc');
  cupulaChica(p, x + w / 2, top - 8, 14, false);
  // Frente blanco con marcos rojos.
  p.rect(x, top, w, alto, '#eeeae3');
  for (let yy = top; yy < pie; yy++) {
    for (let xx = x; xx < x + w; xx++) if (hash(xx, yy, 381) < 0.04) p.px(xx, yy, '#dcd6cc');
  }
  p.rect(x, top, w, 3, C.lighter);
  p.rect(x, top + 3, w, 1, C.deep);
  for (const vy of [top + 12, top + 54]) {
    for (const vx of [x + 8, x + 28]) {
      p.rect(vx - 2, vy - 2, 16, 28, '#b0372c');
      p.rect(vx, vy, 12, 24, VIDRIO.dark);
      p.rect(vx + 6, vy, 1, 24, '#b0372c');
      p.px(vx + 1, vy + 1, VIDRIO.light);
    }
  }
  p.rect(x, pie - 4, w, 4, C.shade);
  p.rect(x + w - 2, top, 2, alto, 'rgb(58 34 48 / 0.2)');
}
