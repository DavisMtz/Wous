import { useGSAP } from '@gsap/react';
import { type ReactNode, useRef, useState } from 'react';
import type { z } from 'zod';
import { PERSONAS } from '../game/rendering/looks.ts';
import type { Look } from '../game/rendering/pixel-character.ts';
import { Puesto } from '../ui/components/Puesto.tsx';
import { entrance } from '../ui/motion.ts';
import { Maniqui } from '../ui/scene/Maniqui.tsx';

type Props = {
  children: ReactNode;
  /** Etiqueta que cuelga del maniquí (null = sin etiqueta). */
  etiqueta?: string | null;
  look?: Look;
};

/**
 * Pantalla de acceso: el maniquí en su huacal a un lado y la hoja colgada
 * del tendedero al otro. En el teléfono la hoja manda y el maniquí se va.
 */
export function Mostrador({ children, etiqueta = null, look }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [persona] = useState(
    () => look ?? PERSONAS[Math.floor(Math.random() * PERSONAS.length)] ?? PERSONAS[0],
  );

  useGSAP(
    () => {
      entrance(
        (tl) => {
          tl.from('.hoja', {
            y: -26,
            rotation: -2.5,
            opacity: 0,
            duration: 0.9,
            ease: 'back.out(1.6)',
          })
            .from('.pinza', { y: -14, opacity: 0, stagger: 0.08, duration: 0.4 }, '-=0.6')
            .from('.mostrador__maniqui', { y: 24, opacity: 0, duration: 0.7 }, 0.1);
        },
        { clear: ['.hoja', '.pinza', '.mostrador__maniqui'] },
      );
    },
    { scope: root },
  );

  return (
    <Puesto>
      <div className="mostrador" ref={root}>
        <div className="mostrador__maniqui">
          {persona ? <Maniqui look={look ?? persona} etiqueta={etiqueta} /> : null}
        </div>
        <div className="mostrador__hoja">{children}</div>
      </div>
    </Puesto>
  );
}

/** Errores de un esquema Zod como `{ campo: mensaje }` (el primero por campo). */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_');
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/** Lleva el foco al primer campo con error, en el orden del formulario. */
export function focusFirstError(form: HTMLFormElement | null) {
  const invalid = form?.querySelector<HTMLElement>('[aria-invalid="true"]');
  invalid?.focus();
}
