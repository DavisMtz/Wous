import { gsap } from 'gsap';

/**
 * Reglas del movimiento en Wous (lecciones de otros proyectos):
 * - Nada nace invisible en el CSS: el estado por defecto es el final.
 * - Sin movimiento reducido ni pestaña visible, no se anima: se ve y ya.
 * - Toda entrada tiene red de seguridad: si no termina (pestaña en segundo
 *   plano congela los fotogramas), se fuerza su estado final.
 * - `clearProps` al terminar: un transform en línea que sobrevive gana al CSS
 *   y anula el :active de los botones.
 */

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function canAnimate(): boolean {
  if (document.documentElement.dataset.quieto !== undefined) return false;
  return !prefersReducedMotion() && document.visibilityState === 'visible';
}

/**
 * Línea de tiempo de entrada con red de seguridad. `build` añade `from()` que
 * parten de un estado distinto al natural; al acabar (o forzarse) se limpian.
 */
export function entrance(
  build: (tl: gsap.core.Timeline) => void,
  options: { maxMs?: number; clear?: gsap.TweenTarget } = {},
): gsap.core.Timeline | null {
  if (!canAnimate()) return null;
  const tl = gsap.timeline({ defaults: { ease: 'expo.out', duration: 0.8 } });
  build(tl);

  const finish = () => {
    if (tl.progress() < 1) tl.progress(1);
  };
  const timer = window.setTimeout(finish, options.maxMs ?? 2800);
  const onVisibility = () => {
    if (document.hidden) finish();
  };
  document.addEventListener('visibilitychange', onVisibility);
  tl.eventCallback('onComplete', () => {
    window.clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisibility);
    if (options.clear) gsap.set(options.clear, { clearProps: 'transform,opacity,clipPath,filter' });
  });
  return tl;
}
