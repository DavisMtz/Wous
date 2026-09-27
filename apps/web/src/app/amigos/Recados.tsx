import type { FriendEntry } from '@wous/contracts';
import { useState } from 'react';
import { mensajeDeError } from '../../ui/components/Formulario.tsx';
import { Aviso, Cartulina } from '../../ui/components/Tianguis.tsx';
import { type AccionesDeBanda, haceCuanto, Retrato } from './piezas.tsx';

/** Espera y error de un pedido al servidor desde un recado. */
function usePedido() {
  const [espera, setEspera] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pedir = async (que: string, hacer: () => Promise<unknown>) => {
    setEspera(que);
    setError(null);
    try {
      await hacer();
      // Si salió bien, el recado desaparece con la lista nueva.
    } catch (err) {
      setError(mensajeDeError(err));
      setEspera(null);
    }
  };
  return { espera, error, pedir };
}

/** Un recado pegado con masking: quien te busca, con su respuesta a la mano. */
function Recado({
  entry,
  ahora,
  acciones,
  giro,
}: {
  entry: FriendEntry;
  ahora: number;
  acciones: AccionesDeBanda;
  giro: 'a' | 'b';
}) {
  const { espera, error, pedir } = usePedido();
  return (
    <li className={`recado recado--${giro}`}>
      <span className="recado__masking" aria-hidden="true" />
      <div className="recado__quien">
        <span className="retrato retrato--recado">
          <Retrato appearance={entry.appearance} escala={3} />
        </span>
        <p>
          <strong className="recado__nombre">{entry.displayName}</strong>
          <span className="recado__cuando">
            Te mandó solicitud {haceCuanto(entry.since, ahora)}
          </span>
        </p>
      </div>
      <div className="recado__botones">
        <Cartulina
          type="button"
          icono="corazon"
          cargando={espera === 'aceptar'}
          disabled={espera !== null}
          onClick={() => pedir('aceptar', () => acciones.aceptar(entry))}
        >
          Aceptar
        </Cartulina>
        <Cartulina
          type="button"
          variante="trazo"
          cargando={espera === 'rechazar'}
          disabled={espera !== null}
          onClick={() => pedir('rechazar', () => acciones.rechazar(entry))}
        >
          Ahora no
        </Cartulina>
      </div>
      {error ? <Aviso>{error}</Aviso> : null}
    </li>
  );
}

/** «Te buscan»: las solicitudes que esperan tu respuesta, cada una en su recado. */
export function TeBuscan({
  incoming,
  ahora,
  acciones,
}: {
  incoming: FriendEntry[];
  ahora: number;
  acciones: AccionesDeBanda;
}) {
  return (
    <section className="te-buscan" aria-labelledby="te-buscan">
      <h2 className="banda__letrero" id="te-buscan">
        Te buscan
      </h2>
      {incoming.length > 0 ? (
        <ul className="te-buscan__recados">
          {incoming.map((entry, i) => (
            <Recado
              key={entry.friendshipId}
              entry={entry}
              ahora={ahora}
              acciones={acciones}
              giro={i % 2 === 0 ? 'a' : 'b'}
            />
          ))}
        </ul>
      ) : (
        <p className="banda__sobre-lona">
          Nadie por ahora. Cuando alguien te mande solicitud, aquí aparece su recado.
        </p>
      )}
    </section>
  );
}

function Espera({
  entry,
  ahora,
  acciones,
}: {
  entry: FriendEntry;
  ahora: number;
  acciones: AccionesDeBanda;
}) {
  const { espera, error, pedir } = usePedido();
  return (
    <li className="espera">
      <span className="retrato retrato--chico">
        <Retrato appearance={entry.appearance} escala={2} />
      </span>
      <span className="espera__quien">
        <strong>{entry.displayName}</strong>
        <span>Se la mandaste {haceCuanto(entry.since, ahora)}</span>
      </span>
      <button
        type="button"
        className="banda__accion"
        disabled={espera !== null}
        aria-busy={espera !== null || undefined}
        onClick={() => pedir('cancelar', () => acciones.cancelar(entry))}
      >
        {espera ? 'Cancelando…' : 'Cancelar'}
      </button>
      {error ? (
        <div className="espera__error">
          <Aviso>{error}</Aviso>
        </div>
      ) : null}
    </li>
  );
}

/** Lo que mandaste y sigue sin respuesta, en un recado aparte. */
export function Esperando({
  outgoing,
  ahora,
  acciones,
}: {
  outgoing: FriendEntry[];
  ahora: number;
  acciones: AccionesDeBanda;
}) {
  if (outgoing.length === 0) return null;
  return (
    <section className="esperando" aria-labelledby="esperando-titulo">
      <span className="recado__masking" aria-hidden="true" />
      <h2 className="esperando__titulo" id="esperando-titulo">
        Esperando respuesta
      </h2>
      <ul className="esperando__lista">
        {outgoing.map((entry) => (
          <Espera key={entry.friendshipId} entry={entry} ahora={ahora} acciones={acciones} />
        ))}
      </ul>
    </section>
  );
}
