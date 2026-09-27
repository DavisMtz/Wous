import '../../ui/styles/amigos.css';
import { useMemo, useState } from 'react';
import { Puesto } from '../../ui/components/Puesto.tsx';
import { Banda } from './Banda.tsx';
import type { AccionesDeBanda } from './piezas.tsx';
import { useAmigos } from './useAmigos.ts';

/**
 * `/friends`: tu banda (ADR-0011). A esta página llegan los correos de
 * amistad y el enlace de la casa. Solo con sesión y personaje (lo cuida App).
 */
export function Amigos() {
  const amigos = useAmigos();
  const [anuncio, setAnuncio] = useState('');
  const [ahora] = useState(() => Date.now());

  const acciones = useMemo<AccionesDeBanda>(
    () => ({
      aceptar: async (entry) => {
        await amigos.aceptar(entry);
        setAnuncio(`${entry.displayName} ya es de tu banda.`);
      },
      rechazar: async (entry) => {
        await amigos.rechazar(entry);
        setAnuncio(`No aceptaste la solicitud de ${entry.displayName}.`);
      },
      cancelar: async (entry) => {
        await amigos.quitar(entry);
        setAnuncio(`Cancelaste tu solicitud a ${entry.displayName}.`);
      },
      quitar: (entry) => amigos.quitar(entry),
      bloquear: (entry) => amigos.bloquear(entry),
    }),
    [amigos],
  );

  return (
    <Puesto>
      <Banda
        listas={amigos.listas}
        error={amigos.error}
        acciones={acciones}
        ahora={ahora}
        onReintentar={() => void amigos.recargar()}
        onHecho={setAnuncio}
      />
      <p className="visually-hidden" aria-live="polite">
        {anuncio}
      </p>
    </Puesto>
  );
}
