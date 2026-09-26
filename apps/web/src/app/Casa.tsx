import type { SessionResponse } from '@wous/contracts';
import { useState } from 'react';
import { Mostrador } from '../auth/Mostrador.tsx';
import { mensajeDeError } from '../ui/components/Formulario.tsx';
import { Aviso, Cartulina, Hoja } from '../ui/components/Tianguis.tsx';
import { useSession } from './session.tsx';

/**
 * Con sesión iniciada. Hasta que llegue el creador de personaje (Fase 3) es
 * el vestíbulo de la cuenta: quién eres y cómo cerrar sesión.
 */
export function Casa({ session }: { session: SessionResponse }) {
  const { logout } = useSession();
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
    <Mostrador etiqueta={`@${session.account.username}`}>
      <Hoja titulo={`¡Qué onda, ${session.account.username}!`} id="casa-titulo">
        <p className="hoja__entrada">
          Tu cuenta ya está lista. Muy pronto vas a poder armar tu personaje aquí mismo y salir a la
          plaza.
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
