import { type PointerEvent, useRef } from 'react';
import type { TouchAdapter } from '../../game/input/adapters.ts';
import { TOUCH_CONTROL_ATTR } from '../../game/input/controls.ts';

/** Recorrido máximo de la perilla, en pixeles CSS. */
const RECORRIDO = 50;

/**
 * Joystick virtual (§11, móvil): un disco de papel con su perilla de
 * cartulina. Solo reporta un vector al TouchAdapter; el juego nunca sabe que
 * fue un dedo. Se mueve por ref, sin pasar por el estado de React.
 */
export function Joystick({ touch }: { touch: TouchAdapter }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLSpanElement>(null);
  const pointer = useRef<number | null>(null);

  const mover = (e: PointerEvent<HTMLDivElement>) => {
    const base = baseRef.current;
    const knob = knobRef.current;
    if (!base || !knob) return;
    const rect = base.getBoundingClientRect();
    let dx = e.clientX - (rect.left + rect.width / 2);
    let dy = e.clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > RECORRIDO) {
      dx = (dx / len) * RECORRIDO;
      dy = (dy / len) * RECORRIDO;
    }
    knob.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    touch.setVector(dx / RECORRIDO, dy / RECORRIDO);
  };

  const soltar = () => {
    pointer.current = null;
    if (knobRef.current) knobRef.current.style.transform = '';
    baseRef.current?.classList.remove('joystick--activo');
    touch.setVector(0, 0);
  };

  return (
    <div
      className="joystick"
      ref={baseRef}
      {...{ [TOUCH_CONTROL_ATTR]: '' }}
      aria-hidden="true"
      onPointerDown={(e) => {
        if (pointer.current !== null) return;
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.classList.add('joystick--activo');
        mover(e);
      }}
      onPointerMove={(e) => {
        if (e.pointerId === pointer.current) mover(e);
      }}
      onPointerUp={(e) => {
        if (e.pointerId === pointer.current) soltar();
      }}
      onPointerCancel={(e) => {
        if (e.pointerId === pointer.current) soltar();
      }}
      onLostPointerCapture={(e) => {
        if (e.pointerId === pointer.current) soltar();
      }}
    >
      <svg className="joystick__disco" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="55" className="joystick__papel" />
        <path
          className="joystick__trazo"
          d="M60 5.6c30.5-.4 54.9 24.1 54.4 54.7-.3 30.1-24.6 54.3-54.8 54.1C29.5 114.2 5.4 90 5.7 59.6 6 29.7 30 5.9 60 5.6Z"
        />
        <path
          className="joystick__flecha"
          d="m52 22 8-8 8 8M52 98l8 8 8-8M22 52l-8 8 8 8M98 52l8 8-8 8"
        />
      </svg>
      <span className="joystick__perilla" ref={knobRef} />
    </div>
  );
}
