import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { describeOutfit, type Outfit, outfitOf, wear } from '../../game/rendering/looks.ts';
import { FRAME_H, FRAME_W, frameCanvas, type Look } from '../../game/rendering/pixel-character.ts';
import { canAnimate } from '../motion.ts';
import { fitScale, pixelCanvas } from './pixel-canvas.ts';

/** Escena en pixeles de arte: foco, huacal con la persona y perchero. */
const ART_W = 150;
const ART_H = 104;
const HANGER_X = [66, 88, 110, 132];
const HOOK_Y = 34;
const HANGER_BAR_Y = 46;
const PERSON = { x: 12, y: 57 };
const BULB = { x: 20, y: 23 };

const WIRE = '#dcd6df';
const WIRE_SHADE = '#8d8594';
const METAL = '#bdb6c4';
const METAL_SHADE = '#6f6778';
const WOOD = '#cf8a4a';
const WOOD_SHADE = '#8f5424';
const WOOD_GAP = '#4a2716';

function drawBackdrop(canvas: HTMLCanvasElement, scale: number) {
  const p = pixelCanvas(canvas, ART_W, ART_H, scale);
  p.clear();

  // Socket y foco pelón (el cable y el halo van en CSS: no se recortan).
  p.rect(19, 18, 3, 3, '#3b3340');
  p.rect(18, 21, 5, 4, '#fff2b8');
  p.rect(19, 25, 3, 1, '#ffd766');
  p.rect(19, 22, 1, 2, '#ffffff');

  // Sombra del huacal en el piso.
  p.ctx.fillStyle = 'rgb(43 18 56 / 0.28)';
  p.ctx.beginPath();
  p.ctx.ellipse(20 * p.unit, 101 * p.unit, 18 * p.unit, 2.5 * p.unit, 0, 0, Math.PI * 2);
  p.ctx.fill();

  // Huacal de madera: tablas con rendijas.
  p.rect(6, 88, 28, 12, WOOD_GAP);
  for (const y of [88, 92, 96]) {
    p.rect(6, y, 28, 3, WOOD);
    p.rect(6, y + 2, 28, 1, WOOD_SHADE);
  }
  p.rect(6, 88, 2, 12, WOOD_SHADE);
  p.rect(32, 88, 2, 12, WOOD_SHADE);

  // Perchero: dos postes, tubo y patas.
  for (const x of [50, 146]) {
    p.rect(x, 38, 2, 62, METAL);
    p.rect(x + 1, 38, 1, 62, METAL_SHADE);
  }
  p.rect(46, 100, 10, 2, METAL_SHADE);
  p.rect(142, 100, 8, 2, METAL_SHADE);
  p.rect(48, 38, 102, 2, METAL);
  p.rect(48, 39, 102, 1, METAL_SHADE);
}

function drawHanger(canvas: HTMLCanvasElement, outfit: Outfit, person: Look, scale: number) {
  // Lienzo local de 18×30: gancho arriba, ropa colgando del travesaño.
  const p = pixelCanvas(canvas, 18, 30, scale);
  p.clear();
  // Gancho que abraza el tubo.
  p.rect(8, 0, 2, 1, WIRE);
  p.rect(10, 1, 1, 2, WIRE);
  p.rect(8, 3, 2, 1, WIRE_SHADE);
  p.rect(8, 4, 1, 4, WIRE);
  // Triángulo del gancho.
  for (let i = 0; i < 5; i++) {
    p.rect(8 - i - 1, 8 + i, 1, 1, WIRE);
    p.rect(9 + i + 1, 8 + i, 1, 1, WIRE_SHADE);
  }
  p.rect(2, HANGER_BAR_Y - HOOK_Y, 14, 1, WIRE_SHADE);
  // Ropa sola, con el hombro (fila 14 del sprite) en el travesaño.
  const clothes = frameCanvas(wear(person, outfit), 'down', 0, { clothesOnly: true });
  p.sprite(clothes, 0, 0, FRAME_W, FRAME_H, 1, HANGER_BAR_Y - HOOK_Y - 14);
}

function drawPerson(canvas: HTMLCanvasElement, look: Look, scale: number, blink: boolean) {
  const p = pixelCanvas(canvas, FRAME_W, FRAME_H, scale);
  p.clear();
  p.sprite(frameCanvas(look, 'down', 0, { blink }), 0, 0, FRAME_W, FRAME_H, 0, 0);
}

type Props = {
  persona: Look;
  outfits: Outfit[];
  /** Avisa el look nuevo (para que la portada lo refleje en otros lugares). */
  onChange?: (look: Look) => void;
};

/**
 * El perchero de la portada. Descolgar un gancho cambia el look completo:
 * la ropa que traías regresa a ese gancho (la firma de la dirección visual).
 */
export function Perchero({ persona, outfits, onChange }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLCanvasElement>(null);
  const personRef = useRef<HTMLCanvasElement>(null);
  const hangerRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const hangerButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const [scale, setScale] = useState(3);
  const [look, setLook] = useState(persona);
  const [hanging, setHanging] = useState(outfits);
  const [blink, setBlink] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(fitScale(entry.contentRect.width, ART_W, 2, 5));
    });
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (backdropRef.current) drawBackdrop(backdropRef.current, scale);
  }, [scale]);

  useLayoutEffect(() => {
    hanging.forEach((outfit, i) => {
      const canvas = hangerRefs.current[i];
      if (canvas) drawHanger(canvas, outfit, look, scale);
    });
  }, [hanging, look, scale]);

  useLayoutEffect(() => {
    if (personRef.current) drawPerson(personRef.current, look, scale, blink);
  }, [look, scale, blink]);

  // Parpadeo ocasional: vida mínima sin gastar fotogramas.
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
        2600 + Math.random() * 3200,
      );
    };
    loop();
    return () => window.clearTimeout(timer);
  }, []);

  const { contextSafe } = useGSAP({ scope: wrapRef });

  const tryOn = contextSafe((index: number) => {
    const outfit = hanging[index];
    if (!outfit) return;
    const next = wear(look, outfit);
    const swap = () => {
      setHanging((current) => current.map((o, i) => (i === index ? outfitOf(look) : o)));
      setLook(next);
      onChange?.(next);
      setAnnouncement(`Ahora traes ${describeOutfit(outfit)}.`);
    };

    if (!canAnimate()) {
      swap();
      return;
    }
    const hanger = hangerButtons.current[index];
    const person = personRef.current;
    const tl = gsap.timeline();
    if (hanger) {
      tl.fromTo(
        hanger,
        { rotation: index % 2 === 0 ? -16 : 16 },
        { rotation: 0, duration: 1.1, ease: 'elastic.out(1, 0.32)', clearProps: 'transform' },
        0,
      );
    }
    if (person) {
      tl.to(person, { y: -3 * scale, scaleY: 1.04, duration: 0.14, ease: 'power2.out' }, 0)
        .add(swap, 0.14)
        .to(person, { y: 0, scaleY: 0.94, duration: 0.12, ease: 'power2.in' }, 0.14)
        .to(person, { scaleY: 1, duration: 0.34, ease: 'back.out(3)', clearProps: 'transform' });
    } else {
      swap();
    }
  });

  const style = { '--px': `${scale}px` } as CSSProperties;

  return (
    <div className="perchero" ref={wrapRef}>
      <div className="perchero__escena" style={style}>
        <span
          className="perchero__luz"
          aria-hidden="true"
          style={{ left: `calc(var(--px) * ${BULB.x + 0.5})`, top: `calc(var(--px) * ${BULB.y})` }}
        />
        <span
          className="perchero__cable"
          aria-hidden="true"
          style={{ left: `calc(var(--px) * ${BULB.x})`, height: `calc(var(--px) * 18 + 60vh)` }}
        />
        <canvas ref={backdropRef} className="pixel perchero__fondo" />
        <canvas
          ref={personRef}
          className="pixel perchero__persona"
          role="img"
          aria-label={`Tu personaje con ${describeOutfit(outfitOf(look))}`}
          style={{ left: `calc(var(--px) * ${PERSON.x})`, top: `calc(var(--px) * ${PERSON.y})` }}
        />
        {hanging.map((outfit, i) => (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: los ganchos son posiciones fijas del perchero
            key={i}
            ref={(el) => {
              hangerButtons.current[i] = el;
            }}
            type="button"
            className="perchero__gancho"
            style={
              {
                left: `calc(var(--px) * ${(HANGER_X[i] ?? 0) - 9})`,
                top: `calc(var(--px) * ${HOOK_Y})`,
                '--retraso': `${-i * 1.3}s`,
              } as CSSProperties
            }
            onClick={() => tryOn(i)}
            aria-label={`Probarte ${describeOutfit(outfit)}`}
          >
            <canvas
              ref={(el) => {
                hangerRefs.current[i] = el;
              }}
              className="pixel"
            />
          </button>
        ))}
        <p className="perchero__letrero" aria-hidden="true">
          ¡Pruébatelo!
        </p>
      </div>
      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
