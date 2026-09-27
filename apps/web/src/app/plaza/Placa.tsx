import { useEffect } from 'react';
import type { PlacaAbierta } from '../../game/hud-store.ts';
import { Icono } from '../../ui/components/Icono.tsx';

/**
 * Lo que dice una placa o un letrero del mundo (ADR-0013), copiado en una
 * cartulina pegada con masking. No toma el foco: se sigue caminando con el
 * teclado, y se cierra con E otra vez, con Esc, con el botón o al alejarse.
 */
export function Placa({ placa, onCerrar }: { placa: PlacaAbierta; onCerrar(): void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCerrar]);

  const tituloId = `placa-${placa.id}`;
  return (
    <aside className="placa" aria-labelledby={tituloId} aria-live="polite">
      <span className="placa__masking" aria-hidden="true" />
      <button
        type="button"
        className="placa__cerrar"
        aria-label="Cerrar la placa"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onCerrar}
      >
        <Icono name="cerrar" size={20} />
      </button>
      <h2 className="placa__titulo" id={tituloId}>
        {placa.titulo}
      </h2>
      {placa.texto.map((parrafo) => (
        <p key={parrafo} className="placa__texto">
          {parrafo}
        </p>
      ))}
    </aside>
  );
}
