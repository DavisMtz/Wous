import { useEffect, useId, useRef, useState } from 'react';
import type { Presente } from '../../game/hud-store.ts';
import { Icono } from '../../ui/components/Icono.tsx';

/**
 * «3 personas aquí»: la nota del letrero se abre en la lista de quién está.
 * Es el camino por teclado a la ficha de alguien que no ha dicho nada (por
 * ejemplo, para reportar un nombre). Solo hay lista cuando hay alguien más.
 */
export function GenteAqui({
  nota,
  presentes,
  bloqueados,
  onElegir,
}: {
  nota: string;
  presentes: readonly Presente[];
  bloqueados: readonly string[];
  onElegir: (presente: Presente) => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const listaId = useId();
  const cajaRef = useRef<HTMLDivElement>(null);

  // Se cierra con Esc o al tocar fuera.
  useEffect(() => {
    if (!abierta) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierta(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (!cajaRef.current?.contains(e.target as Node)) setAbierta(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [abierta]);

  if (presentes.length === 0) {
    return (
      <p className="letrero__nota" aria-live="polite">
        {nota}
      </p>
    );
  }
  return (
    <div className="gente" ref={cajaRef}>
      <button
        type="button"
        className="letrero__nota gente__boton"
        onMouseDown={(e) => e.preventDefault()}
        aria-expanded={abierta}
        aria-controls={listaId}
        onClick={() => setAbierta((v) => !v)}
      >
        <Icono name="gente" size={16} />
        <span aria-live="polite">{nota}</span>
      </button>
      {abierta ? (
        <ul className="gente__lista" id={listaId}>
          {presentes.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="gente__persona"
                onMouseDown={(e) => e.preventDefault()}
                aria-haspopup="dialog"
                onClick={() => {
                  setAbierta(false);
                  onElegir(p);
                }}
              >
                <span>{p.nombre}</span>
                {bloqueados.includes(p.id) ? (
                  <Icono
                    name="globo-tachado"
                    size={16}
                    aria-hidden={false}
                    role="img"
                    aria-label="con bloqueo"
                  />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
