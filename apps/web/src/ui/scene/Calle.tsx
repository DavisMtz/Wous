import { useEffect, useRef } from 'react';
import { randomLook, seeded } from '../../game/rendering/looks.ts';
import {
  type Direction,
  FRAME_H,
  FRAME_W,
  frameCanvas,
  type Look,
} from '../../game/rendering/pixel-character.ts';
import type { Frame } from '../../game/rendering/sprite-maps.ts';
import { canAnimate } from '../motion.ts';
import { pixelCanvas } from './pixel-canvas.ts';

const SCALE = 3;
const ART_H = 36;
const FRAME_MS = 150;

type Walker = {
  look: Look;
  x: number;
  lane: number;
  speed: number;
  direction: Extract<Direction, 'left' | 'right'>;
  phase: number;
};

function spawn(rng: () => number, artW: number, fromEdge: boolean): Walker {
  const direction = rng() < 0.5 ? 'left' : 'right';
  const x = fromEdge
    ? direction === 'right'
      ? -FRAME_W - rng() * 40
      : artW + rng() * 40
    : rng() * artW;
  return {
    look: randomLook(rng),
    x,
    lane: rng() < 0.5 ? 0 : 3,
    speed: 13 + rng() * 11,
    direction,
    phase: rng() * 4,
  };
}

/**
 * La calle al pie de cada puesto: gente en pixel que pasa. Es ambiente: queda
 * fuera del árbol de accesibilidad y no roba el foco.
 */
export function Calle() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rng = seeded(Date.now() % 100_000);
    let artW = Math.ceil(canvas.parentElement?.clientWidth ?? 800) / SCALE;
    let painter = pixelCanvas(canvas, Math.ceil(artW), ART_H, SCALE);
    const count = () => Math.max(3, Math.min(9, Math.floor(artW / 60)));
    let walkers: Walker[] = Array.from({ length: count() }, () => spawn(rng, artW, false));
    const animated = canAnimate();

    const draw = (elapsed: number) => {
      painter.clear();
      const ordered = [...walkers].sort((a, b) => a.lane - b.lane);
      for (const w of ordered) {
        // El reloj de rAF puede ir un pelo detrás de performance.now(): con
        // tiempo negativo el módulo daba -1 y el cuadro no existía.
        const step = Math.floor(Math.max(0, elapsed) / FRAME_MS + w.phase);
        const frame = (((step % 4) + 4) % 4) as Frame;
        painter.sprite(
          frameCanvas(w.look, w.direction, animated ? frame : 0),
          0,
          0,
          FRAME_W,
          FRAME_H,
          Math.round(w.x),
          w.lane,
        );
      }
    };

    if (!animated) {
      // Sin movimiento: gente parada, repartida a lo largo de la calle.
      walkers.forEach((w, i) => {
        w.x = ((i + 0.5) * artW) / walkers.length - FRAME_W / 2;
      });
      draw(0);
      return;
    }

    let raf = 0;
    let last = performance.now();
    const start = last;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      walkers = walkers.map((w) => {
        const x = w.x + (w.direction === 'right' ? 1 : -1) * w.speed * dt;
        const gone = w.direction === 'right' ? x > artW + 4 : x < -FRAME_W - 4;
        return gone ? spawn(rng, artW, true) : { ...w, x };
      });
      draw(now - start);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      artW = Math.ceil(entry.contentRect.width / SCALE);
      painter = pixelCanvas(canvas, artW, ART_H, SCALE);
      const wanted = count();
      while (walkers.length < wanted) walkers.push(spawn(rng, artW, true));
      walkers = walkers.slice(0, wanted);
    });
    if (canvas.parentElement) observer.observe(canvas.parentElement);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="calle" aria-hidden="true">
      <canvas ref={canvasRef} className="pixel calle__gente" />
    </div>
  );
}
