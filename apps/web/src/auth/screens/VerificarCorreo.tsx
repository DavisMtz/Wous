import type { SessionResponse } from '@wous/contracts';
import { useEffect, useState } from 'react';
import { dropQueryParam, Link, ROUTES, useRouter } from '../../app/router.tsx';
import { useSession } from '../../app/session.tsx';
import { ApiError, api } from '../../services/api.ts';
import { mensajeDeError } from '../../ui/components/Formulario.tsx';
import { Aviso, Cartulina, Hoja, Sello } from '../../ui/components/Tianguis.tsx';
import { Mostrador } from '../Mostrador.tsx';

/**
 * /verify-email?token=… — el enlace del correo NO se consume al abrirlo: los
 * escáneres de correo visitan enlaces. La persona confirma con un botón (§6).
 */
export function VerificarCorreo() {
  const { location, navigate } = useRouter();
  const { setSession } = useSession();
  const [token] = useState(() => location.search.get('token') ?? '');
  const [cargando, setCargando] = useState(false);
  const [listo, setListo] = useState<SessionResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  // El token sale de la barra de direcciones en cuanto se lee.
  useEffect(() => dropQueryParam('token'), []);

  const confirmar = async () => {
    setCargando(true);
    setError(null);
    try {
      const session = await api.post<SessionResponse>('/auth/verify-email', { token });
      setListo(session);
      setSession(session);
    } catch (err) {
      setError(err instanceof ApiError ? err : null);
    } finally {
      setCargando(false);
    }
  };

  if (listo) {
    return (
      <Mostrador etiqueta={`@${listo.account.username}`}>
        <Hoja titulo="¡Ya eres del barrio!" id="verificar-titulo">
          <Sello>¡Confirmado!</Sello>
          <p className="hoja__entrada">
            Tu correo quedó confirmado y ya entraste. Lo que sigue: armar tu personaje.
          </p>
          <Cartulina type="button" onClick={() => navigate(ROUTES.home)}>
            Armar mi personaje
          </Cartulina>
        </Hoja>
      </Mostrador>
    );
  }

  const invalido = error?.code === 'TOKEN_INVALID' || error?.code === 'INVALID_REQUEST' || !token;

  return (
    <Mostrador etiqueta={null}>
      <Hoja titulo="Confirma tu correo" id="verificar-titulo">
        {invalido ? (
          <>
            <Aviso>
              {token
                ? 'Este enlace ya no sirve: caducó o ya se usó.'
                : 'A este enlace le falta una parte. Ábrelo de nuevo desde el correo.'}
            </Aviso>
            <p className="hoja__entrada">
              Pide uno nuevo desde{' '}
              <Link to={ROUTES.checkEmail} className="enlace">
                reenviar el correo
              </Link>
              . Si ya confirmaste antes, solo{' '}
              <Link to={ROUTES.login} className="enlace">
                entra a tu cuenta
              </Link>
              .
            </p>
          </>
        ) : (
          <>
            <p className="hoja__entrada">Un paso más: confirma que este correo es tuyo.</p>
            {error ? <Aviso>{mensajeDeError(error)}</Aviso> : null}
            <Cartulina type="button" cargando={cargando} onClick={confirmar}>
              Confirmar mi correo
            </Cartulina>
          </>
        )}
      </Hoja>
    </Mostrador>
  );
}
