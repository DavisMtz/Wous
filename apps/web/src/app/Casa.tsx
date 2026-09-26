import type { SessionResponse } from '@wous/contracts';
import { useState } from 'react';
import { Mostrador } from '../auth/Mostrador.tsx';
import { lookFromAppearance } from '../game/rendering/appearance.ts';
import { mensajeDeError } from '../ui/components/Formulario.tsx';
import { Aviso, Cartulina, Hoja } from '../ui/components/Tianguis.tsx';
import { ROUTES, useRouter } from './router.tsx';
import { useSession } from './session.tsx';

/**
 * Con sesión iniciada y personaje armado: el vestíbulo antes de la plaza
 * (Fase 4). Muestra tu personaje, tu cuenta y cómo cerrar sesión.
 */
export function Casa({ session }: { session: SessionResponse }) {
  const { logout } = useSession();
  const { navigate } = useRouter();
  const [cargando, setCargando] = useState<'una' | 'todas' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const salir = async (everywhere: boolean) => {
    setCargando(everywhere ? 'todas' : 'una');
    setError(null);
    try {
      await logout({ everywhere });
    } catch (err) {
      setError(mensajeDeError(err));
      setCargando(null);
    }
  };

  return (
    <Mostrador
      etiqueta={session.character?.displayName ?? `@${session.account.username}`}
      {...(session.character ? { look: lookFromAppearance(session.character.appearance) } : {})}
    >
      <Hoja
        titulo={`¡Qué onda, ${session.character?.displayName ?? session.account.username}!`}
        id="casa-titulo"
      >
        <p className="hoja__entrada">
          Tu personaje ya está listo. En la plaza ya puedes caminar entre los puestos; muy pronto
          también vas a ver a los demás y platicar con ellos.
        </p>
        <dl className="hoja__datos">
          <div>
            <dt>Correo</dt>
            <dd>{session.account.email}</dd>
          </div>
          <div>
            <dt>En Wous desde</dt>
            <dd>
              {new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' }).format(
                session.account.createdAt,
              )}
            </dd>
          </div>
        </dl>
        {error ? <Aviso>{error}</Aviso> : null}
        <Cartulina
          type="button"
          icono="caminar"
          className="casa__plaza"
          onClick={() => navigate(ROUTES.plaza)}
        >
          Salir a la plaza
        </Cartulina>
        <div className="hoja__acciones">
          <Cartulina
            type="button"
            variante="trazo"
            icono="salir"
            cargando={cargando === 'una'}
            onClick={() => salir(false)}
          >
            Cerrar sesión
          </Cartulina>
          <Cartulina
            type="button"
            variante="trazo"
            cargando={cargando === 'todas'}
            onClick={() => salir(true)}
          >
            Cerrar sesión en todos lados
          </Cartulina>
        </div>
      </Hoja>
    </Mostrador>
  );
}
