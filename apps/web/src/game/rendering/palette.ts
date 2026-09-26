/**
 * Paletas del pixel art. Cada material tiene tono base y sombra; el contorno
 * se deriva oscureciendo el color vecino (contorno selectivo, no negro puro).
 */

export type Tone = { base: string; shadow: string; light: string };

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Mezcla hacia un color destino (0 = original, 1 = destino). */
export function mix(hex: string, towards: string, amount: number): string {
  const [r1, g1, b1] = hexToRgb(hex);
  const [r2, g2, b2] = hexToRgb(towards);
  return rgbToHex(r1 + (r2 - r1) * amount, g1 + (g2 - g1) * amount, b1 + (b2 - b1) * amount);
}

/**
 * Sombra fría-violeta en vez de negro: bajo la lona, las sombras se tiñen.
 * El contorno es el color vecino hundido hacia un ciruela casi negro.
 */
const SHADE = '#2b1238';
const LIGHT = '#fff4d6';

export function tone(base: string, shadowAmount = 0.26, lightAmount = 0.28): Tone {
  return { base, shadow: mix(base, SHADE, shadowAmount), light: mix(base, LIGHT, lightAmount) };
}

export function outlineOf(hex: string): string {
  return mix(hex, '#1a0a22', 0.62);
}

export const SKIN_TONES = {
  'piel-1': tone('#f6d9c6', 0.2),
  'piel-2': tone('#ecc19e', 0.2),
  'piel-3': tone('#d9a178', 0.22),
  'piel-4': tone('#b87a50', 0.24),
  'piel-5': tone('#8c5638', 0.26),
  'piel-6': tone('#5c3824', 0.3),
} as const satisfies Record<string, Tone>;
export type SkinToneId = keyof typeof SKIN_TONES;

export const HAIR_COLORS = {
  negro: tone('#2c2329', 0.3, 0.22),
  'castano-oscuro': tone('#4b2e22', 0.3),
  castano: tone('#7b4a2c', 0.28),
  rubio: tone('#e0b758', 0.26),
  pelirrojo: tone('#c4502a', 0.26),
  cano: tone('#d6d1cb', 0.22),
  rosa: tone('#ff5fa8', 0.26),
  azul: tone('#3d6cff', 0.28),
} as const satisfies Record<string, Tone>;
export type HairColorId = keyof typeof HAIR_COLORS;

/** Colores de ropa sacados del tianguis: lonas, cartulinas y mezclilla. */
export const CLOTH_COLORS = {
  rosa: tone('#e8267f'),
  azul: tone('#1e4bd2'),
  amarillo: tone('#f2d93a', 0.3),
  verde: tone('#2fbf71'),
  naranja: tone('#ff7a1f'),
  negro: tone('#2a2530', 0.3, 0.2),
  blanco: tone('#efebe4', 0.2),
  rojo: tone('#d7263d'),
  morado: tone('#7b3fe4'),
  mezclilla: tone('#3b5c9a'),
  caqui: tone('#b9a27a'),
} as const satisfies Record<string, Tone>;
export type ClothColorId = keyof typeof CLOTH_COLORS;

export const EYE_COLOR = '#24161f';
export const SOLE_WHITE = tone('#f4f1ec', 0.18);

/** Madera de huacal y banca: tabla, su canto y la rendija entre tablas. */
export const WOOD = { base: '#cf8a4a', shadow: '#8f5424', gap: '#4a2716' } as const;
