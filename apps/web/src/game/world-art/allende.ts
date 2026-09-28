import { mix, WOOD } from '../rendering/palette.ts';
import { VERDE_BOTELLA } from './interior.ts';
import {
  type Art,
  aplanado,
  arcoVano,
  balcon,
  perillon,
  sillar,
  vaciarArco,
  ventana,
} from './morelia.ts';
import { hash, type Painter, painter, pick, sign, signWidth } from './paint.ts';
import { CANTERA_ROSA, HERRERIA, hundido, TILE } from './world-palette.ts';

/**
 * La calle Allende (ADR-0014): los portales Aldama y Allende —la arquería de
 * cantera sobre el andador cubierto, con la planta alta de balcones— y los
 * comercios del fondo, uno por arco, con el Café; las mesas de café bajo los
 * arcos; y las casas de dos pisos de Morelos a García Obeso. Todo mira a la
 * cámara (la vista va al sur desde Madero).
 */

const C = CANTERA_ROSA;
const LUZ = { warm: '#ffd98a', warmDeep: '#f2a24e', glow: '#fff4d6' };

/** Aplanados pintados: el Portal Allende va crema; el Aldama, salmón (IMPLAN). */
const APLANADOS: Record<string, string> = {
  crema: '#efe3cd',
  salmon: '#e6b9a1',
  ocre: '#d7a24e',
  rosa: '#d98a8a',
  telas: '#eeebe3',
  blanco: '#eeebe3',
};

/** Un arco del portal: tres tiles de pilar a pilar (≈4.2 m). */
const TRAMO = 3 * TILE;
const PILAR = 12;
/** Alto del vano: el pilar y el medio punto (≈5 m, un poco exagerado para ver adentro). */
const PILAR_ALTO = 66;
/** Pixeles de arte por encima del frente: los perillones del pretil. */
const REMATE = 10;

// ─── La arquería ──────────────────────────────────────────────────────────

/**
 * La arquería de un portal: pilares toscanos de cantera cada tres tiles con
 * sus arcos de medio punto, la faja, la planta alta con una ventana-balcón por
 * arco, la cornisa con gárgolas y el pretil con perillones. Los vanos quedan
 * transparentes: por ahí se ven los comercios, el andador y quien camina
 * debajo. De cada arco cuelga un farol hexagonal negro, a un lado del vano.
 */
export function portal(wTiles: number, hTiles: number, variant: string | undefined): Art {
  const W = Math.round(wTiles * TILE);
  const H = hTiles * TILE;
  const p = painter(W, H + REMATE);
  const top = REMATE;
  const pie = top + H;
  const imposta = pie - PILAR_ALTO;
  const r = (TRAMO - PILAR) / 2;
  const clave = imposta - r;
  const pintura = APLANADOS[variant ?? 'crema'] ?? '#efe3cd';
  const tramos = Math.floor((W - PILAR) / TRAMO);

  aplanado(p, 0, top, W, H, pintura, variant === 'salmon' ? 503 : 501);

  // Pretil: tapa de cantera y perillones sobre cada segundo pilar.
  p.rect(0, top, W, 2, C.lighter);
  p.rect(0, top + 2, W, 5, pintura);
  p.rect(0, top + 7, W, 1, hundido(pintura, 0.12));
  for (let k = 0; k <= tramos; k += 2) perillon(p, k * TRAMO + PILAR / 2, top - 9);
  // Cornisa principal y las gárgolas de cantera, una por arco.
  p.rect(0, top + 8, W, 1, C.lighter);
  p.rect(0, top + 9, W, 3, C.light);
  p.rect(0, top + 12, W, 1, C.deep);
  p.rect(0, top + 13, W, 2, 'rgb(58 34 48 / 0.2)');
  for (let k = 0; k <= tramos; k++) {
    const gx = k * TRAMO + PILAR / 2 - 2;
    p.rect(gx, top + 12, 4, 3, C.shade);
    p.px(gx + 3, top + 15, C.deep);
  }

  // Planta alta: una ventana-balcón con su repisón y su herrería negra sobre cada arco.
  for (let k = 0; k < tramos; k++) {
    const cx = k * TRAMO + PILAR + r;
    ventanaBalcon(p, cx, top + 18, clave - 12, k);
  }
  // Pilastras de cantera en la planta alta, sobre cada pilar.
  for (let k = 0; k <= tramos; k++) {
    const x = k * TRAMO + 2;
    p.rect(x, top + 15, 8, clave - top - 24, hundido(pintura, 0.04));
    p.rect(x, top + 15, 1, clave - top - 24, mix(pintura, '#ffffff', 0.35));
  }
  // Faja entre los dos pisos.
  p.rect(0, clave - 9, W, 1, C.lighter);
  p.rect(0, clave - 8, W, 2, C.light);
  p.rect(0, clave - 6, W, 1, C.deep);

  // Los arcos: la rosca de dovelas de cantera y el vano vacío.
  for (let k = 0; k < tramos; k++) {
    const x0 = k * TRAMO + PILAR;
    const cx = x0 + r;
    const alto = pie - clave;
    arcoVano(p, cx, pie, 2 * r + 8, alto + 5, C.shade);
    arcoVano(p, cx, pie, 2 * r + 6, alto + 4, C.base);
    arcoVano(p, cx, pie, 2 * r + 4, alto + 3, C.light);
    // Juntas de las dovelas.
    for (let i = 1; i < 8; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      const jx = Math.round(cx + Math.cos(a) * (r + 2.5));
      const jy = Math.round(imposta + Math.sin(a) * (r + 2.5));
      p.px(jx, jy, C.joint);
    }
    arcoVano(p, cx, pie, 2 * r + 1, alto + 1, C.deep);
    vaciarArco(p, cx, pie, 2 * r, alto);
    // La clave.
    p.rect(Math.round(cx) - 2, clave - 5, 5, 6, C.lighter);
    p.rect(Math.round(cx) + 2, clave - 5, 1, 6, C.shade);
  }

  // Los pilares toscanos: basa, fuste redondo y capitel (la imposta).
  for (let k = 0; k <= tramos; k++) pilarToscano(p, k * TRAMO, imposta, pie);

  // Un farol hexagonal colgado en cada arco, a un lado del vano y debajo del
  // letrero del comercio (la cadena sube a un techo que desde aquí no se ve).
  for (let k = 0; k < tramos; k++) farolColgante(p, k * TRAMO + PILAR + 5, pie - 68, 4);

  return {
    canvas: p.canvas,
    ox: 0,
    oy: -REMATE,
    luces: Array.from({ length: tramos }, (_, k) => ({ x: k * TRAMO + PILAR + 7, y: pie - 60 })),
  };
}

function pilarToscano(p: Painter, x: number, imposta: number, pie: number): void {
  // Fuste redondo: luz a la izquierda, sombra a la derecha.
  const tonos = [
    C.lighter,
    C.light,
    C.light,
    C.base,
    C.base,
    C.base,
    C.base,
    C.shade,
    C.shade,
    C.deep,
  ];
  for (let i = 0; i < PILAR - 2; i++) {
    p.rect(x + 1 + i, imposta + 2, 1, pie - imposta - 8, tonos[i] ?? C.base);
  }
  // Capitel (la imposta de donde arrancan los arcos) y su collarino.
  p.rect(x - 1, imposta - 2, PILAR + 2, 2, C.lighter);
  p.rect(x - 1, imposta, PILAR + 2, 2, C.light);
  p.rect(x, imposta + 2, PILAR, 1, C.deep);
  p.rect(x + 1, imposta + 5, PILAR - 2, 1, C.shade);
  // Basa.
  p.rect(x - 1, pie - 6, PILAR + 2, 6, C.shade);
  p.rect(x - 1, pie - 6, PILAR + 2, 1, C.light);
  p.rect(x - 1, pie - 1, PILAR + 2, 1, C.deep);
}

/** Ventana-balcón: marco de cantera con su cornisita, dos hojas de vidrio y el balcón de herrería. */
function ventanaBalcon(p: Painter, cx: number, top: number, bottom: number, seed: number): void {
  const w = 12;
  const x = Math.round(cx - w / 2);
  const h = bottom - top - 6;
  // Cornisita sobre la ventana.
  p.rect(x - 4, top, w + 8, 2, C.lighter);
  p.rect(x - 3, top + 2, w + 6, 1, C.deep);
  ventana(p, x, top + 5, w, h, seed);
  balcon(p, x - 3, bottom, w + 6);
}

/** Farol hexagonal negro de vidrio esmerilado, colgado de su cadena. */
export function farolColgante(p: Painter, x: number, y: number, cadena: number): void {
  for (let i = 0; i < cadena; i += 2) p.px(x + 2, y + i, HERRERIA.base);
  const ly = y + cadena;
  p.rect(x + 1, ly, 3, 1, HERRERIA.base);
  p.rect(x, ly + 1, 5, 1, HERRERIA.base);
  p.rect(x, ly + 2, 5, 5, '#f4ecd6');
  p.rect(x + 1, ly + 3, 3, 3, LUZ.glow);
  p.rect(x, ly + 2, 1, 5, HERRERIA.base);
  p.rect(x + 4, ly + 2, 1, 5, HERRERIA.base);
  p.rect(x + 2, ly + 2, 1, 5, HERRERIA.light);
  p.rect(x, ly + 7, 5, 1, HERRERIA.base);
  p.px(x + 2, ly + 8, HERRERIA.base);
}

// ─── Los comercios del fondo del portal ───────────────────────────────────

/** Techo de vigas que se asoma arriba de los comercios, en la sombra del portal. */
const VIGAS = 8;

/**
 * El fondo del portal: el techo de vigas oscuras en sombra y el muro crema de
 * los comercios, uno por arco: la puerta en su marco de cantera, el aparador y
 * el letrero con su giro. El Café lleva el marco verde botella, la luz tibia
 * de adentro, su rótulo y el pizarrón del menú.
 */
export function comercios(wTiles: number, giros: readonly string[]): Art {
  const W = Math.round(wTiles * TILE);
  const H = 2 * TILE + VIGAS;
  const p = painter(W, H);
  // Techo de vigas.
  p.rect(0, 0, W, VIGAS, '#3a2f24');
  for (let x = 0; x < W; x += 6) p.rect(x, 0, 2, VIGAS - 1, '#5a4636');
  p.rect(0, VIGAS - 1, W, 1, '#241b14');
  // Muro del fondo, aplanado crema en la sombra del portal.
  for (let y = VIGAS; y < H; y++) {
    for (let x = 0; x < W; x++) {
      p.px(x, y, hash(x, y, 411) < 0.05 ? hundido('#e8e0c8', 0.1) : '#e8e0c8');
    }
  }
  for (let i = 0; i < 6; i++) p.rect(0, VIGAS + i, W, 1, `rgb(43 18 56 / ${0.3 - i * 0.045})`);
  const tramos = Math.floor((W - PILAR) / TRAMO);
  for (let k = 0; k < tramos; k++) {
    const cx = Math.round(k * TRAMO + PILAR + (TRAMO - PILAR) / 2);
    const giro = giros[k] ?? 'PAN';
    if (giro === 'CAFE') cafe(p, cx, H);
    else comercio(p, cx, H, giro, k);
  }
  return { canvas: p.canvas, ox: 0, oy: -VIGAS };
}

const TINTES = ['#7a2f2a', '#2a4f7a', '#355a2a', '#6b3a78', '#7a5a2a', '#1f5a47'] as const;

function comercio(p: Painter, cx: number, bottom: number, giro: string, seed: number): void {
  const tinte = pick(TINTES, seed, giro.length, 4);
  // Marco de cantera de la puerta.
  p.rect(cx - 7, bottom - 20, 14, 20, C.light);
  p.rect(cx - 7, bottom - 20, 14, 1, C.lighter);
  p.rect(cx + 6, bottom - 19, 1, 19, C.shade);
  // La puerta: vidrio con luz de adentro o cortina metálica verde (las del Aldama).
  const cortina = hash(seed, 7, 9) < 0.18;
  if (cortina) {
    p.rect(cx - 5, bottom - 17, 10, 17, '#3f6b4f');
    for (let y = bottom - 16; y < bottom; y += 2) p.rect(cx - 5, y, 10, 1, '#2f5540');
  } else {
    p.rect(cx - 5, bottom - 17, 10, 17, hundido(tinte, 0.25));
    p.rect(cx - 4, bottom - 16, 8, 9, LUZ.warm);
    p.rect(cx - 4, bottom - 16, 8, 1, mix(LUZ.warm, '#ffffff', 0.5));
    p.rect(cx, bottom - 16, 1, 16, hundido(tinte, 0.45));
    // La cerrajería del medio punto sobre la puerta.
    p.rect(cx - 4, bottom - 17, 8, 1, HERRERIA.base);
  }
  // Aparadores a los lados, con cositas de colores.
  for (const dx of [-16, 10]) {
    p.rect(cx + dx - 1, bottom - 14, 8, 11, C.light);
    p.rect(cx + dx, bottom - 13, 6, 8, mix(LUZ.warm, '#fff4d6', 0.45));
    for (let i = 0; i < 3; i++) {
      p.px(
        cx + dx + 1 + i * 2,
        bottom - 7,
        pick(['#ff4f9a', '#ffd23f', '#35c77a', '#3f7bff'], seed, i + dx, 5),
      );
    }
  }
  // Letrero pintado arriba de la puerta.
  const w = signWidth(giro) + 4;
  p.rect(cx - Math.round(w / 2), bottom - 28, w, 7, tinte);
  p.rect(cx - Math.round(w / 2), bottom - 28, w, 1, mix(tinte, '#ffffff', 0.3));
  sign(p, giro, cx - Math.round(w / 2) + 2, bottom - 27, '#f4ede2');
}

function cafe(p: Painter, cx: number, bottom: number): void {
  // Marco verde botella, la puerta de vidrio con luz tibia y las vitrinas con tazas.
  p.rect(cx - 17, bottom - 22, 34, 22, VERDE_BOTELLA.base);
  p.rect(cx - 17, bottom - 22, 34, 1, VERDE_BOTELLA.light);
  p.rect(cx - 7, bottom - 19, 14, 19, WOOD.base);
  for (let y = bottom - 18; y < bottom - 3; y++) {
    p.rect(cx - 6, y, 12, 1, mix(LUZ.warm, LUZ.warmDeep, (y - bottom + 18) / 15));
  }
  p.rect(cx, bottom - 18, 1, 18, WOOD.shadow);
  p.px(cx + 4, bottom - 9, '#f0cf45');
  for (const dx of [-15, 9]) {
    p.rect(cx + dx, bottom - 16, 6, 10, LUZ.warm);
    p.px(cx + dx + 1, bottom - 9, '#fff4d6');
    p.px(cx + dx + 3, bottom - 9, '#ff72b4');
    p.px(cx + dx + 2, bottom - 12, '#fff4d6');
  }
  // Rótulo: CAFÉ en cal sobre verde, con sus focos.
  p.rect(cx - 14, bottom - 30, 28, 8, VERDE_BOTELLA.shade);
  p.rect(cx - 14, bottom - 30, 28, 1, VERDE_BOTELLA.light);
  sign(p, 'CAFÉ', cx - 7, bottom - 28, '#fff4d6');
  for (const fx of [cx - 12, cx + 11]) p.px(fx, bottom - 27, LUZ.glow);
  // El pizarrón del menú, recargado junto a la puerta.
  p.rect(cx + 10, bottom - 9, 6, 9, WOOD.shadow);
  p.rect(cx + 11, bottom - 8, 4, 5, '#2b3a33');
  p.rect(cx + 12, bottom - 7, 2, 1, '#e8e2d6');
  p.rect(cx + 12, bottom - 5, 1, 1, '#ffd23f');
}

// ─── Las mesas del café bajo los arcos ────────────────────────────────────

/**
 * Mesa de café del portal: tapa de madera clara con su pata de fierro, dos
 * sillas (blancas de plástico o de madera oscura) mirándose y, encima, dos
 * tazas. La silla de la izquierda mira a la derecha y al revés.
 */
export function mesaDePortal(seedId: string, wTiles: number, hTiles: number): Art {
  const W = Math.round(wTiles * TILE);
  const fondo = Math.round(hTiles * TILE);
  const extra = 16;
  const H = fondo + extra;
  const p = painter(W, H);
  const pie = H - 1;
  const seed = [...seedId].reduce((a, c) => a + c.charCodeAt(0), 0);
  const madera = hash(seed, 1, 3) < 0.5;
  const silla = madera ? '#5a3a24' : '#f2efe8';
  const sillaSombra = madera ? '#3f2818' : '#cfcac0';
  // Sillas: respaldo del lado de afuera, asiento y patas.
  sillaDeCafe(p, 1, pie, silla, sillaSombra, false);
  sillaDeCafe(p, W - 11, pie, silla, sillaSombra, true);
  // La mesa: pata de fierro, pie en cruz y tapa de madera clara.
  const mx = Math.round(W / 2);
  p.rect(mx - 1, pie - 11, 2, 11, HERRERIA.base);
  p.rect(mx - 4, pie - 1, 8, 1, HERRERIA.shade);
  p.rect(mx - 7, pie - 15, 14, 3, '#d9b07a');
  p.rect(mx - 7, pie - 15, 14, 1, '#ecc995');
  p.rect(mx - 7, pie - 12, 14, 1, '#a57d4d');
  // Dos tazas con su plato.
  for (const dx of [-4, 2]) {
    p.rect(mx + dx, pie - 18, 3, 3, '#f7f3ea');
    p.px(mx + dx + 3, pie - 17, '#f7f3ea');
    p.px(mx + dx + 1, pie - 18, '#7a4a2a');
  }
  return { canvas: p.canvas, ox: 0, oy: -extra };
}

function sillaDeCafe(
  p: Painter,
  x: number,
  pie: number,
  color: string,
  sombra: string,
  derecha: boolean,
): void {
  const rx = derecha ? x + 8 : x;
  // Respaldo.
  p.rect(rx, pie - 19, 2, 12, color);
  p.rect(rx, pie - 19, 2, 1, mix(color, '#ffffff', 0.3));
  // Asiento.
  p.rect(x, pie - 9, 10, 2, color);
  p.rect(x, pie - 7, 10, 1, sombra);
  // Patas.
  p.rect(x + 1, pie - 6, 1, 6, sombra);
  p.rect(x + 8, pie - 6, 1, 6, sombra);
}

// ─── Casas de Allende ─────────────────────────────────────────────────────

/**
 * Casa de dos pisos de la calle: sillería de cantera o aplanado de color con
 * marcos de cantera, balcones arriba, zaguán y comercio abajo, cornisa con
 * gárgolas y pretil. `telas` es la casa blanca neoclásica de balaustrada y
 * ventanas con frontón (la tienda de telas de la esquina, en las fotos de la
 * Melchor Ocampo); `crema` lleva balaustrada también.
 */
export function casa(
  wTiles: number,
  hTiles: number,
  variant: string | undefined,
  seed: number,
): Art {
  const W = Math.round(wTiles * TILE);
  const H = hTiles * TILE;
  const extra = variant === 'telas' || variant === 'crema' ? 16 : 0;
  const p = painter(W, H + extra);
  const top = extra;
  const pintura = variant && variant !== 'cantera' ? APLANADOS[variant] : undefined;
  if (pintura) aplanado(p, 0, top, W, H, pintura, 421 + seed);
  else sillar(p, 0, top, W, H, 421 + seed);
  const fachada = pintura ?? C.base;

  // Remate: balaustrada con perillones (las neoclásicas) o pretil liso.
  if (extra) {
    p.rect(0, top - 1, W, 1, C.lighter);
    for (let x = 2; x < W - 2; x += 3) {
      p.rect(x, top - 7, 2, 6, variant === 'telas' ? '#f6f3ec' : C.light);
      p.px(x + 1, top - 5, hundido(variant === 'telas' ? '#f6f3ec' : C.light, 0.18));
    }
    p.rect(0, top - 8, W, 2, variant === 'telas' ? '#f6f3ec' : C.lighter);
    for (let x = 6; x < W - 4; x += 28) perillon(p, x, top - 16);
  }
  p.rect(0, top, W, 2, C.lighter);
  p.rect(0, top + 2, W, 3, C.light);
  p.rect(0, top + 5, W, 1, C.deep);
  for (let x = 8; x < W - 4; x += 24) {
    p.rect(x, top + 6, 5, 2, C.shade);
    p.px(x + 4, top + 8, C.deep);
  }
  // Letrero en el friso de la tienda de telas, en letras oscuras.
  const friso = variant === 'telas' ? 12 : 0;
  if (variant === 'telas') {
    const texto = 'TELAS';
    const sw = signWidth(texto);
    sign(p, texto, Math.round((W - sw) / 2), top + 9, '#2a2530');
  }
  // Pilastras de las orillas.
  p.rect(0, top + 6, 3, H - 6, C.light);
  p.rect(W - 3, top + 6, 3, H - 6, C.shade);

  // Planta alta: balcones, con frontón en las neoclásicas.
  const alta = top + 22 + friso;
  const n = Math.max(1, Math.floor(W / 40));
  for (let i = 0; i < n; i++) {
    const cx = Math.round(((i + 0.5) * W) / n);
    if (extra) {
      p.rect(cx - 9, alta - 5, 18, 2, C.lighter);
      p.rect(cx - 7, alta - 7, 14, 2, C.light);
      p.rect(cx - 4, alta - 9, 8, 2, C.light);
    }
    ventana(p, cx - 6, alta, 12, 26 - friso, seed * 7 + i);
    balcon(p, cx - 9, alta + 28 - friso, 18);
  }
  // Faja entre pisos.
  const faja = top + 62;
  p.rect(0, faja, W, 2, C.light);
  p.rect(0, faja + 2, W, 1, C.deep);

  // Planta baja: el zaguán al centro y comercios a los lados.
  const cx = Math.round(W / 2);
  const pie = top + H;
  p.rect(cx - 12, pie - 44, 24, 44, C.lighter);
  p.rect(cx - 10, pie - 42, 20, 42, WOOD.base);
  p.rect(cx - 10, pie - 42, 20, 2, WOOD.shadow);
  p.rect(cx, pie - 40, 1, 40, WOOD.shadow);
  for (const y of [pie - 30, pie - 16]) p.rect(cx - 9, y, 18, 1, WOOD.shadow);
  p.px(cx - 3, pie - 20, '#f0cf45');
  // A lo más dos locales, uno a cada lado del zaguán, con su letrero de madera pintada.
  for (const lado of [-1, 1]) {
    if (W < 100 && lado > 0) continue;
    const sx = lado < 0 ? Math.round(W * 0.2) - 12 : Math.round(W * 0.8) - 12;
    p.rect(sx - 2, pie - 34, 28, 34, C.light);
    p.rect(sx, pie - 32, 24, 32, C.shade);
    p.rect(sx + 1, pie - 31, 22, 16, LUZ.warm);
    p.rect(sx + 1, pie - 15, 22, 15, hundido(fachada, 0.35));
    const giro = pick(['PAN', 'ROPA', 'TELAS', 'VINOS', 'FOTOS'], seed, lado + 3, 7);
    const tabla = pick(['#2a4f7a', '#355a2a', '#7a2f2a', '#3a2f24'], seed, lado + 5, 6);
    p.rect(sx, pie - 41, 24, 7, tabla);
    sign(p, giro, sx + Math.round((24 - signWidth(giro)) / 2), pie - 40, '#f4ede2');
  }
  return { canvas: p.canvas, ox: 0, oy: -extra };
}

// ─── La Cerrada de San Agustín ────────────────────────────────────────────

/**
 * El fondo de la Cerrada de San Agustín: el callejón peatonal sigue hacia el
 * sur entre las casas y, al fondo, el templo de San Agustín con su torre de
 * cantera y el cupulín rojizo (lo que se ve desde el andador Juárez).
 */
export function cerrada(wTiles: number, hTiles: number): Art {
  const W = Math.round(wTiles * TILE);
  const H = Math.round(hTiles * TILE);
  const p = painter(W, H);
  // El callejón que se aleja: losas que se oscurecen hacia el fondo.
  for (let y = 0; y < H; y++) {
    const lejos = 1 - y / H;
    for (let x = 0; x < W; x++) {
      const junta = y % 6 === 5 || (x + (Math.floor(y / 6) % 2) * 5) % 10 === 9;
      let c = junta
        ? '#a8948a'
        : hash(Math.floor(x / 10), Math.floor(y / 6), 611) < 0.5
          ? '#cdb6a8'
          : '#c3aa9c';
      c = hundido(c, 0.08 + lejos * 0.3);
      p.px(x, y, c);
    }
  }
  // Las fachadas de los lados, vistas de canto: una franja de sombra en cada orilla.
  p.rect(0, 0, 10, H, hundido('#e6d9c3', 0.35));
  p.rect(W - 10, 0, 10, H, hundido('#e6d9c3', 0.45));
  for (let y = 4; y < H - 8; y += 18) {
    p.rect(2, y, 6, 10, '#3b3552');
    p.rect(W - 8, y + 6, 6, 10, '#3b3552');
  }
  // Al fondo, el templo: su fachada de cantera y la torre con el cupulín rojizo.
  const fondo = Math.round(H * 0.72);
  sillar(p, 14, fondo - 40, W - 28, 40, 613);
  p.rect(14, fondo - 42, W - 28, 2, C.lighter);
  arcoVano(p, W / 2, fondo, 16, 26, '#4a3228');
  arcoVano(p, W / 2, fondo, 12, 22, '#6b4526');
  const tx = W - 42;
  sillar(p, tx, fondo - 84, 22, 46, 614);
  arcoVano(p, tx + 11, fondo - 58, 10, 18, '#2a2130');
  p.rect(tx - 2, fondo - 86, 26, 3, C.lighter);
  for (let yy = 0; yy < 18; yy++) {
    const half = Math.round(11 * Math.sqrt(Math.max(0, 1 - ((18 - yy) / 18) ** 2)));
    for (let xx = -half; xx < half; xx++) {
      const u = (xx + half) / Math.max(1, half * 2);
      p.px(tx + 11 + xx, fondo - 104 + yy, u < 0.3 ? '#d4705a' : u > 0.7 ? '#9a3f30' : '#bf5843');
    }
  }
  p.rect(tx + 10, fondo - 114, 1, 10, HERRERIA.base);
  p.rect(tx + 8, fondo - 111, 5, 1, HERRERIA.base);
  return { canvas: p.canvas, ox: 0, oy: 0 };
}
