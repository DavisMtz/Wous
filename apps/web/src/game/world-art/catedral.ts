import { hash, type Painter, painter } from './paint.ts';
import { AZULEJO, CANTERA_ROSA, HERRERIA, hundido, LAMINA, TECHO, TILE } from './world-palette.ts';

/**
 * La Catedral de Morelia vista desde Madero (ADR-0013): la fachada norte de
 * cantera rosa con sus dos torres de tres cuerpos, relojes y cupulinos; el
 * cuerpo central con la puerta mayor, las dos laterales y sus rejas, el
 * relieve de la Transfiguración y el remate con perillones. Detrás, las
 * bóvedas de rojo con nervaduras claras, la cúpula de azulejo azul y blanco
 * sobre su tambor y una cupulita de azulejo junto a la torre oriente.
 *
 * El lienzo mide 20 tiles de ancho (la huella) y llega de la línea de la
 * fachada (abajo) hasta la fila 3 del mapa: las torres suben ~19 tiles.
 */
export const CATEDRAL_W = 20 * TILE;
/** Del pie de la fachada (fila 36) a la fila 3. */
export const CATEDRAL_H = 33 * TILE;

const C = CANTERA_ROSA;

export function catedral(): { canvas: HTMLCanvasElement; ox: number; oy: number } {
  const p = painter(CATEDRAL_W, CATEDRAL_H);
  const base = CATEDRAL_H;

  // Primero lo de atrás: bóvedas, crucero, cúpula; luego la fachada encima.
  boveda(p, 64, 136, 192, base - 150);
  crucero(p, 22, 232, 276, 44);
  cupula(p, 160, 262);
  cupulaChica(p, 84, base - 150, 15);

  torre(p, 2, base, false);
  torre(p, CATEDRAL_W - 74, base, true);
  cuerpoCentral(p, 74, base);
  gradas(p, 70, base);
  return { canvas: p.canvas, ox: 0, oy: -8 * TILE };
}

// ─── Sillería ─────────────────────────────────────────────────────────────

/**
 * Muro de sillares de cantera: hiladas de 5 px con juntas claras, cada
 * sillar con su tono, manchas de intemperie y la luz de la mañana (izquierda).
 */
function sillares(p: Painter, x: number, y: number, w: number, h: number, seed: number): void {
  for (let yy = 0; yy < h; yy++) {
    const course = Math.floor(yy / 5);
    const offset = (course % 2) * 6;
    for (let xx = 0; xx < w; xx++) {
      const gx = x + xx;
      const gy = y + yy;
      const block = Math.floor((xx + offset) / 11);
      if (yy % 5 === 4 || (xx + offset) % 11 === 10) {
        p.px(gx, gy, C.joint);
        continue;
      }
      const tone = hash(block, course, seed);
      let c = tone < 0.18 ? C.shade : tone > 0.84 ? C.light : C.base;
      // Intemperie: chorreados oscuros bajo las cornisas y manchas sueltas.
      const stain = hash(Math.floor(gx / 3), Math.floor(gy / 7), seed + 3);
      if (stain > 0.93) c = hundido(c, 0.12);
      if (yy % 5 === 0 && tone > 0.4) c = C.light;
      const speck = hash(gx, gy, seed + 7);
      if (speck < 0.03) c = C.shade;
      else if (speck > 0.985) c = C.lighter;
      p.px(gx, gy, c);
    }
  }
  // Canto de luz a la izquierda y sombra a la derecha.
  p.rect(x, y, 1, h, C.lighter);
  p.rect(x + w - 1, y, 1, h, C.deep);
}

/** Cornisa: una moldura que sale, con su luz arriba y la sombra que deja. */
function cornisa(p: Painter, x: number, y: number, w: number, salida = 2): void {
  p.rect(x - salida, y, w + salida * 2, 1, C.lighter);
  p.rect(x - salida, y + 1, w + salida * 2, 2, C.light);
  p.rect(x - salida, y + 3, w + salida * 2, 1, C.deep);
  p.rect(x, y + 4, w, 1, `rgb(58 34 48 / 0.35)`);
}

/** Perillón: el remate en forma de jarrón que corona pilastras y esquinas. */
function perillon(p: Painter, cx: number, y: number): void {
  p.rect(cx - 2, y + 6, 5, 2, C.base);
  p.rect(cx - 1, y + 3, 3, 3, C.light);
  p.px(cx - 1, y + 3, C.lighter);
  p.rect(cx - 1, y + 1, 3, 2, C.base);
  p.px(cx, y, C.light);
  p.px(cx + 1, y + 4, C.shade);
}

/** Balaustrada: pasamanos, balaustres cada 3 px y su zoclo. */
function balaustrada(p: Painter, x: number, y: number, w: number): void {
  p.rect(x, y, w, 1, C.lighter);
  p.rect(x, y + 1, w, 1, C.base);
  for (let xx = x + 1; xx < x + w - 1; xx += 3) {
    p.rect(xx, y + 2, 2, 4, C.light);
    p.px(xx + 1, y + 3, C.shade);
  }
  p.rect(x, y + 6, w, 2, C.shade);
}

/** Vano de medio punto: rectángulo con su arco (lleno de `fill`). */
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
function marco(p: Painter, cx: number, bottom: number, w: number, h: number): void {
  arco(p, cx, bottom, w + 4, h + 2, C.lighter);
  arco(p, cx + 1, bottom, w + 3, h + 1, C.shade);
}

// ─── Torres ───────────────────────────────────────────────────────────────

/**
 * Una torre: el cubo liso de sillería, el reloj, la balaustrada y tres
 * cuerpos de campanario cada vez más angostos con sus vanos, pilastras y
 * perillones, el cupulino y la cruz (con veleta la poniente).
 */
function torre(p: Painter, x: number, base: number, poniente: boolean): void {
  const w = 72;
  const cx = x + w / 2;
  // Cubo de la torre.
  const cuboTop = base - 128;
  sillares(p, x, cuboTop, w, 128, poniente ? 301 : 311);
  // Zócalo.
  p.rect(x, base - 8, w, 8, C.shade);
  p.rect(x, base - 8, w, 1, C.lighter);
  p.rect(x, base - 1, w, 1, C.deep);
  // Ventanita del cubo con su reja.
  marco(p, cx, base - 70, 10, 16);
  arco(p, cx, base - 70, 10, 16, C.dark);
  for (let xx = cx - 4; xx <= cx + 4; xx += 3) p.rect(xx, base - 84, 1, 14, HERRERIA.light);
  // El reloj, arriba del cubo.
  reloj(p, cx, cuboTop + 14);
  cornisa(p, x, cuboTop - 4, w, 3);
  balaustrada(p, x - 2, cuboTop - 12, w + 4);
  for (const px of [x, x + w - 1]) perillon(p, px, cuboTop - 22);

  // Primer cuerpo del campanario.
  const c1x = x + 6;
  const c1w = w - 12;
  const c1Top = cuboTop - 12 - 58;
  sillares(p, c1x, c1Top, c1w, 58, poniente ? 302 : 312);
  pilastras(p, c1x, c1Top, c1w, 58);
  campanario(p, cx, c1Top + 52, 20, 36);
  for (const dx of [-21, 21]) {
    marco(p, cx + dx, c1Top + 40, 6, 16);
    arco(p, cx + dx, c1Top + 40, 6, 16, C.dark);
  }
  cornisa(p, c1x, c1Top - 4, c1w, 3);
  balaustrada(p, c1x - 2, c1Top - 12, c1w + 4);
  for (const px of [c1x, c1x + c1w - 1]) perillon(p, px, c1Top - 22);

  // Segundo cuerpo (ochavado).
  const c2x = x + 14;
  const c2w = w - 28;
  const c2Top = c1Top - 12 - 42;
  sillares(p, c2x, c2Top, c2w, 42, poniente ? 303 : 313);
  pilastras(p, c2x, c2Top, c2w, 42);
  campanario(p, cx, c2Top + 38, 16, 30);
  cornisa(p, c2x, c2Top - 4, c2w, 2);
  for (const px of [c2x + 1, c2x + c2w - 2]) perillon(p, px, c2Top - 12);

  // Tercer cuerpo (linternilla de la torre).
  const c3x = x + 22;
  const c3w = w - 44;
  const c3Top = c2Top - 4 - 26;
  sillares(p, c3x, c3Top, c3w, 26, poniente ? 304 : 314);
  for (const dx of [-7, 0, 7]) {
    arco(p, cx + dx, c3Top + 22, 4, 12, C.dark);
  }
  cornisa(p, c3x, c3Top - 3, c3w, 2);

  // Cupulino de cantera, linternilla y cruz.
  const cupTop = c3Top - 3 - 16;
  for (let yy = 0; yy < 16; yy++) {
    const t = yy / 16;
    const half = Math.round(13 * Math.sqrt(Math.max(0, 1 - (1 - t) ** 2)));
    for (let xx = -half; xx < half; xx++) {
      const u = (xx + half) / Math.max(1, half * 2);
      const c = u < 0.3 ? C.light : u > 0.72 ? C.shade : C.base;
      p.px(cx + xx, cupTop + yy, (xx + 40) % 5 === 0 ? C.joint : c);
    }
  }
  p.rect(cx - 3, cupTop - 8, 6, 8, C.base);
  p.rect(cx - 3, cupTop - 8, 1, 8, C.light);
  p.rect(cx - 1, cupTop - 6, 2, 4, C.dark);
  p.rect(cx - 4, cupTop - 10, 8, 2, C.light);
  cruz(p, cx, cupTop - 22, poniente);
}

/** Pilastras en las esquinas de un cuerpo, con su luz. */
function pilastras(p: Painter, x: number, y: number, w: number, h: number): void {
  for (const px of [x, x + w - 5]) {
    p.rect(px, y, 5, h, C.base);
    p.rect(px, y, 1, h, C.lighter);
    p.rect(px + 4, y, 1, h, C.shade);
    p.rect(px - 1, y, 7, 3, C.light);
  }
}

/** Vano del campanario con su campana de bronce. */
function campanario(p: Painter, cx: number, bottom: number, w: number, h: number): void {
  marco(p, cx, bottom, w, h);
  arco(p, cx, bottom, w, h, C.dark);
  // Campana: bronce con su luz, el badajo y el yugo.
  const by = bottom - h + Math.round(w / 2) + 3;
  p.rect(cx - 1, by - 2, 2, 2, HERRERIA.base);
  for (let yy = 0; yy < 9; yy++) {
    const half = Math.min(5, 2 + Math.floor(yy / 2));
    for (let xx = -half; xx < half; xx++) {
      const c = xx < -half + 2 ? '#c9a45a' : xx > half - 2 ? '#6d5323' : '#9c7a3c';
      p.px(cx + xx, by + yy, c);
    }
  }
  p.rect(cx - 6, by + 9, 12, 1, '#6d5323');
  p.px(cx, by + 10, '#4d3a17');
}

/** Carátula del reloj: blanca con números en punto y manecillas negras. */
function reloj(p: Painter, cx: number, cy: number): void {
  p.ellipse(cx, cy, 8, 8, C.shade);
  p.ellipse(cx, cy, 7, 7, C.lighter);
  p.ellipse(cx, cy, 6, 6, '#f4efe6');
  for (const [dx, dy] of [
    [0, -5],
    [5, 0],
    [0, 5],
    [-5, 0],
  ] as const) {
    p.px(cx + dx, cy + dy, HERRERIA.base);
  }
  // Las diez y diez.
  p.rect(cx, cy - 4, 1, 4, HERRERIA.base);
  p.rect(cx - 3, cy - 2, 3, 1, HERRERIA.base);
  p.rect(cx + 1, cy - 1, 2, 1, HERRERIA.base);
}

function cruz(p: Painter, cx: number, y: number, veleta: boolean): void {
  p.rect(cx, y, 1, 14, HERRERIA.base);
  p.rect(cx - 3, y + 3, 7, 1, HERRERIA.base);
  if (veleta) {
    p.rect(cx + 1, y + 7, 4, 1, HERRERIA.light);
    p.px(cx + 5, y + 6, HERRERIA.light);
  }
  p.px(cx, y, HERRERIA.light);
}

// ─── Cuerpo central ───────────────────────────────────────────────────────

/**
 * La portada: tres calles separadas por pilastras, las tres puertas de
 * madera con sus rejas, el relieve de la Transfiguración sobre la puerta
 * mayor, nichos con santos, óculos y el remate escalonado con perillones.
 */
function cuerpoCentral(p: Painter, x: number, base: number): void {
  const w = CATEDRAL_W - 148;
  const cx = x + w / 2;
  const primero = 70;
  const segundo = 58;
  const top1 = base - 10 - primero;
  const top2 = top1 - 6 - segundo;

  // Primer cuerpo.
  sillares(p, x, top1, w, primero + 10, 321);
  // Puerta mayor y las laterales, con su reja.
  puerta(p, cx, base - 10, 34, 56);
  puerta(p, cx - 50, base - 10, 22, 42);
  puerta(p, cx + 50, base - 10, 22, 42);
  // Pilastras de la portada (con capiteles).
  for (const px of [x + 8, cx - 30, cx + 25, x + w - 13]) {
    p.rect(px, top1, 5, primero, C.base);
    p.rect(px, top1, 1, primero, C.lighter);
    p.rect(px + 4, top1, 1, primero, C.shade);
    p.rect(px - 1, top1, 7, 3, C.light);
    p.rect(px - 1, top1 + primero - 3, 7, 3, C.shade);
    // Tablero: el barroco «tablerado» de Morelia.
    p.rect(px + 1, top1 + 10, 3, 1, C.shade);
    p.rect(px + 1, top1 + 26, 3, 1, C.shade);
    p.rect(px + 1, top1 + 42, 3, 1, C.shade);
  }
  cornisa(p, x, top1 - 4, w, 3);

  // Segundo cuerpo: relieve, nichos, óculos.
  sillares(p, x + 6, top2, w - 12, segundo, 322);
  relieve(p, cx, top2 + 10);
  for (const dx of [-50, 50]) {
    nicho(p, cx + dx, top2 + 40);
    oculo(p, cx + dx, top2 + 12);
  }
  for (const px of [x + 12, cx - 28, cx + 23, x + w - 17]) {
    p.rect(px, top2, 4, segundo, C.base);
    p.rect(px, top2, 1, segundo, C.lighter);
    p.rect(px + 3, top2, 1, segundo, C.shade);
  }
  cornisa(p, x + 6, top2 - 4, w - 12, 2);
  for (const px of [x + 8, x + w - 9]) perillon(p, px, top2 - 12);

  // Remate: escalonado, con su medallón y la cruz al centro.
  const rw = 70;
  const rTop = top2 - 4 - 28;
  sillares(p, cx - rw / 2, rTop, rw, 28, 323);
  for (let i = 0; i < 3; i++) {
    const sw = rw + 20 - i * 8;
    p.rect(cx - sw / 2, rTop + 18 + i * 3, sw, 1, C.lighter);
  }
  p.ellipse(cx, rTop + 12, 9, 9, C.shade);
  p.ellipse(cx, rTop + 12, 8, 8, C.light);
  p.ellipse(cx, rTop + 12, 5, 5, C.base);
  p.rect(cx - 1, rTop + 8, 2, 8, C.deep);
  p.rect(cx - 3, rTop + 10, 6, 2, C.deep);
  cornisa(p, cx - rw / 2, rTop - 3, rw, 2);
  for (const px of [cx - rw / 2 - 6, cx - rw / 2 + 2, cx + rw / 2 - 3, cx + rw / 2 + 5]) {
    perillon(p, px, rTop + 8);
  }
  perillon(p, cx, rTop - 11);
  cruz(p, cx, rTop - 26, false);
}

/** Puerta de madera tallada con su marco de cantera y la reja de hierro delante. */
function puerta(p: Painter, cx: number, bottom: number, w: number, h: number): void {
  marco(p, cx, bottom, w, h);
  arco(p, cx, bottom, w, h, '#5a3a24');
  // Tableros de la madera.
  for (let yy = bottom - h + w / 2 + 4; yy < bottom - 4; yy += 8) {
    p.rect(cx - w / 2 + 3, yy, w - 6, 1, '#7a5233');
    p.rect(cx - w / 2 + 3, yy + 5, w - 6, 1, '#3f2818');
  }
  p.rect(cx, bottom - h + w / 2, 1, h - w / 2, '#2f1d12');
  // Reja: barrotes, travesaños y el abanico del arco.
  for (let xx = Math.round(cx - w / 2) + 1; xx < cx + w / 2; xx += 3) {
    p.rect(xx, bottom - h + w / 2 - 2, 1, h - w / 2 + 2, HERRERIA.base);
  }
  for (const yy of [bottom - 4, bottom - h / 2, bottom - h + w / 2]) {
    p.rect(Math.round(cx - w / 2), yy, w, 1, HERRERIA.base);
  }
  const r = w / 2 - 2;
  for (let a = 0; a <= 8; a++) {
    const ang = Math.PI + (a / 8) * Math.PI;
    for (let t = 2; t < r; t++) {
      p.px(
        Math.round(cx + Math.cos(ang) * t),
        Math.round(bottom - h + w / 2 + Math.sin(ang) * t),
        HERRERIA.base,
      );
    }
  }
}

/** El relieve de la Transfiguración: un tablero con tres figuras en bajorrelieve. */
function relieve(p: Painter, cx: number, y: number): void {
  const w = 40;
  const h = 30;
  const x = cx - w / 2;
  p.rect(x - 2, y - 2, w + 4, h + 4, C.lighter);
  p.rect(x - 1, y - 1, w + 2, h + 2, C.shade);
  p.rect(x, y, w, h, C.base);
  // Cristo al centro, más alto, con la aureola; Moisés y Elías a los lados.
  p.ellipse(cx, y + 7, 5, 5, C.lighter);
  figura(p, cx, y + 5, 20, true);
  figura(p, cx - 13, y + 12, 15, false);
  figura(p, cx + 13, y + 12, 15, false);
  // Nube abajo.
  for (let xx = 0; xx < w; xx += 5) p.ellipse(x + xx + 2, y + h - 3, 3, 2, C.light);
}

function figura(p: Painter, cx: number, y: number, h: number, luz: boolean): void {
  p.rect(cx - 1, y, 3, 3, luz ? C.lighter : C.light);
  p.rect(cx - 2, y + 3, 5, h - 3, luz ? C.light : C.base);
  p.rect(cx + 2, y + 3, 1, h - 3, C.shade);
  p.rect(cx - 3, y + h - 2, 7, 2, C.shade);
}

function nicho(p: Painter, cx: number, bottom: number): void {
  marco(p, cx, bottom, 12, 22);
  arco(p, cx, bottom, 12, 22, C.shade);
  figura(p, cx, bottom - 18, 17, true);
  p.rect(cx - 7, bottom, 14, 2, C.lighter);
}

function oculo(p: Painter, cx: number, cy: number): void {
  p.ellipse(cx, cy, 6, 6, C.lighter);
  p.ellipse(cx, cy, 5, 5, C.shade);
  p.ellipse(cx, cy, 4, 4, '#3b3552');
  p.px(cx - 1, cy - 2, '#8f84b8');
}

/** Gradas del atrio al pie de la portada. */
function gradas(p: Painter, x: number, base: number): void {
  const w = CATEDRAL_W - 140;
  for (let i = 0; i < 3; i++) {
    const y = base - 10 + i * 3;
    p.rect(x - i * 2, y, w + i * 4, 3, i === 0 ? C.light : C.base);
    p.rect(x - i * 2, y, w + i * 4, 1, C.lighter);
  }
  p.rect(x - 6, base - 1, w + 12, 1, C.deep);
}

// ─── Techos y cúpulas ─────────────────────────────────────────────────────

/**
 * Las bóvedas de la nave vistas desde arriba: tramos de rojo con las
 * nervaduras claras (el impermeabilizante de siempre) y a los lados la
 * balaustrada con perillones.
 */
function boveda(p: Painter, x: number, y: number, w: number, h: number): void {
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const bay = yy % 30;
      const col = xx % 32;
      let c = TECHO.base;
      const u = col / 32;
      c = u < 0.3 ? TECHO.light : u > 0.75 ? TECHO.shade : TECHO.base;
      if (bay === 0 || bay === 1) c = TECHO.rib;
      else if (bay === 2) c = TECHO.ribShade;
      if (col === 0) c = TECHO.rib;
      if (col === 16 && bay > 3) c = hundido(TECHO.base, -0.1);
      const speck = hash(x + xx, y + yy, 331);
      if (speck < 0.04) c = hundido(c, 0.1);
      p.px(x + xx, y + yy, c);
    }
  }
  // Pretiles con balaustrada a los lados.
  for (const bx of [x - 6, x + w]) {
    p.rect(bx, y, 6, h, C.base);
    p.rect(bx, y, 1, h, C.lighter);
    p.rect(bx + 5, y, 1, h, C.deep);
    for (let yy = y + 4; yy < y + h; yy += 18) perillon(p, bx + 2, yy);
  }
  // El ábside redondeado al fondo.
  p.ellipse(x + w / 2, y + 2, w / 2 - 6, 8, TECHO.shade);
  p.ellipse(x + w / 2, y + 2, w / 2 - 10, 6, TECHO.base);
}

/** El crucero: los brazos del transepto, más anchos que la nave. */
function crucero(p: Painter, x: number, y: number, w: number, h: number): void {
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const col = xx % 28;
      let c = col < 9 ? TECHO.light : col > 21 ? TECHO.shade : TECHO.base;
      if (yy < 2 || yy > h - 3 || col === 0) c = TECHO.rib;
      p.px(x + xx, y + yy, c);
    }
  }
  p.rect(x - 2, y - 2, w + 4, 2, C.lighter);
  p.rect(x - 2, y + h, w + 4, 3, C.shade);
}

/**
 * La cúpula del crucero: tambor ochavado de cantera con ventanas y la media
 * naranja de azulejo en damero azul y blanco, con su linternilla y la cruz.
 */
function cupula(p: Painter, cx: number, base: number): void {
  // Tambor.
  const tw = 76;
  const th = 26;
  sillares(p, cx - tw / 2, base - th, tw, th, 341);
  for (const dx of [-26, -9, 9, 26]) {
    arco(p, cx + dx, base - 5, 7, 14, '#3b3552');
    p.px(cx + dx - 2, base - 16, '#8f84b8');
  }
  cornisa(p, cx - tw / 2, base - th - 3, tw, 3);
  for (const px of [cx - tw / 2 - 2, cx + tw / 2 + 1]) perillon(p, px, base - th - 12);
  // Media naranja de azulejo.
  const rx = 34;
  const ry = 38;
  const dBase = base - th - 3;
  for (let yy = 0; yy < ry; yy++) {
    const t = (ry - yy) / ry;
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - t * t)));
    for (let xx = -half; xx < half; xx++) {
      // Gajos (verticales) y hiladas (horizontales) hacen el damero.
      const ang = Math.asin(Math.max(-1, Math.min(1, xx / Math.max(1, half))));
      const gajo = Math.floor(((ang + Math.PI / 2) / Math.PI) * 12);
      const hilada = Math.floor(yy / 4);
      const blanco = (gajo + hilada) % 2 === 0;
      const u = (xx + half) / Math.max(1, half * 2);
      let c = blanco ? AZULEJO.white : AZULEJO.blue;
      if (u > 0.68) c = blanco ? AZULEJO.whiteShade : AZULEJO.blueDeep;
      else if (u < 0.22 && yy < ry * 0.7) c = blanco ? '#ffffff' : AZULEJO.blueLight;
      // Nervaduras de cantera cada tres gajos.
      if (
        gajo % 3 === 0 &&
        Math.abs(xx - Math.round(Math.sin((gajo / 12) * Math.PI - Math.PI / 2) * half)) < 1
      ) {
        c = C.light;
      }
      p.px(cx + xx, dBase - ry + yy, c);
    }
  }
  // Linternilla y cruz.
  const lt = dBase - ry - 16;
  p.rect(cx - 6, lt, 12, 16, C.base);
  p.rect(cx - 6, lt, 2, 16, C.lighter);
  p.rect(cx + 4, lt, 2, 16, C.shade);
  for (const dx of [-2, 2]) p.rect(cx + dx - 1, lt + 4, 2, 7, '#3b3552');
  cornisa(p, cx - 6, lt - 3, 12, 2);
  p.ellipse(cx, lt - 4, 6, 4, AZULEJO.blue);
  p.ellipse(cx - 1, lt - 5, 3, 2, AZULEJO.white);
  cruz(p, cx, lt - 20, false);
}

/** Cupulita de azulejo de una capilla lateral (junto a la torre oriente). */
function cupulaChica(p: Painter, cx: number, base: number, r: number): void {
  sillares(p, cx - r - 2, base - 10, r * 2 + 4, 10, 351);
  for (let yy = 0; yy < r; yy++) {
    const t = (r - yy) / r;
    const half = Math.round(r * Math.sqrt(Math.max(0, 1 - t * t)));
    for (let xx = -half; xx < half; xx++) {
      const blanco = (Math.floor((xx + 40) / 3) + Math.floor(yy / 3)) % 2 === 0;
      const u = (xx + half) / Math.max(1, half * 2);
      let c = blanco ? AZULEJO.white : AZULEJO.blue;
      if (u > 0.7) c = blanco ? AZULEJO.whiteShade : AZULEJO.blueDeep;
      p.px(cx + xx, base - 10 - r + yy, c);
    }
  }
  p.rect(cx - 2, base - 10 - r - 6, 4, 6, C.base);
  p.rect(cx, base - 10 - r - 12, 1, 6, HERRERIA.base);
  p.rect(cx - 2, base - 10 - r - 10, 5, 1, HERRERIA.base);
  // La lámina gris del cupulín de la linternilla, para no repetir el azul.
  p.px(cx - 1, base - 10 - r - 7, LAMINA.light);
}
