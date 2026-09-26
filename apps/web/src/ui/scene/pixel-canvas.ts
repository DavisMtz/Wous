/**
 * Utilidades para dibujar pixel art nítido en canvas: el lienzo trabaja en
 * «pixeles de arte» y se escala por un entero (y por la densidad de pantalla).
 */

export type PixelPainter = {
  ctx: CanvasRenderingContext2D;
  /** Tamaño en pixeles reales de un pixel de arte. */
  unit: number;
  rect(x: number, y: number, w: number, h: number, color: string): void;
  sprite(
    source: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    x: number,
    y: number,
  ): void;
  clear(): void;
};

/**
 * Prepara un canvas de `artW × artH` pixeles de arte a escala `scale` en CSS.
 * El respaldo usa la densidad de la pantalla redondeada para no emborronar.
 */
export function pixelCanvas(
  canvas: HTMLCanvasElement,
  artW: number,
  artH: number,
  scale: number,
): PixelPainter {
  const density = Math.max(1, Math.round(window.devicePixelRatio || 1));
  const unit = scale * density;
  canvas.width = artW * unit;
  canvas.height = artH * unit;
  canvas.style.width = `${artW * scale}px`;
  canvas.style.height = `${artH * scale}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no disponible');
  ctx.imageSmoothingEnabled = false;
  return {
    ctx,
    unit,
    rect(x, y, w, h, color) {
      ctx.fillStyle = color;
      ctx.fillRect(x * unit, y * unit, w * unit, h * unit);
    },
    sprite(source, sx, sy, sw, sh, x, y) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(source, sx, sy, sw, sh, x * unit, y * unit, sw * unit, sh * unit);
    },
    clear() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}

/** Escala entera que cabe en `available` pixeles CSS. */
export function fitScale(available: number, artSize: number, min = 2, max = 5): number {
  return Math.max(min, Math.min(max, Math.floor(available / artSize)));
}
