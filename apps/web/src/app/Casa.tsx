import type { SessionResponse } from '@wous/contracts';
import { useState } from 'react';
import { Mostrador } from '../auth/Mostrador.tsx';
import { lookFromAppearance } from '../game/rendering/appearance.ts';
import { mensajeDeError } from '../ui/components/Formulario.tsx';
import { Icono } from '../ui/components/Icono.tsx';
import { Aviso, Cartulina, Hoja } from '../ui/components/Tianguis.tsx';
import { useAmigos } from './amigos/useAmigos.ts';
import { Bloqueados } from './Bloqueados.tsx';
import { Link, ROUTES, useRouter } from './router.tsx';
import { useSession } from './session.tsx';

/**
 * Con sesión iniciada y personaje armado: el vestíbulo antes de la plaza.
 * Muestra tu personaje, tu cuenta, el camino a tu banda (con las solicitudes
 * nuevas en una calcomanía), a quién bloqueaste y cómo cerrar sesión.
 */
export function Casa({ session }: { session: SessionResponse }) {
  const { logout } = useSession();
  const { navigate } = useRouter();
  const [cargando, setCargando] = useState<'una' | 'todas' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Solo para la calcomanía de solicitudes nuevas; la lista vive en /friends.
  const amigos = useAmigos({ activo: session.character !== null });
  const nuevas = amigos.listas?.incoming.length ?? 0;

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
          Tu personaje ya está listo. En la plaza te encuentras con quien ande por ahí: platica,
          saluda con un gesto y cruza al Café.
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
        <Link to={ROUTES.friends} className="cartulina cartulina--trazo casa__banda">
          <Icono name="corazon" />
          <span className="cartulina__texto">Tu banda</span>
          {nuevas > 0 ? (
            <span className="casa__nuevas">
              {nuevas === 1 ? '1 nueva' : `${nuevas} nuevas`}
              <span className="visually-hidden">
                {nuevas === 1 ? ' solicitud de amistad' : ' solicitudes de amistad'}
              </span>
            </span>
          ) : null}
        </Link>
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
        {session.character ? <Bloqueados /> : null}
      </Hoja>
    </Mostrador>
  );
}
