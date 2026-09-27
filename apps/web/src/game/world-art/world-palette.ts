import { mix, tone } from '../rendering/palette.ts';

/**
 * Colores del mundo. La Plaza es de día bajo el sol del tianguis: cantera
 * rosada, ladrillo, jardines, jacarandas en flor y las lonas de los puestos,
 * que son las mismas de la interfaz (tokens.css): la lona que tiñe.
 */

export const TILE = 16;

/** Sombra ciruela (nunca negra), como en la interfaz. */
export const SOMBRA = 'rgb(43 18 56 / 0.26)';
export const SOMBRA_SUAVE = 'rgb(43 18 56 / 0.14)';
export const PLUMON = '#17101b';
export const CIRUELA = '#2b1238';

export const CANTERA = {
  base: '#cdb1a2',
  light: '#dcc4b6',
  lighter: '#e8d6ca',
  shade: '#b59585',
  joint: '#957566',
  deep: '#7d5f53',
};

/** Cantera rosa en losas grandes (atrio de la Catedral, plazas): más clara y más rosa. */
export const LOSA = {
  base: '#d9bcaa',
  light: '#e2c8b8',
  lighter: '#ebd6c9',
  shade: '#cdae9b',
  joint: '#bb9985',
  vein: '#d2b09d',
};

/**
 * Cantera rosa de Morelia al sol: la de la Catedral, los portales y las
 * casas. Más cálida y más oscura que la de las losas del piso.
 */
export const CANTERA_ROSA = {
  base: '#c4907f',
  light: '#d6a898',
  lighter: '#e6bfb1',
  shade: '#a87565',
  deep: '#8a5c50',
  joint: '#b37d6c',
  dark: '#3a2230',
};

/** Azulejo de las cúpulas: damero de blanco y azul cobalto. */
export const AZULEJO = {
  blue: '#2d56a8',
  blueLight: '#4d78c8',
  blueDeep: '#1c3a78',
  white: '#eef1f6',
  whiteShade: '#c3cddc',
};

/** Las bóvedas de la Catedral vistas desde arriba: impermeabilizante rojo con nervaduras claras. */
export const TECHO = {
  base: '#b0503b',
  light: '#c46850',
  shade: '#8f3f2f',
  rib: '#eadfd4',
  ribShade: '#c8b9ac',
};

/** Herrería negra de rejas, portones y faroles. */
export const HERRERIA = { base: '#262129', light: '#4b4252', shade: '#141116' };

/** Bronce de las estatuas y las placas, con su pátina. */
export const BRONCE = { base: '#56523a', light: '#857e52', shade: '#34311f', patina: '#5f8b72' };

/** El techo del kiosko: lámina gris clara. */
export const LAMINA = { base: '#bec5cc', light: '#dde3e8', shade: '#98a1aa', deep: '#6c7680' };

/** Agua de las fuentes. */
export const AGUA = { base: '#5ea6c6', light: '#8fcfe6', shade: '#3e84a6', foam: '#e6f6fb' };

/** Laurel de la India recortado: follaje oscuro y apretado. */
export const LAUREL = {
  base: '#2f6b35',
  light: '#438a44',
  lighter: '#63a95a',
  shade: '#23522a',
  deep: '#173b1d',
};

/** Cal con que se pinta el pie de los troncos. */
export const CAL_TRONCO = { base: '#f1eee7', shade: '#d4cfc4' };

/** Piedra boleada del empedrado (calle Allende). */
export const EMPEDRADO = {
  stones: ['#8e8580', '#9b918a', '#857a73', '#a39a92', '#7c726c'] as const,
  joint: '#4f4743',
};

/** Azoteas vistas desde arriba: impermeabilizante rojo, pretiles y tinacos. */
export const AZOTEA = {
  roofs: ['#b5543d', '#a84a36', '#bf6147', '#9e4432', '#c26a4e'] as const,
  parapet: '#d9cfc4',
  parapetShade: '#a99d92',
  tank: '#26222a',
  tankLight: '#4a4550',
  tankShadow: '#7d3527',
};

export const LADRILLO = {
  base: '#c4683f',
  light: '#d9845a',
  shade: '#a6522f',
  joint: '#86412a',
};

export const PASTO = {
  base: '#5e9f42',
  light: '#7dbd55',
  lighter: '#9bd46b',
  shade: '#4a8637',
  deep: '#386b2b',
};

export const BANQUETA = {
  base: '#bdb4ad',
  light: '#cfc7c0',
  shade: '#a39a93',
  joint: '#8b827c',
  curb: '#948b85',
  curbDark: '#6f6660',
};

export const ASFALTO = {
  base: '#4a4350',
  light: '#58505e',
  shade: '#3b3541',
  line: '#f0cf45',
};

export const SETO = {
  base: '#3a7d3c',
  light: '#56a04a',
  lighter: '#75bb5c',
  shade: '#2a6230',
  deep: '#1d4822',
};

export const JACARANDA = {
  flower: '#9a6fdc',
  light: '#b893ee',
  lighter: '#d6bdfa',
  shade: '#7a52bd',
  deep: '#573b91',
};

export const CORTEZA = { base: '#6a4a3b', shade: '#4b3329', light: '#8b6552' };

/** Hierro pintado de verde (bancas, barandal, columnas del kiosko). */
export const HIERRO = { base: '#2f6b57', light: '#4c8f75', shade: '#1e4a3c' };

/** Techo del kiosko: cobre con pátina. */
export const PATINA = {
  base: '#3a9a82',
  light: '#5dbba0',
  lighter: '#8ad6bd',
  shade: '#256f5d',
  deep: '#1a5245',
};

/** Cal del kiosko, el lambrequín y las cornisas. */
export const CAL = { base: '#f4ede2', shade: '#d8cdbd', deep: '#b4a794' };

export const METAL = { base: '#b8b1bd', light: '#dcd6df', shade: '#7c7482' };
export const FAROL = { base: '#2a2530', light: '#4a4252', glass: '#ffe7a0', glow: '#fff6d4' };

export type LonaId = 'rosa' | 'azul' | 'amarilla' | 'verde' | 'naranja';

/** Las lonas: base, pliegue hondo y luz que la atraviesa (espejo de tokens.css). */
export const LONAS: Record<LonaId, { base: string; hondo: string; luz: string }> = {
  rosa: { base: '#d81b72', hondo: '#a10f57', luz: '#ff72b4' },
  azul: { base: '#1e4bd2', hondo: '#0f2c86', luz: '#5a86ff' },
  amarilla: { base: '#f5c518', hondo: '#b98a00', luz: '#ffe57a' },
  verde: { base: '#0f8a4a', hondo: '#075a2f', luz: '#39c47a' },
  naranja: { base: '#ee5f16', hondo: '#a8390a', luz: '#ff9a55' },
};

export function isLona(v: string | undefined): v is LonaId {
  return v !== undefined && v in LONAS;
}

/** Cartulinas fosforescentes de los precios. */
export const FOSFO = ['#efff3a', '#ff7a21', '#5dff86', '#ff5fae'] as const;

/** Fachadas del barrio: colores de pintura vinílica de fachada mexicana. */
export const FACHADAS = [
  tone('#e5487f', 0.24, 0.22),
  tone('#3a5cc4', 0.26, 0.24),
  tone('#f0c23a', 0.24, 0.26),
  tone('#3f9d68', 0.26, 0.22),
  tone('#dd6b3c', 0.24, 0.22),
  tone('#8b5bd0', 0.24, 0.22),
  tone('#f2e6cf', 0.16, 0.2),
] as const;

/** El papel picado: los colores de fiesta, no los de la interfaz. */
export const PAPEL_PICADO = [
  '#ff4f9a',
  '#ffd23f',
  '#35c77a',
  '#3f7bff',
  '#ff7a2a',
  '#b06cff',
] as const;

const HUNDIDOS = new Map<string, string>();

/**
 * Oscurece hacia ciruela: para cantos y contornos de objetos (con `amount`
 * negativo, aclara). Memorizado: el suelo lo pide por pixel.
 */
export function hundido(hex: string, amount = 0.35): string {
  const key = `${hex}|${amount}`;
  let color = HUNDIDOS.get(key);
  if (color === undefined) {
    color = mix(hex, CIRUELA, amount);
    if (HUNDIDOS.size > 4096) HUNDIDOS.clear();
    HUNDIDOS.set(key, color);
  }
  return color;
}
