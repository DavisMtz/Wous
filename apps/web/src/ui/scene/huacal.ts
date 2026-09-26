import { WOOD } from '../../game/rendering/palette.ts';
import type { PixelPainter } from './pixel-canvas.ts';

/**
 * Huacal de tablas con rendijas: la tarima donde se para la persona en el
 * probador, el espejo y la cabecera del teléfono. Una sola receta.
 */
export function huacal(
  p: PixelPainter,
  x: number,
  y: number,
  w: number,
  h: number,
  plank: number,
  step: number,
  post = 2,
): void {
  p.rect(x, y, w, h, WOOD.gap);
  for (let row = y; row < y + h - 1; row += step) {
    p.rect(x, row, w, plank, WOOD.base);
    p.rect(x, row + plank - 1, w, 1, WOOD.shadow);
  }
  p.rect(x, y, post, h, WOOD.shadow);
  p.rect(x + w - post, y, post, h, WOOD.shadow);
}
