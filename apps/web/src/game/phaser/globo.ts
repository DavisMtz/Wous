/**
 * Globos de diálogo (§18): un recado de cartulina colgado sobre la cabeza de
 * quien habla. Es papel aunque flote en el mundo, como las etiquetas de los
 * nombres: se pinta en un canvas a pixeles de PANTALLA (Bricolage, nunca
 * tipografía pixel) y la escena lo escala 1/zoom para que caiga 1:1.
 */

export const GLOBO_FONT_PX = 13.5;
const LINE_PX = 17;
const MAX_TEXT_W = 196;
const MAX_LINES = 4;
const PAD_X = 10;
const PAD_Y = 7;
const TAIL_H = 7;
/** Espacio para la sombra ciruela alrededor del papel. */
const SHADOW_PAD = 8;
const PLUMON = '#17101b';
const CARTULINA = '#fffbf1';

/**
 * Corta el texto en renglones que caben en `maxWidth`. Parte por palabras y,
 * si una palabra sola no cabe, por letras (grafemas sueltos incluidos). Más
 * renglones que `maxLines` terminan en «…»: el texto completo está en el
 * registro del chat.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: (s: string) => number,
  maxLines = MAX_LINES,
): string[] {
  const lines: string[] = [];
  let current = '';
  const pushLine = (line: string) => {
    lines.push(line);
  };
  for (const word of text.split(' ')) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) pushLine(current);
    current = '';
    // La palabra sola no cabe: se parte por letras.
    if (measure(word) > maxWidth) {
      for (const char of Array.from(word)) {
        if (measure(current + char) > maxWidth && current) {
          pushLine(current);
          current = '';
        }
        current += char;
      }
    } else {
      current = word;
    }
  }
  if (current) pushLine(current);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1] ?? '';
  while (last && measure(`${last}…`) > maxWidth) last = Array.from(last).slice(0, -1).join('');
  kept[maxLines - 1] = `${last.trimEnd()}…`;
  return kept;
}

export type GloboArt = {
  canvas: HTMLCanvasElement;
  /** Tamaño en pixeles de pantalla (el canvas no se escala). */
  width: number;
  height: number;
  /** Del borde inferior del canvas a la punta del pico (sombra incluida). */
  tipFromBottom: number;
};

/**
 * Pinta el globo: papel con esquinas de trazo a mano, sombra ciruela suave y
 * un pico hacia quien habla. La fuente ya debe estar cargada (la plaza la
 * espera antes de abrir el juego).
 */
export function paintGlobo(text: string, fontFamily: string): GloboArt {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no disponible');
  const font = `600 ${GLOBO_FONT_PX}px ${fontFamily}`;
  ctx.font = font;
  const lines = wrapText(text, MAX_TEXT_W, (s) => ctx.measureText(s).width);
  const textW = Math.ceil(Math.max(...lines.map((l) => ctx.measureText(l).width), 12));
  const paperW = textW + PAD_X * 2;
  const paperH = lines.length * LINE_PX + PAD_Y * 2 - 2;
  const width = paperW + SHADOW_PAD * 2;
  const height = paperH + TAIL_H + SHADOW_PAD * 2;
  canvas.width = width;
  canvas.height = height;

  const x = SHADOW_PAD;
  const y = SHADOW_PAD - 2;
  const tipX = x + Math.round(paperW * 0.46);
  const shape = new Path2D();
  shape.roundRect(x, y, paperW, paperH, [5, 8, 6, 9]);
  // El pico sale del borde de abajo, un poco chueco: hecho a mano.
  shape.moveTo(tipX - 6, y + paperH - 1);
  shape.lineTo(tipX + 1, y + paperH + TAIL_H);
  shape.lineTo(tipX + 6, y + paperH - 1);
  shape.closePath();

  ctx.save();
  ctx.shadowColor = 'rgb(43 18 56 / 0.5)';
  ctx.shadowBlur = 7;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = CARTULINA;
  ctx.fill(shape);
  ctx.restore();
  // Canto de la cartulina: una línea apenas más oscura, sin contorno negro.
  ctx.strokeStyle = 'rgb(43 18 56 / 0.18)';
  ctx.lineWidth = 1;
  ctx.stroke(shape);
  ctx.fillStyle = CARTULINA;
  ctx.fill(shape);

  // Un pedazo de masking en la esquina: el recado va pegado, como el letrero de la sala.
  ctx.save();
  ctx.translate(x + 9, y - 1);
  ctx.rotate(-0.12);
  ctx.fillStyle = 'rgb(233 219 177 / 0.9)';
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.lineTo(19, -4);
  ctx.lineTo(20, 4);
  ctx.lineTo(-1, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.font = font;
  ctx.fillStyle = PLUMON;
  ctx.textBaseline = 'alphabetic';
  lines.forEach((line, i) => {
    ctx.fillText(line, x + PAD_X, y + PAD_Y + 11 + i * LINE_PX);
  });

  return {
    canvas,
    width,
    height,
    tipFromBottom: height - (y + paperH + TAIL_H),
  };
}

/** Cuánto se queda un globo: base más un poco por letra, con tope. */
export function globoMs(text: string, baseMs: number, perCharMs: number): number {
  return Math.min(baseMs + Array.from(text).length * perCharMs, 10_000);
}
