import { EmailInput, PasswordInput } from '@wous/contracts';
import { type FormEvent, useEffect, useState } from 'react';
import { dropQueryParam, Link, ROUTES, useRouter } from '../../app/router.tsx';
import { useSession } from '../../app/session.tsx';
import { ApiError, api } from '../../services/api.ts';
import {
  Campo,
  CampoContrasena,
  erroresDeCampo,
  mensajeDeError,
  Verificacion,
} from '../../ui/components/Formulario.tsx';
import { Aviso, Cartulina, Hoja, Sello } from '../../ui/components/Tianguis.tsx';
import { Mostrador } from '../Mostrador.tsx';

/** /forgot-password — respuesta siempre igual, exista o no la cuenta (§6). */
export function OlvideContrasena() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [reinicio, setReinicio] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [errorCorreo, setErrorCorreo] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const enviar = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const parsed = EmailInput.safeParse(email);
    if (!parsed.success) {
      setErrorCorreo(parsed.error.issues[0]?.message);
      return;
    }
    setErrorCorreo(undefined);
    if (!token) {
      setError('Espera un segundo a que termine la verificación anti-bots y vuelve a enviar.');
      return;
    }
    setCargando(true);
    try {
      await api.post('/auth/forgot-password', { email: parsed.data, turnstileToken: token });
      setEnviado(true);
    } catch (err) {
      setError(mensajeDeError(err));
      setReinicio((n) => n + 1);
    } finally {
      setCargando(false);
    }
  };

  return (
    <Mostrador etiqueta={null}>
      <Hoja titulo="¿Olvidaste tu contraseña?" id="olvide-titulo">
        {enviado ? (
          <>
            <Sello>¡Enviado!</Sello>
            <p className="hoja__entrada">
              Si hay una cuenta activa con <strong className="hoja__dato">{email}</strong>, te
              llegará un enlace en unos minutos. Vale por 20 minutos y solo funciona una vez.
            </p>
            <p className="hoja__pie">
              <Link to={ROUTES.login} className="enlace">
                Regresar a entrar
              </Link>
            </p>
          </>
        ) : (
          <>
            <p className="hoja__entrada">
              Escribe tu correo y te mandamos un enlace para crear una contraseña nueva.
            </p>
            <form className="formulario" onSubmit={enviar} noValidate>
              <Campo
                etiqueta="Correo"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errorCorreo}
                required
              />
              <Verificacion accion="forgot" onToken={setToken} reinicio={reinicio} />
              {error ? <Aviso>{error}</Aviso> : null}
              <Cartulina type="submit" cargando={cargando}>
                Mandar enlace
              </Cartulina>
            </form>
            <p className="hoja__pie">
              ¿Ya te acordaste?{' '}
              <Link to={ROUTES.login} className="enlace">
                Entra aquí
              </Link>
            </p>
          </>
        )}
      </Hoja>
    </Mostrador>
  );
}

/** /reset-password?token=… — cambia la contraseña y cierra todas las sesiones. */
export function RestablecerContrasena() {
  const { location, navigate } = useRouter();
  const { refresh } = useSession();
  const [token] = useState(() => location.search.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [listo, setListo] = useState(false);
  const [errorCampo, setErrorCampo] = useState<string | undefined>();
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => dropQueryParam('token'), []);

  const enviar = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const parsed = PasswordInput.safeParse(password);
    if (!parsed.success) {
      setErrorCampo(parsed.error.issues[0]?.message);
      return;
    }
    setErrorCampo(undefined);
    setCargando(true);
    try {
      await api.post('/auth/reset-password', { token, password: parsed.data });
      setListo(true);
      await refresh();
    } catch (err) {
      setErrorCampo(erroresDeCampo(err).password);
      setError(err instanceof ApiError ? err : null);
    } finally {
      setCargando(false);
    }
  };

  const invalido = !token || error?.code === 'TOKEN_INVALID';

  return (
    <Mostrador etiqueta={null}>
      <Hoja
        titulo={listo ? 'Contraseña nueva, lista' : 'Crea tu contraseña nueva'}
        id="reset-titulo"
      >
        {listo ? (
          <>
            <Sello>¡Listo!</Sello>
            <p className="hoja__entrada">
              Cambiamos tu contraseña y, por seguridad, cerramos tu sesión en todos tus
              dispositivos.
            </p>
            <Cartulina type="button" onClick={() => navigate(ROUTES.login)}>
              Entrar con la nueva
            </Cartulina>
          </>
        ) : invalido ? (
          <>
            <Aviso>
              {token
                ? 'Este enlace ya no sirve: caducó o ya se usó.'
                : 'A este enlace le falta una parte. Ábrelo de nuevo desde el correo.'}
            </Aviso>
            <p className="hoja__entrada">
              <Link to={ROUTES.forgotPassword} className="enlace">
                Pide un enlace nuevo
              </Link>{' '}
              y úsalo antes de 20 minutos.
            </p>
          </>
        ) : (
          <form className="formulario" onSubmit={enviar} noValidate>
            <CampoContrasena
              etiqueta="Contraseña nueva"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errorCampo}
              ayuda="Mínimo 10 caracteres. No uses tu nombre de usuario ni tu correo."
              required
            />
            {error && error.code !== 'WEAK_PASSWORD' ? (
              <Aviso>{mensajeDeError(error)}</Aviso>
            ) : null}
            <Cartulina type="submit" cargando={cargando}>
              Guardar contraseña
            </Cartulina>
          </form>
        )}
      </Hoja>
    </Mostrador>
  );
}
