import { type PendingVerificationResponse, RegisterRequest } from '@wous/contracts';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, ROUTES, useRouter } from '../../app/router.tsx';
import { useSession } from '../../app/session.tsx';
import { api } from '../../services/api.ts';
import {
  Campo,
  CampoContrasena,
  Casilla,
  erroresDeCampo,
  mensajeDeError,
  Verificacion,
} from '../../ui/components/Formulario.tsx';
import { Icono } from '../../ui/components/Icono.tsx';
import { Aviso, Cartulina, Hoja } from '../../ui/components/Tianguis.tsx';
import { fieldErrors, focusFirstError, Mostrador } from '../Mostrador.tsx';

export function Registro() {
  const { navigate } = useRouter();
  const { config } = useSession();
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [acepta, setAcepta] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [reinicio, setReinicio] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);

  useEffect(() => {
    if (Object.keys(errores).length > 0) focusFirstError(formRef.current);
  }, [errores]);

  const enviar = async (event: FormEvent) => {
    event.preventDefault();
    setGeneral(null);
    const parsed = RegisterRequest.safeParse({
      email,
      username,
      password,
      turnstileToken: token ?? 'pendiente',
      termsVersion: config?.termsVersion ?? '',
    });
    const locales = parsed.success ? {} : fieldErrors(parsed.error);
    if (!acepta) locales.terminos = 'Marca la casilla para crear tu cuenta.';
    if (!parsed.success || !acepta) {
      setErrores(locales);
      return;
    }
    if (!token) {
      setErrores({});
      setGeneral('Espera un segundo a que termine la verificación anti-bots y vuelve a enviar.');
      return;
    }

    setCargando(true);
    setErrores({});
    try {
      await api.post<PendingVerificationResponse>('/auth/register', {
        ...parsed.data,
        turnstileToken: token,
      });
      navigate(ROUTES.checkEmail, { state: { email: parsed.data.email } });
    } catch (err) {
      setErrores(erroresDeCampo(err));
      setGeneral(mensajeDeError(err));
      setReinicio((n) => n + 1);
    } finally {
      setCargando(false);
    }
  };

  return (
    <Mostrador etiqueta={username.trim() ? `@${username.trim()}` : ''}>
      <Hoja titulo="Crea tu cuenta" id="registro-titulo">
        <p className="hoja__entrada">
          Tu correo es para entrar y recuperar la cuenta. En la plaza solo se ve tu nombre.
        </p>
        <form ref={formRef} className="formulario" onSubmit={enviar} noValidate>
          <Campo
            etiqueta="Correo"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errores.email}
            required
          />
          <Campo
            etiqueta="Nombre de usuario"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={20}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            error={errores.username}
            ayuda="Así te verán en la plaza. De 3 a 20 letras sin acentos, números o guion bajo."
            required
          />
          <CampoContrasena
            etiqueta="Contraseña"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errores.password}
            ayuda="Mínimo 10 caracteres. Una frase corta es fácil de recordar y difícil de adivinar."
            required
          />
          <Casilla checked={acepta} onChange={setAcepta} error={errores.terminos}>
            Tengo 16 años o más y acepto las reglas de convivencia de la alpha.
          </Casilla>
          <details className="reglas" id="reglas">
            <summary>
              <Icono name="flecha" size={18} />
              Leer las reglas
            </summary>
            <ul>
              <li>
                Trata a todas las personas con respeto: nada de acoso, amenazas ni discriminación.
              </li>
              <li>
                No compartas datos personales tuyos ni de nadie: dirección, teléfono o contraseñas.
              </li>
              <li>
                Nada de contenido sexual, violento o ilegal en tu nombre, tu personaje o el chat.
              </li>
              <li>Wous está en alpha: puede fallar y el mundo puede reiniciarse.</li>
              <li>Las cuentas que rompan estas reglas pueden suspenderse.</li>
            </ul>
          </details>
          <Verificacion accion="register" onToken={setToken} reinicio={reinicio} />
          {general ? <Aviso>{general}</Aviso> : null}
          <Cartulina type="submit" cargando={cargando}>
            Crear mi cuenta
          </Cartulina>
        </form>
        <p className="hoja__pie">
          ¿Ya tienes cuenta?{' '}
          <Link to={ROUTES.login} className="enlace">
            Entra aquí
          </Link>
        </p>
      </Hoja>
    </Mostrador>
  );
}
