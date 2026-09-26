import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { describeOutfit, outfitOf } from '../../game/rendering/looks.ts';
import { FRAME_H, FRAME_W, frameCanvas, type Look } from '../../game/rendering/pixel-character.ts';
import { canAnimate } from '../motion.ts';
import { pixelCanvas } from './pixel-canvas.ts';

const ART_W = 36;
const ART_H = 48;
const COMPACTO_W = 20;
const COMPACTO_H = 37;

function draw(
  canvas: HTMLCanvasElement,
  look: Look,
  scale: number,
  blink: boolean,
  compacto: boolean,
) {
  if (compacto) {
    // Versión chica para la cabecera del teléfono: persona sobre un huacal bajo.
    const p = pixelCanvas(canvas, COMPACTO_W, COMPACTO_H, scale);
    p.clear();
    p.rect(0, 31, 20, 6, '#4a2716');
    for (const y of [31, 34]) {
      p.rect(0, y, 20, 2, '#cf8a4a');
      p.rect(0, y + 1, 20, 1, '#8f5424');
    }
    p.rect(0, 31, 1, 6, '#8f5424');
    p.rect(19, 31, 1, 6, '#8f5424');
    p.sprite(frameCanvas(look, 'down', 0, { blink }), 0, 0, FRAME_W, FRAME_H, 2, 0);
    return;
  }
  const p = pixelCanvas(canvas, ART_W, ART_H, scale);
  p.clear();
  p.ctx.fillStyle = 'rgb(43 18 56 / 0.3)';
  p.ctx.beginPath();
  p.ctx.ellipse(18 * p.unit, 46.5 * p.unit, 16 * p.unit, 1.6 * p.unit, 0, 0, Math.PI * 2);
  p.ctx.fill();
  // Huacal.
  p.rect(4, 36, 28, 10, '#4a2716');
  for (const y of [36, 40, 44]) {
    p.rect(4, y, 28, 2, '#cf8a4a');
    p.rect(4, y + 1, 28, 1, '#8f5424');
  }
  p.rect(4, 36, 2, 10, '#8f5424');
  p.rect(30, 36, 2, 10, '#8f5424');
  p.sprite(frameCanvas(look, 'down', 0, { blink }), 0, 0, FRAME_W, FRAME_H, 10, 5);
}

type Props = {
  look: Look;
  scale?: number;
  etiqueta?: string | null;
  className?: string;
  /** Variante chica para la cabecera en teléfono: sin huacal ni foco. */
  compacto?: boolean;
};

/** Tu personaje en su huacal, con una etiqueta de cartulina colgando. */
export function Maniqui({
  look,
  scale = 6,
  etiqueta = null,
  className = '',
  compacto = false,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [blink, setBlink] = useState(false);

  useLayoutEffect(() => {
    if (ref.current) draw(ref.current, look, scale, blink, compacto);
  }, [look, scale, blink, compacto]);

  useEffect(() => {
    if (!canAnimate()) return;
    let timer = 0;
    const loop = () => {
      timer = window.setTimeout(
        () => {
          setBlink(true);
          window.setTimeout(() => setBlink(false), 130);
          loop();
        },
        2400 + Math.random() * 3600,
      );
    };
    loop();
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <figure
      className={`maniqui ${compacto ? 'maniqui--compacto' : ''} ${className}`}
      style={
        { width: (compacto ? COMPACTO_W : ART_W) * scale, '--px': `${scale}px` } as CSSProperties
      }
    >
      {compacto ? null : (
        <>
          <span className="maniqui__luz" aria-hidden="true" />
          <span className="maniqui__cable" aria-hidden="true" />
          <span className="maniqui__bombilla" aria-hidden="true" />
        </>
      )}
      <canvas
        ref={ref}
        className="pixel"
        role="img"
        aria-label={`Un personaje con ${describeOutfit(outfitOf(look))}`}
      />
      {etiqueta !== null ? (
        <figcaption className="maniqui__etiqueta" aria-live="polite">
          <span className="maniqui__hilo" aria-hidden="true" />
          <span className="maniqui__carton">{etiqueta || '@tu_nombre'}</span>
        </figcaption>
      ) : null}
    </figure>
  );
}
