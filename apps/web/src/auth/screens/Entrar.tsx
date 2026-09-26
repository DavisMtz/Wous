import { LoginRequest, type SessionResponse } from '@wous/contracts';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, ROUTES, useRouter } from '../../app/router.tsx';
import { useSession } from '../../app/session.tsx';
import { ApiError, api } from '../../services/api.ts';
import {
  Campo,
  CampoContrasena,
  erroresDeCampo,
  mensajeDeError,
  Verificacion,
} from '../../ui/components/Formulario.tsx';
import { Aviso, Cartulina, Hoja } from '../../ui/components/Tianguis.tsx';
import { fieldErrors, focusFirstError, Mostrador } from '../Mostrador.tsx';

export function Entrar() {
  const { navigate } = useRouter();
  const { setSession } = useSession();
  const formRef = useRef<HTMLFormElement>(null);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [reinicio, setReinicio] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (Object.keys(errores).length > 0) focusFirstError(formRef.current);
  }, [errores]);

  const enviar = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const parsed = LoginRequest.safeParse({
      login,
      password,
      turnstileToken: token ?? 'pendiente',
    });
    if (!parsed.success) {
      setErrores(fieldErrors(parsed.error));
      return;
    }
    setErrores({});
    if (!token) {
      setError(new Error('turnstile'));
      return;
    }
    setCargando(true);
    try {
      const session = await api.post<SessionResponse>('/auth/login', {
        ...parsed.data,
        turnstileToken: token,
      });
      setSession(session);
      navigate(ROUTES.home);
    } catch (err) {
      setErrores(erroresDeCampo(err));
      setError(err);
      setReinicio((n) => n + 1);
    } finally {
      setCargando(false);
    }
  };

  const sinVerificar = error instanceof ApiError && error.code === 'EMAIL_NOT_VERIFIED';

  return (
    <Mostrador etiqueta={null}>
      <Hoja titulo="¿Qué onda? Entra" id="entrar-titulo">
        <form ref={formRef} className="formulario" onSubmit={enviar} noValidate>
          <Campo
            etiqueta="Correo o nombre de usuario"
            name="login"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            error={errores.login}
            required
          />
          <CampoContrasena
            etiqueta="Contraseña"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errores.password}
            required
          />
          <p className="formulario__extra">
            <Link to={ROUTES.forgotPassword} className="enlace">
              Olvidé mi contraseña
            </Link>
          </p>
          <Verificacion accion="login" onToken={setToken} reinicio={reinicio} />
          {sinVerificar ? (
            <Aviso>
              Te falta confirmar tu correo.{' '}
              <Link
                to={ROUTES.checkEmail}
                className="enlace"
                onClick={(event) => {
                  event.preventDefault();
                  navigate(ROUTES.checkEmail, {
                    state: { email: login.includes('@') ? login : '' },
                  });
                }}
              >
                Mándame otro enlace
              </Link>
            </Aviso>
          ) : error ? (
            <Aviso>
              {error instanceof ApiError
                ? mensajeDeError(error)
                : 'Espera un segundo a que termine la verificación anti-bots y vuelve a enviar.'}
            </Aviso>
          ) : null}
          <Cartulina type="submit" cargando={cargando}>
            Entrar
          </Cartulina>
        </form>
        <p className="hoja__pie">
          ¿Nuevo en Wous?{' '}
          <Link to={ROUTES.register} className="enlace">
            Crea tu cuenta
          </Link>
        </p>
      </Hoja>
    </Mostrador>
  );
}
