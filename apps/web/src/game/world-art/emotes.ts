import type { Emote } from '@wous/contracts';
import {
  CLOTH_COLORS,
  HAIR_COLORS,
  outlineOf,
  SKIN_TONES,
  type Tone,
  tone,
} from '../rendering/palette.ts';
import type { Look } from '../rendering/pixel-character.ts';
import { painter } from './paint.ts';

/**
 * Los gestos (§19) son del mundo: pixel art pintado por código (ADR-0007),
 * nunca emojis. La mano que saluda y la del pulgar son de la piel de quien
 * hace el gesto, con el puño de su playera, y la carcajada es su propia cara,
 * con su piel y su pelo: tu gesto se ve tuyo.
 *
 * Cada dibujo es una rejilla de letras; el contorno se agrega solo alrededor
 * (color vecino hundido, nunca negro) y el lienzo lleva un pixel de margen.
 */

type Paleta = Record<string, string>;

/** Mano abierta, dedos arriba y pulgar a la izquierda; dos cuadros para el vaivén. */
const SALUDO_A = [
  '......##.......',
  '...##.##.##....',
  '...##.##.##....',
  '...##.##.##.##.',
  '...##.##.##.##.',
  '.#.##.##.##.##.',
  '.##++#++#++#+#.',
  '..#++#########.',
  '...###########.',
  '...##########-.',
  '....########--.',
  '.....######--..',
  '......####-....',
  '.....cccccc....',
  '.....cccccc....',
];

/** El mismo saludo con los dedos vencidos hacia el otro lado. */
const SALUDO_B = SALUDO_A.map((row, y) => (y <= 5 ? `.${row.slice(0, -1)}` : row));

/** Carcajada: su cara, con el fleco de su pelo, ojos cerrados de risa, boca abierta y lágrimas. */
const RISA = [
  '.....hhhhhhh.....',
  '...hhhhhhhhhhh...',
  '..hhhhhhhhhhhhh..',
  '..h+##########h..',
  't.#+ee####ee#-#.t',
  't.#e##e##e##e#-.t',
  '..#############..',
  '..##mmmmmmmmm##..',
  '..##mmmmmmmmm#-..',
  '..-#mmmrrrmmm#-..',
  '...##mmrrrmm#-...',
  '....###mmm##-....',
  '.....#######.....',
];

/** Corazón de cartulina fosforescente, con brillo arriba y sombra abajo. */
const CORAZON = [
  '..###...###..',
  '.#++##.#+###.',
  '#++#########-',
  '#+##########-',
  '############-',
  '.##########-.',
  '..########-..',
  '...######-...',
  '....####-....',
  '.....##-.....',
  '......-......',
];

/** Pulgar arriba sobre un puño visto de lado, con el puño de la playera. */
const PULGAR = [
  '.....##.......',
  '....#++#......',
  '....#+##......',
  '....####......',
  '...#####......',
  'cc#########...',
  'cc#++########.',
  'cc#######--##.',
  'cc###########.',
  'cc#######--##.',
  'cc###########.',
  'cc.#######--..',
  '....######....',
];

const CORAZON_PALETA: Paleta = {
  '#': '#ff4f9a',
  '+': '#ffb6d8',
  '-': '#c21d6a',
};

function caraPaleta(look: Look | null): Paleta {
  const piel: Tone = look ? SKIN_TONES[look.skin] : SKIN_TONES['piel-3'];
  const pelo: Tone = look ? HAIR_COLORS[look.hairColor] : HAIR_COLORS.negro;
  return {
    '#': piel.base,
    '+': piel.light,
    '-': piel.shadow,
    h: pelo.base,
    e: '#2b1238',
    m: '#5a1030',
    r: '#ff6f8e',
    t: '#7fd6ff',
  };
}

function manoPaleta(look: Look | null): Paleta {
  const piel: Tone = look ? SKIN_TONES[look.skin] : SKIN_TONES['piel-3'];
  const puno = look ? CLOTH_COLORS[look.topColor] : tone('#1e4bd2');
  return { '#': piel.base, '+': piel.light, '-': piel.shadow, c: puno.base };
}

/** Pinta una rejilla con contorno automático y un pixel de margen. */
function pintar(grid: readonly string[], paleta: Paleta): HTMLCanvasElement {
  const h = grid.length;
  const w = Math.max(...grid.map((r) => r.length));
  const p = painter(w + 2, h + 2);
  const at = (x: number, y: number) => grid[y]?.[x] ?? '.';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = at(x, y);
      const color = paleta[c];
      if (c !== '.' && color) p.px(x + 1, y + 1, color);
    }
  }
  // Contorno selectivo: cada hueco junto a algo pintado toma el color vecino hundido.
  for (let y = -1; y <= h; y++) {
    for (let x = -1; x <= w; x++) {
      if (at(x, y) !== '.' && paleta[at(x, y)]) continue;
      const vecino = [at(x, y - 1), at(x - 1, y), at(x + 1, y), at(x, y + 1)].find(
        (c) => c !== '.' && paleta[c],
      );
      if (!vecino) continue;
      // El puño, el pelo y las lágrimas llevan su propio contorno; lo demás, el de la piel.
      const propio = vecino === 'c' || vecino === 't' || vecino === 'h';
      const base = (propio ? paleta[vecino] : paleta['#']) ?? '#2b1238';
      p.px(x + 1, y + 1, outlineOf(base));
    }
  }
  return p.canvas;
}

export type EmoteArt = { frames: HTMLCanvasElement[]; w: number; h: number };

/** Los cuadros de un gesto para esta persona (la mano lleva su piel y su playera). */
export function paintEmote(emote: Emote, look: Look | null): EmoteArt {
  const frames =
    emote === 'wave'
      ? [pintar(SALUDO_A, manoPaleta(look)), pintar(SALUDO_B, manoPaleta(look))]
      : emote === 'laugh'
        ? [pintar(RISA, caraPaleta(look))]
        : emote === 'heart'
          ? [pintar(CORAZON, CORAZON_PALETA)]
          : [pintar(PULGAR, manoPaleta(look))];
  const first = frames[0] as HTMLCanvasElement;
  return { frames, w: first.width, h: first.height };
}

/** Clave de textura: los gestos dependen de la piel, la playera o el pelo de quien los hace. */
export function emoteKey(emote: Emote, look: Look | null): string {
  if (emote === 'wave' || emote === 'thumbs_up') {
    return `gesto:${emote}:${look?.skin ?? 'x'}:${look?.topColor ?? 'x'}`;
  }
  if (emote === 'laugh') return `gesto:laugh:${look?.skin ?? 'x'}:${look?.hairColor ?? 'x'}`;
  return `gesto:${emote}`;
}
