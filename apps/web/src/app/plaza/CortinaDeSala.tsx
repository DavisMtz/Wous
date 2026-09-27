import { gsap } from 'gsap';
import { useLayoutEffect, useRef, useState } from 'react';
import type { LonaColor } from '../../ui/components/Puesto.tsx';
import { OrillaDeLona, Rotulo } from '../../ui/components/Tianguis.tsx';
import { canAnimate } from '../../ui/motion.ts';

export type ContenidoCortina = {
  lona: LonaColor;
  /** A dónde vas («El Café»); sin destino, el rótulo de Wous (primera entrada). */
  destino: string | null;
  nota: string;
};

const ARRIBA = 'inset(0% 0% 100% 0%)';
const ABAJO = 'inset(0% 0% 0% 0%)';

/**
 * Entre sala y sala baja una lona (§17, «loading transitions»): cubre el
 * mundo mientras la sala nueva abre y se enrolla hacia arriba cuando ya está.
 * En la primera entrada ya está abajo; al cruzar una puerta, baja. Sin
 * movimiento (reducido o `?quieto`) solo aparece y desaparece.
 */
export function CortinaDeSala({
  cubre,
  contenido,
}: {
  cubre: boolean;
  contenido: ContenidoCortina;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [montada, setMontada] = useState(cubre);
  /** Mientras sube se sigue viendo lo que decía al cubrir, no la sala nueva. */
  const mostrado = useRef(contenido);
  if (cubre) mostrado.current = contenido;
  const inicial = useRef(cubre);

  useLayoutEffect(() => {
    if (cubre) setMontada(true);
  }, [cubre]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !montada) return;
    if (inicial.current && cubre) {
      // Primera entrada: la lona ya estaba abajo.
      inicial.current = false;
      return;
    }
    inicial.current = false;
    if (!canAnimate()) {
      if (!cubre) setMontada(false);
      return;
    }
    const tween = cubre
      ? gsap.fromTo(
          el,
          { clipPath: ARRIBA },
          { clipPath: ABAJO, duration: 0.38, ease: 'power3.in' },
        )
      : gsap.to(el, {
          clipPath: ARRIBA,
          duration: 0.62,
          delay: 0.12,
          ease: 'power3.inOut',
          onComplete: () => setMontada(false),
        });
    // Red de seguridad: con la pestaña en segundo plano los fotogramas se congelan.
    const safety = window.setTimeout(() => tween.progress(1), 1600);
    return () => {
      window.clearTimeout(safety);
      tween.kill();
    };
  }, [cubre, montada]);

  if (!montada) return null;
  const { lona, destino, nota } = mostrado.current;
  return (
    <div
      ref={ref}
      className="cortina-sala tela-lona"
      data-lona={lona}
      role="status"
      aria-live="polite"
      aria-busy={cubre}
    >
      <OrillaDeLona />
      <div className="cortina-sala__cuerpo">
        {destino ? (
          <p className="cortina-sala__destino">{destino}</p>
        ) : (
          <Rotulo className="rotulo--chico" />
        )}
        <p className="cortina-sala__nota">{nota}</p>
      </div>
    </div>
  );
}
