import type { BlockedPerson, BlockListResponse } from '@wous/contracts';
import { useEffect, useState } from 'react';
import { lookFromAppearance } from '../game/rendering/appearance.ts';
import { api } from '../services/api.ts';
import { mensajeDeError } from '../ui/components/Formulario.tsx';
import { Aviso, Cartulina } from '../ui/components/Tianguis.tsx';
import { Miniatura, RECORTES } from '../ui/scene/Miniatura.tsx';

const FECHA = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long' });

/**
 * Personas que bloqueaste (ADR-0010), en la casa. Se bloquea en la plaza
 * (tocando a la persona o su nombre en el chat); aquí se ve la lista y se
 * desbloquea. Sin bloqueos, la nota enseña dónde se hace.
 */
export function Bloqueados() {
  const [lista, setLista] = useState<BlockedPerson[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quitando, setQuitando] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    api
      .get<BlockListResponse>('/blocks')
      .then((data) => {
        if (vivo) setLista(data.blocked);
      })
      .catch((err: unknown) => {
        if (vivo) setError(mensajeDeError(err));
      });
    return () => {
      vivo = false;
    };
  }, []);

  const quitar = async (persona: BlockedPerson) => {
    setQuitando(persona.characterId);
    setError(null);
    try {
      await api.del(`/blocks/${encodeURIComponent(persona.characterId)}`);
      setLista((actual) => actual?.filter((p) => p.characterId !== persona.characterId) ?? null);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setQuitando(null);
    }
  };

  return (
    <section className="bloqueados hoja__pie" aria-labelledby="bloqueados-titulo">
      <h2 className="hoja__subtitulo" id="bloqueados-titulo">
        Personas que bloqueaste
      </h2>
      {lista === null && !error ? <p className="bloqueados__nota">Revisando…</p> : null}
      {lista?.length === 0 ? (
        <p className="bloqueados__nota">
          Nadie por ahora. Si alguien te molesta en la plaza, toca a esa persona (o su nombre en el
          chat) para reportarla o bloquearla.
        </p>
      ) : null}
      {lista && lista.length > 0 ? (
        <ul className="bloqueados__lista">
          {lista.map((persona) => (
            <li key={persona.characterId} className="bloqueados__persona">
              <span className="bloqueados__retrato">
                <Miniatura
                  look={lookFromAppearance(persona.appearance)}
                  recorte={RECORTES.cabeza}
                  escala={2}
                />
              </span>
              <span className="bloqueados__quien">
                <span className="bloqueados__nombre">{persona.displayName}</span>
                <span className="bloqueados__fecha">
                  Desde el {FECHA.format(persona.blockedAt)}
                </span>
              </span>
              <Cartulina
                type="button"
                variante="trazo"
                className="bloqueados__quitar"
                cargando={quitando === persona.characterId}
                onClick={() => quitar(persona)}
              >
                Desbloquear
              </Cartulina>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <Aviso>{error}</Aviso> : null}
    </section>
  );
}
