import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { describeOutfit, outfitOf } from '../../game/rendering/looks.ts';
import {
  type Direction,
  FRAME_H,
  FRAME_W,
  frameCanvas,
  type Look,
  lookKey,
} from '../../game/rendering/pixel-character.ts';
import type { Frame } from '../../game/rendering/sprite-maps.ts';
import { Icono } from '../components/Icono.tsx';
import { canAnimate } from '../motion.ts';
import { pixelCanvas } from './pixel-canvas.ts';

const ART_W = 36;
const ART_H = 48;
const GIRO: Direction[] = ['down', 'left', 'up', 'right'];
const NOMBRE_DIRECCION: Record<Direction, string> = {
  down: 'de frente',
  left: 'de perfil izquierdo',
  up: 'de espaldas',
  right: 'de perfil derecho',
};

function dibujar(
  canvas: HTMLCanvasElement,
  look: Look,
  scale: number,
  dir: Direction,
  frame: Frame,
) {
  const p = pixelCanvas(canvas, ART_W, ART_H, scale);
  p.clear();
  p.ctx.fillStyle = 'rgb(43 18 56 / 0.3)';
  p.ctx.beginPath();
  p.ctx.ellipse(18 * p.unit, 46.5 * p.unit, 16 * p.unit, 1.6 * p.unit, 0, 0, Math.PI * 2);
  p.ctx.fill();
  p.rect(4, 36, 28, 10, '#4a2716');
  for (const y of [36, 40, 44]) {
    p.rect(4, y, 28, 2, '#cf8a4a');
    p.rect(4, y + 1, 28, 1, '#8f5424');
  }
  p.rect(4, 36, 2, 10, '#8f5424');
  p.rect(30, 36, 2, 10, '#8f5424');
  p.sprite(frameCanvas(look, dir, frame), 0, 0, FRAME_W, FRAME_H, 10, 5);
}

type Props = { look: Look; escala?: number };

/**
 * El espejo del probador: tu personaje grande sobre su huacal. Se puede girar
 * y poner a caminar para ver el look desde todos lados. Cada cambio de look
 * lo hace brincar: el mismo gesto que en el perchero de la portada.
 */
export function Espejo({ look, escala = 7 }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [giro, setGiro] = useState(0);
  const [caminando, setCaminando] = useState(false);
  const [frame, setFrame] = useState<Frame>(0);
  const direccion = GIRO[giro % GIRO.length] ?? 'down';
  const key = lookKey(look);
  const primera = useRef(true);

  useLayoutEffect(() => {
    if (canvasRef.current) dibujar(canvasRef.current, look, escala, direccion, frame);
  }, [look, escala, direccion, frame]);

  useEffect(() => {
    if (!caminando) {
      setFrame(0);
      return;
    }
    if (!canAnimate()) {
      setFrame(1);
      return;
    }
    const timer = window.setInterval(() => setFrame((f) => ((f + 1) % 4) as Frame), 160);
    return () => window.clearInterval(timer);
  }, [caminando]);

  // Brinco al cambiar de look (no en el primer dibujo).
  useGSAP(
    () => {
      if (primera.current) {
        primera.current = false;
        return;
      }
      if (!canAnimate() || !canvasRef.current) return;
      gsap
        .timeline()
        .to(canvasRef.current, { y: -escala * 3, scaleY: 1.04, duration: 0.12, ease: 'power2.out' })
        .to(canvasRef.current, { y: 0, scaleY: 0.95, duration: 0.1, ease: 'power2.in' })
        .to(canvasRef.current, {
          scaleY: 1,
          duration: 0.3,
          ease: 'back.out(3)',
          clearProps: 'transform',
        });
    },
    { scope: wrap, dependencies: [key] },
  );

  return (
    <div className="espejo" ref={wrap} style={{ '--px': `${escala}px` } as CSSProperties}>
      <figure className="espejo__figura" style={{ width: ART_W * escala }}>
        <span className="maniqui__luz" aria-hidden="true" />
        <span className="maniqui__cable" aria-hidden="true" />
        <span className="maniqui__bombilla" aria-hidden="true" />
        <canvas
          ref={canvasRef}
          className="pixel espejo__canvas"
          role="img"
          aria-label={`Tu personaje ${NOMBRE_DIRECCION[direccion]} con ${describeOutfit(outfitOf(look))}`}
        />
      </figure>
      <div className="espejo__controles">
        <button type="button" className="chip" onClick={() => setGiro((g) => g + 1)}>
          <Icono name="girar" size={20} />
          Girar
        </button>
        <button
          type="button"
          className="chip"
          aria-pressed={caminando}
          onClick={() => setCaminando((c) => !c)}
        >
          <Icono name="caminar" size={20} />
          {caminando ? 'Parar' : 'Caminar'}
        </button>
      </div>
    </div>
  );
}
