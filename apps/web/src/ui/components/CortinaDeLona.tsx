import { gsap } from 'gsap';
import { useLayoutEffect, useRef, useState } from 'react';
import { canAnimate } from '../motion.ts';
import type { LonaColor } from './Puesto.tsx';

/**
 * «Se corre la lona»: al cambiar de puesto, la lona anterior se enrolla hacia
 * arriba y deja ver la nueva. Es el movimiento firma entre pantallas. Nunca
 * tapa el contenido: si no se puede animar, simplemente no aparece.
 */
export function CortinaDeLona({ lona }: { lona: LonaColor }) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef<LonaColor>(lona);
  const [saliente, setSaliente] = useState<LonaColor | null>(null);

  useLayoutEffect(() => {
    document.documentElement.dataset.lona = lona;
    if (previous.current === lona) return;
    const old = previous.current;
    previous.current = lona;
    if (!canAnimate()) return;
    setSaliente(old);
  }, [lona]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!saliente || !el) return;
    const tween = gsap.fromTo(
      el,
      { clipPath: 'inset(0% 0% 0% 0%)' },
      {
        clipPath: 'inset(0% 0% 100% 0%)',
        duration: 0.62,
        ease: 'power3.inOut',
        onComplete: () => setSaliente(null),
      },
    );
    const safety = window.setTimeout(() => {
      tween.progress(1);
    }, 1200);
    return () => {
      window.clearTimeout(safety);
      tween.kill();
    };
  }, [saliente]);

  if (!saliente) return null;
  return <div ref={ref} className="cortina" data-lona={saliente} aria-hidden="true" />;
}
