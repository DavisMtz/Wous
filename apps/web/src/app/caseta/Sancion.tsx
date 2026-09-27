import { MODERATION } from '@wous/config';
import type {
  AccountStatus,
  AdminPerson,
  SanctionAction,
  SanctionRequest,
  SanctionResponse,
} from '@wous/contracts';
import { type FormEvent, useId, useState } from 'react';
import { api } from '../../services/api.ts';
import { Casilla } from '../../ui/components/Formulario.tsx';
import { Aviso, Cartulina } from '../../ui/components/Tianguis.tsx';
import { nombreDe, usePedido } from './piezas.tsx';

/**
 * Qué hacer con una persona (ADR-0012). Solo se ofrece lo que tiene sentido
 * para su estado; el servidor igual lo vuelve a revisar. Todo lleva motivo,
 * y cerrar una cuenta pide confirmarlo.
 */

type Duracion = { horas: number | null; etiqueta: string };

const SILENCIO: Duracion[] = [
  { horas: 1, etiqueta: '1 hora' },
  { horas: 24, etiqueta: '1 día' },
  { horas: 72, etiqueta: '3 días' },
  { horas: 168, etiqueta: '1 semana' },
];

const SUSPENSION: Duracion[] = [
  { horas: 24, etiqueta: '1 día' },
  { horas: 72, etiqueta: '3 días' },
  { horas: 168, etiqueta: '1 semana' },
  { horas: 720, etiqueta: '30 días' },
  { horas: null, etiqueta: 'Hasta nuevo aviso' },
];

type Opcion = {
  accion: SanctionAction;
  etiqueta: string;
  ayuda: string;
  duraciones?: Duracion[];
};

const OPCIONES: Record<SanctionAction, Opcion> = {
  MUTE: {
    accion: 'MUTE',
    etiqueta: 'Silenciar',
    ayuda:
      'No puede escribir en el chat; sí caminar y hacer gestos. Aplica en su sala al instante.',
    duraciones: SILENCIO,
  },
  UNMUTE: {
    accion: 'UNMUTE',
    etiqueta: 'Quitar el silencio',
    ayuda: 'Vuelve a escribir en el chat.',
  },
  SUSPEND: {
    accion: 'SUSPEND',
    etiqueta: 'Suspender',
    ayuda:
      'Sale de la sala al instante y no puede entrar hasta que termine; al intentarlo ve hasta cuándo.',
    duraciones: SUSPENSION,
  },
  REINSTATE: {
    accion: 'REINSTATE',
    etiqueta: 'Reactivar',
    ayuda: 'Puede volver a entrar, con una sesión nueva.',
  },
  END_SESSIONS: {
    accion: 'END_SESSIONS',
    etiqueta: 'Cerrar sus sesiones',
    ayuda: 'Por ejemplo, si le robaron la contraseña. Puede volver a entrar cuando quiera.',
  },
  BAN: {
    accion: 'BAN',
    etiqueta: 'Cerrar la cuenta',
    ayuda: 'Definitivo: sale al instante y no vuelve a entrar. La caseta no la reabre.',
  },
};

function opcionesPara(status: AccountStatus, silenciado: boolean): Opcion[] {
  switch (status) {
    case 'ACTIVE':
      return [
        OPCIONES.MUTE,
        ...(silenciado ? [OPCIONES.UNMUTE] : []),
        OPCIONES.SUSPEND,
        OPCIONES.END_SESSIONS,
        OPCIONES.BAN,
      ];
    case 'SUSPENDED':
      return [
        OPCIONES.REINSTATE,
        { ...OPCIONES.SUSPEND, etiqueta: 'Cambiar la suspensión' },
        OPCIONES.BAN,
      ];
    case 'PENDING_EMAIL':
      return [OPCIONES.END_SESSIONS, OPCIONES.BAN];
    default:
      return [];
  }
}

/** Lo que dice el botón (y el anuncio): «Silenciar 1 día», «Cerrar la cuenta»… */
function verbo(opcion: Opcion, duracion: Duracion | undefined): string {
  if (opcion.accion === 'MUTE') return `Silenciar ${duracion?.etiqueta ?? ''}`.trim();
  if (opcion.accion === 'SUSPEND') {
    return duracion?.horas === null
      ? 'Suspender hasta nuevo aviso'
      : `Suspender ${duracion?.etiqueta ?? ''}`.trim();
  }
  return opcion.etiqueta;
}

type Props = {
  persona: AdminPerson;
  /** Silencio vigente (para ofrecer quitarlo). */
  silenciadoHasta: number | null;
  /** Se actúa desde un reporte: se cierra, y opcionalmente los demás abiertos. */
  reporte?: { id: string; abiertos: number };
  onHecho(respuesta: SanctionResponse, texto: string): void;
};

export function FormaDeSancion({ persona, silenciadoHasta, reporte, onHecho }: Props) {
  const id = useId();
  const opciones = opcionesPara(persona.status, silenciadoHasta !== null);
  const [accion, setAccion] = useState<SanctionAction | null>(null);
  const [horas, setHoras] = useState<number | null | undefined>(undefined);
  const [motivo, setMotivo] = useState('');
  const [cerrarOtros, setCerrarOtros] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null);
  const { enCurso, error, pedir } = usePedido();

  if (opciones.length === 0) {
    return (
      <p className="caseta__nota">
        {persona.status === 'BANNED'
          ? 'Esta cuenta está cerrada: no hay nada más que hacer desde la caseta.'
          : 'Esta cuenta no admite sanciones.'}
      </p>
    );
  }

  const opcion = opciones.find((o) => o.accion === accion) ?? null;
  const duracion = opcion?.duraciones?.find((d) => d.horas === horas);

  const elegir = (nueva: Opcion) => {
    setAccion(nueva.accion);
    setHoras(nueva.duraciones?.[nueva.accion === 'MUTE' ? 1 : 0]?.horas);
    setConfirmando(false);
  };

  const enviar = async (event: FormEvent) => {
    event.preventDefault();
    if (!opcion) return;
    const limpio = motivo.trim();
    if (limpio.length < MODERATION.reasonMinChars) {
      setErrorMotivo('Escribe el motivo: queda en la bitácora.');
      return;
    }
    setErrorMotivo(null);
    if (opcion.accion === 'BAN' && !confirmando) {
      setConfirmando(true);
      return;
    }
    const cuerpo: SanctionRequest = {
      action: opcion.accion,
      reason: limpio,
      ...(opcion.duraciones && horas !== null && horas !== undefined ? { hours: horas } : {}),
      ...(reporte ? { reportId: reporte.id } : {}),
      ...(reporte && reporte.abiertos > 1 && cerrarOtros ? { closeOpenReports: true } : {}),
    };
    const respuesta = await pedir(() =>
      api.post<SanctionResponse>(
        `/admin/accounts/${encodeURIComponent(persona.accountId)}/sanction`,
        cuerpo,
      ),
    );
    setConfirmando(false);
    if (!respuesta) return;
    const hecho = verbo(opcion, duracion);
    setMotivo('');
    setAccion(null);
    onHecho(
      respuesta,
      respuesta.changed
        ? `Listo: ${hecho.toLowerCase()} · ${nombreDe(persona)}.`
        : opcion.accion === 'MUTE'
          ? `${nombreDe(persona)} ya tenía un silencio igual o más largo; no cambió nada. Para acortarlo, primero quítalo.`
          : `${nombreDe(persona)} ya estaba así; no cambió nada.`,
    );
  };

  return (
    <form className="caseta-sancion" onSubmit={enviar} noValidate>
      <fieldset className="caseta-sancion__grupo">
        <legend className="caseta-sancion__pregunta">¿Qué hacemos?</legend>
        <div className="caseta-chips">
          {opciones.map((o) => (
            <label
              key={o.accion}
              className={`caseta-chip ${o.accion === 'BAN' ? 'caseta-chip--peligro' : ''}`}
            >
              <input
                type="radio"
                name={`${id}-accion`}
                value={o.accion}
                checked={accion === o.accion}
                onChange={() => elegir(o)}
              />
              <span>{o.etiqueta}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {opcion?.duraciones ? (
        <fieldset className="caseta-sancion__grupo">
          <legend className="caseta-sancion__pregunta">¿Cuánto tiempo?</legend>
          <div className="caseta-chips">
            {opcion.duraciones.map((d) => (
              <label key={d.etiqueta} className="caseta-chip">
                <input
                  type="radio"
                  name={`${id}-horas`}
                  checked={horas === d.horas}
                  onChange={() => setHoras(d.horas)}
                />
                <span>{d.etiqueta}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {opcion ? (
        <>
          <p className="caseta__nota">{opcion.ayuda}</p>
          <div className={`campo ${errorMotivo ? 'campo--error' : ''}`}>
            <label className="campo__etiqueta" htmlFor={`${id}-motivo`}>
              Motivo (queda en la bitácora)
            </label>
            <textarea
              id={`${id}-motivo`}
              className="campo__entrada caseta-motivo"
              rows={3}
              maxLength={MODERATION.reasonMaxChars}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              aria-invalid={errorMotivo ? true : undefined}
              aria-describedby={errorMotivo ? `${id}-motivo-error` : undefined}
            />
            {errorMotivo ? (
              <p className="campo__error" id={`${id}-motivo-error`}>
                {errorMotivo}
              </p>
            ) : null}
          </div>
          {reporte && reporte.abiertos > 1 ? (
            <Casilla checked={cerrarOtros} onChange={setCerrarOtros}>
              Dar por atendidos también los otros {reporte.abiertos - 1} reportes abiertos de esta
              persona
            </Casilla>
          ) : null}
          {error ? <Aviso>{error}</Aviso> : null}
          {confirmando ? (
            <div className="caseta-sancion__confirmar" role="alert">
              <p>
                ¿Cerrar la cuenta de <strong>{nombreDe(persona)}</strong>? Es definitivo.
              </p>
              <div className="caseta-sancion__botones">
                <Cartulina type="submit" cargando={enCurso}>
                  Sí, cerrarla
                </Cartulina>
                <Cartulina type="button" variante="trazo" onClick={() => setConfirmando(false)}>
                  No, espera
                </Cartulina>
              </div>
            </div>
          ) : (
            <Cartulina type="submit" cargando={enCurso}>
              {verbo(opcion, duracion)}
            </Cartulina>
          )}
        </>
      ) : null}
    </form>
  );
}
