import { EmailInput } from '@wous/contracts';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, ROUTES } from '../../app/router.tsx';
import { api } from '../../services/api.ts';
import { Campo, mensajeDeError, Verificacion } from '../../ui/components/Formulario.tsx';
import { Icono } from '../../ui/components/Icono.tsx';
import { Aviso, Cartulina, Hoja, Sello } from '../../ui/components/Tianguis.tsx';
import { Mostrador } from '../Mostrador.tsx';

const COOLDOWN_S = 60;

function emailFromHistory(): string {
  const state: unknown = window.history.state;
  if (state && typeof state === 'object' && 'email' in state && typeof state.email === 'string') {
    return state.email;
  }
  return '';
}

export function RevisaCorreo() {
  const [inicial] = useState(emailFromHistory);
  const [email, setEmail] = useState(inicial);
  const [token, setToken] = useState<string | null>(null);
  const [reinicio, setReinicio] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [espera, setEspera] = useState(0);
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'error'; texto: string } | null>(null);
  const [errorCorreo, setErrorCorreo] = useState<string | undefined>();

  useEffect(() => {
    if (espera <= 0) return;
    const timer = window.setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [espera]);

  const reenviar = async (event: FormEvent) => {
    event.preventDefault();
    setAviso(null);
    const parsed = EmailInput.safeParse(email);
    if (!parsed.success) {
      setErrorCorreo(parsed.error.issues[0]?.message);
      return;
    }
    setErrorCorreo(undefined);
    if (!token) {
      setAviso({ tono: 'error', texto: 'Espera a que termine la verificación anti-bots.' });
      return;
    }
    setCargando(true);
    try {
      await api.post('/auth/resend-verification', { email: parsed.data, turnstileToken: token });
      setAviso({
        tono: 'ok',
        texto: 'Listo. Si tu cuenta sigue pendiente, te llegará un enlace nuevo en unos minutos.',
      });
      setEspera(COOLDOWN_S);
    } catch (err) {
      setAviso({ tono: 'error', texto: mensajeDeError(err) });
    } finally {
      setCargando(false);
      setReinicio((n) => n + 1);
    }
  };

  return (
    <Mostrador etiqueta={null}>
      <Hoja titulo="Revisa tu correo" id="revisa-titulo">
        <Sello>¡Enviado!</Sello>
        <p className="hoja__entrada">
          {inicial ? (
            <>
              Te mandamos un enlace a <strong className="hoja__dato">{inicial}</strong>.
            </>
          ) : (
            'Te mandamos un enlace a tu correo.'
          )}{' '}
          Ábrelo en los próximos 30 minutos para activar tu cuenta.
        </p>
        <ul className="hoja__pasos">
          <li>
            <Icono name="sobre" size={20} />
            <span>Busca un correo de Wous. Si no está, revisa spam o promociones.</span>
          </li>
          <li>
            <Icono name="palomita" size={20} />
            <span>Abre el enlace y toca «Confirmar mi correo».</span>
          </li>
        </ul>

        <form className="formulario formulario--separado" onSubmit={reenviar} noValidate>
          <h2 className="hoja__subtitulo">¿No llegó?</h2>
          <Campo
            etiqueta="Tu correo"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errorCorreo}
          />
          <Verificacion accion="resend" onToken={setToken} reinicio={reinicio} />
          {aviso ? <Aviso tono={aviso.tono}>{aviso.texto}</Aviso> : null}
          <Cartulina type="submit" variante="trazo" cargando={cargando} disabled={espera > 0}>
            {espera > 0 ? (
              <>
                Pide otro en <span className="tabular">{espera}</span> s
              </>
            ) : (
              'Mandar otro enlace'
            )}
          </Cartulina>
        </form>
        <p className="hoja__pie">
          ¿Escribiste mal tu correo?{' '}
          <Link to={ROUTES.register} className="enlace">
            Crea la cuenta de nuevo
          </Link>
        </p>
      </Hoja>
    </Mostrador>
  );
}
