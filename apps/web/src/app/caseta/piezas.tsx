import type {
  AccountStatus,
  AdminPerson,
  InvitationStatus,
  ReportReason,
  ReportStatus,
} from '@wous/contracts';
import { useCallback, useState } from 'react';
import { mensajeDeError } from '../../ui/components/Formulario.tsx';
import { Retrato } from '../amigos/piezas.tsx';

/**
 * Piezas comunes de la caseta (ADR-0012): cómo se nombra cada estado, el
 * retrato de una persona y las fechas. La caseta habla de la gente en
 * tercera persona; la plaza, a quien reporta.
 */

export const MOTIVO: Record<ReportReason, string> = {
  HARASSMENT: 'Molestia o acoso',
  HATE: 'Odio o discriminación',
  SEXUAL: 'Contenido sexual',
  SPAM: 'Spam o mensajes repetidos',
  IMPERSONATION: 'Se hace pasar por alguien',
  OTHER: 'Otra cosa',
};

export const ESTADO_CUENTA: Record<AccountStatus, string> = {
  ACTIVE: 'Activa',
  PENDING_EMAIL: 'Sin confirmar correo',
  SUSPENDED: 'Suspendida',
  BANNED: 'Cerrada',
  DELETED: 'Borrada',
};

export const ESTADO_REPORTE: Record<ReportStatus, string> = {
  OPEN: 'Abierto',
  ACTIONED: 'Atendido',
  DISMISSED: 'Descartado',
};

export const ESTADO_INVITACION: Record<InvitationStatus, string> = {
  ACTIVE: 'Vigente',
  USED_UP: 'Agotada',
  EXPIRED: 'Vencida',
  REVOKED: 'Revocada',
};

/** Lo que dice la bitácora, en palabras. */
export const ACCION_BITACORA: Record<string, string> = {
  ACCOUNT_REGISTERED: 'Creó su cuenta',
  EMAIL_VERIFIED: 'Confirmó su correo',
  SESSIONS_REVOKED: 'Sesiones cerradas',
  PASSWORD_RESET_REQUESTED: 'Pidió cambiar la contraseña',
  PASSWORD_CHANGED: 'Cambió la contraseña',
  EMAIL_MARKED_UNDELIVERABLE: 'Su correo rebota',
  CHARACTER_CREATED: 'Armó su personaje',
  CHAT_MUTED: 'Silencio en el chat',
  CHAT_UNMUTED: 'Se quitó el silencio',
  ACCOUNT_SUSPENDED: 'Suspensión',
  ACCOUNT_BANNED: 'Cuenta cerrada',
  ACCOUNT_REINSTATED: 'Cuenta reactivada',
  STAFF_GRANTED: 'Entró a la caseta',
  STAFF_REVOKED: 'Salió de la caseta',
};

/** Etiqueta de estado: un color por estado, con texto (nunca solo color). */
export function Etiqueta({
  tono,
  children,
}: {
  tono: 'bien' | 'aviso' | 'mal' | 'neutro';
  children: string;
}) {
  return <span className={`caseta-etiqueta caseta-etiqueta--${tono}`}>{children}</span>;
}

export function tonoDeCuenta(status: AccountStatus): 'bien' | 'aviso' | 'mal' | 'neutro' {
  if (status === 'ACTIVE') return 'bien';
  if (status === 'SUSPENDED' || status === 'PENDING_EMAIL') return 'aviso';
  if (status === 'BANNED') return 'mal';
  return 'neutro';
}

/** Retrato chico de la persona (o un hueco si todavía no arma personaje). */
export function RetratoDe({ persona, escala = 2 }: { persona: AdminPerson; escala?: number }) {
  return (
    <span className="caseta-retrato" aria-hidden="true">
      {persona.appearance ? <Retrato appearance={persona.appearance} escala={escala} /> : null}
    </span>
  );
}

/** «Ana Luz (@analuz)»: como se nombra a alguien en la caseta. */
export function nombreDe(persona: AdminPerson): string {
  return persona.displayName
    ? `${persona.displayName} (@${persona.username})`
    : `@${persona.username}`;
}

const FECHA_HORA = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});
const FECHA = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

export function fechaHora(t: number): string {
  return FECHA_HORA.format(t);
}

export function fecha(t: number): string {
  return FECHA.format(t);
}

/**
 * Espera y error de un pedido de la caseta. `hacer` devuelve lo que se quiere
 * guardar; si falla, queda el mensaje por código (§32).
 */
export function usePedido() {
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Estable entre renders: solo toca estado.
  const pedir = useCallback(async <T,>(hacer: () => Promise<T>): Promise<T | null> => {
    setEnCurso(true);
    setError(null);
    try {
      return await hacer();
    } catch (err) {
      setError(mensajeDeError(err));
      return null;
    } finally {
      setEnCurso(false);
    }
  }, []);
  const limpiar = useCallback(() => setError(null), []);
  return { enCurso, error, pedir, limpiar };
}
