import {
  type InputHTMLAttributes,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { useSession } from '../../app/session.tsx';
import { ApiError } from '../../services/api.ts';
import { loadTurnstile, type TurnstileApi } from '../../services/turnstile.ts';
import { Icono } from './Icono.tsx';

type CampoProps = InputHTMLAttributes<HTMLInputElement> & {
  etiqueta: string;
  ayuda?: ReactNode;
  error?: string | undefined;
  accesorio?: ReactNode;
};

export function Campo({
  etiqueta,
  ayuda,
  error,
  accesorio,
  id,
  className = '',
  ...rest
}: CampoProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const ayudaId = ayuda ? `${inputId}-ayuda` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [errorId, ayudaId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`campo ${error ? 'campo--error' : ''} ${className}`}>
      <label htmlFor={inputId} className="campo__etiqueta">
        {etiqueta}
      </label>
      <div className="campo__caja">
        <input
          id={inputId}
          className="campo__entrada"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        {accesorio}
      </div>
      {error ? (
        <p id={errorId} className="campo__error">
          <Icono name="alerta" size={17} />
          <span>{error}</span>
        </p>
      ) : null}
      {ayuda ? (
        <p id={ayudaId} className="campo__ayuda">
          {ayuda}
        </p>
      ) : null}
    </div>
  );
}

export function CampoContrasena(props: Omit<CampoProps, 'type' | 'accesorio'>) {
  const [visible, setVisible] = useState(false);
  return (
    <Campo
      {...props}
      type={visible ? 'text' : 'password'}
      spellCheck={false}
      autoCapitalize="none"
      accesorio={
        <button
          type="button"
          className="campo__ver"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          <Icono name={visible ? 'ojo-tachado' : 'ojo'} />
        </button>
      }
    />
  );
}

type CasillaProps = {
  children: ReactNode;
  checked: boolean;
  onChange(checked: boolean): void;
  error?: string | undefined;
};

export function Casilla({ children, checked, onChange, error }: CasillaProps) {
  const id = useId();
  return (
    <div className={`casilla ${error ? 'casilla--error' : ''}`}>
      <input
        id={id}
        type="checkbox"
        className="casilla__entrada"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <label htmlFor={id} className="casilla__etiqueta">
        <svg className="casilla__caja" viewBox="0 0 26 26" aria-hidden="true">
          <path
            className="casilla__marco"
            d="M3.5 4.2c6.3-.9 12.6-.8 18.9-.3.6 6 .4 11.9-.2 17.9-6.2.6-12.3.6-18.5.1-.5-5.9-.6-11.8-.2-17.7Z"
          />
          <path className="casilla__palomita" d="m6.8 13.6 4.4 4.3 8.6-10.4" />
        </svg>
        <span>{children}</span>
      </label>
      {error ? (
        <p id={`${id}-error`} className="campo__error">
          <Icono name="alerta" size={17} />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

type VerificacionProps = {
  accion: 'register' | 'login' | 'resend' | 'forgot';
  onToken(token: string | null): void;
  /** Cambiarlo pide un token nuevo (los tokens son de un solo uso). */
  reinicio: number;
};

/** Turnstile de Cloudflare. El servidor verifica el token; aquí solo se pide. */
export function Verificacion({ accion, onToken, reinicio }: VerificacionProps) {
  const { config } = useSession();
  const ref = useRef<HTMLDivElement>(null);
  const widget = useRef<{ api: TurnstileApi; id: string } | null>(null);
  const tokenRef = useRef(onToken);
  tokenRef.current = onToken;
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !config) return;
    let cancelled = false;
    loadTurnstile()
      .then((api) => {
        if (cancelled || !ref.current) return;
        const id = api.render(ref.current, {
          sitekey: config.turnstileSiteKey,
          action: accion,
          theme: 'light',
          size: 'flexible',
          appearance: 'interaction-only',
          language: 'es',
          callback: (token) => tokenRef.current(token),
          'expired-callback': () => tokenRef.current(null),
          'error-callback': () => {
            tokenRef.current(null);
            setFallo(true);
          },
        });
        widget.current = { api, id };
      })
      .catch(() => setFallo(true));
    return () => {
      cancelled = true;
      if (widget.current) widget.current.api.remove(widget.current.id);
      widget.current = null;
    };
  }, [config, accion]);

  useEffect(() => {
    if (reinicio === 0 || !widget.current) return;
    tokenRef.current(null);
    widget.current.api.reset(widget.current.id);
  }, [reinicio]);

  return (
    <div className="verificacion">
      <div ref={ref} className="verificacion__widget" />
      {fallo ? (
        <p className="campo__error">
          <Icono name="alerta" size={17} />
          <span>
            No cargó la verificación anti-bots. Si usas un bloqueador, desactívalo para Wous y
            recarga la página.
          </span>
        </p>
      ) : null}
    </div>
  );
}

/** Mensaje para la persona según el código del error (nunca según el texto). */
export function mensajeDeError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Algo salió mal. Inténtalo de nuevo.';
  switch (error.code) {
    case 'RATE_LIMITED': {
      const seconds = error.retryAfterSeconds ?? 60;
      const minutes = Math.ceil(seconds / 60);
      return seconds < 90
        ? `Demasiados intentos. Espera ${seconds} segundos y vuelve a intentarlo.`
        : `Demasiados intentos. Espera unos ${minutes} minutos y vuelve a intentarlo.`;
    }
    case 'TURNSTILE_FAILED':
      return 'No pudimos comprobar que eres una persona. Espera a que la verificación termine y vuelve a enviar.';
    case 'ACCOUNT_SUSPENDED': {
      // Con fin conocido, el servidor dice cuánto falta (ADR-0012).
      if (error.retryAfterSeconds === undefined) {
        return 'Tu cuenta está suspendida. Revisa las reglas de convivencia.';
      }
      const hasta = new Intl.DateTimeFormat('es-MX', {
        day: 'numeric',
        month: 'long',
        hour: 'numeric',
        minute: '2-digit',
      }).format(Date.now() + error.retryAfterSeconds * 1000);
      return `Tu cuenta está suspendida hasta el ${hasta}.`;
    }
    case 'INVALID_REQUEST':
      return 'Revisa los campos marcados.';
    default:
      return error.message;
  }
}

/** Errores por campo que manda el servidor (si los hay). */
export function erroresDeCampo(error: unknown): Record<string, string> {
  return error instanceof ApiError ? error.fields : {};
}
