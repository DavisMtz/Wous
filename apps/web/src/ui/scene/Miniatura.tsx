import { useLayoutEffect, useRef } from 'react';
import {
  type ComposeOptions,
  type Direction,
  FRAME_W,
  frameCanvas,
  type Look,
} from '../../game/rendering/pixel-character.ts';
import type { Frame } from '../../game/rendering/sprite-maps.ts';
import { pixelCanvas } from './pixel-canvas.ts';

/** Recorte vertical del sprite (filas de arte) para enseñar solo una pieza. */
export type Recorte = { desde: number; hasta: number };

export const RECORTES = {
  cabeza: { desde: 0, hasta: 15 },
  torso: { desde: 12, hasta: 23 },
  piernas: { desde: 19, hasta: 32 },
  pies: { desde: 26, hasta: 32 },
  cuerpo: { desde: 0, hasta: 32 },
} as const satisfies Record<string, Recorte>;

type Props = {
  look: Look;
  recorte?: Recorte;
  escala?: number;
  direction?: Direction;
  frame?: Frame;
  opciones?: ComposeOptions;
};

/** Un pedazo del personaje dibujado a pixel exacto (para opciones del creador). */
export function Miniatura({
  look,
  recorte = RECORTES.cuerpo,
  escala = 3,
  direction = 'down',
  frame = 0,
  opciones,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const alto = recorte.hasta - recorte.desde;
    const p = pixelCanvas(canvas, FRAME_W, alto, escala);
    p.clear();
    p.sprite(frameCanvas(look, direction, frame, opciones), 0, recorte.desde, FRAME_W, alto, 0, 0);
  }, [look, recorte, escala, direction, frame, opciones]);
  return <canvas ref={ref} className="pixel" />;
}
