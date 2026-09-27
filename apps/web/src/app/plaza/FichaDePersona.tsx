import { SOCIAL } from '@wous/config';
import {
  type AppearanceInput,
  type FriendRelation,
  REPORT_REASONS,
  type ReportReason,
} from '@wous/contracts';
import { type FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Ficha, RespuestaSocial } from '../../game/hud-store.ts';
import { lookFromAppearance } from '../../game/rendering/appearance.ts';
import { mensajeDeError } from '../../ui/components/Formulario.tsx';
import { Icono } from '../../ui/components/Icono.tsx';
import { Aviso, Cartulina, Sello } from '../../ui/components/Tianguis.tsx';
import { Miniatura } from '../../ui/scene/Miniatura.tsx';

/** Lo que ve la persona de cada motivo (el código del cable no se enseña). */
export const MOTIVO: Record<ReportReason, string> = {
  HARASSMENT: 'Me está molestando',
  HATE: 'Odio o discriminación',
  SEXUAL: 'Contenido sexual',
  SPAM: 'Spam o mensajes repetidos',
  IMPERSONATION: 'Se hace pasar por alguien',
  OTHER: 'Otra cosa',
};

type Paso =
  | 'inicio'
  | 'reportar'
  | 'reportando'
  | 'reportado'
  | 'confirmar'
  | 'bloqueando'
  | 'bloqueado'
  | 'desbloqueando';

/** A dónde se regresa si la sala no contesta o contesta con error. */
const REGRESO: Partial<Record<Paso, Paso>> = {
  reportando: 'reportar',
  bloqueando: 'confirmar',
  desbloqueando: 'inicio',
};

/** Si la sala no contesta en este tiempo, se dice y se puede reintentar. */
const ESPERA_MS = 7_000;

/** Cabeza y hombros para el retrato de la ficha (filas de arte del sprite). */
const RETRATO = { desde: 0, hasta: 19 } as const;

/**
 * La amistad con esta persona (ADR-0011), desde tu lado. Viaja por HTTP, no
 * por la sala: la sala no sabe de amigos. Sin sesión (banco) no hay.
 */
export type AmistadEnFicha = {
  relacion: FriendRelation;
  /** Agregar o aceptar: resuelven con cómo quedó y fallan con el error del servidor. */
  onAgregar: () => Promise<FriendRelation>;
  onAceptar: () => Promise<FriendRelation>;
};

type Props = {
  ficha: Ficha;
  /** Apariencia, si la persona sigue en la sala (si ya se fue, no hay retrato). */
  apariencia: AppearanceInput | null;
  bloqueada: boolean;
  respuesta: RespuestaSocial | null;
  amistad: AmistadEnFicha | null;
  /** Devuelven false si no hay conexión. */
  onReportar: (motivo: ReportReason, nota: string, messageId: string | null) => boolean;
  onBloquear: (bloquear: boolean) => boolean;
  onCerrar: () => void;
};

/** Lo que acaba de pasar con la amistad en esta ficha (se confirma con la cartulina verde). */
type PasoAmistad = 'quieto' | 'pidiendo' | 'enviada' | 'aceptando' | 'amigos';

/**
 * La ficha de alguien de la sala (ADR-0010): tocas a la persona o su nombre
 * en el chat y aquí la reportas o la bloqueas sin salir del mundo. No es un
 * modal: el juego sigue, y Esc la cierra. Todo lo que pide viaja por la sala,
 * que contesta; hasta entonces la ficha espera.
 */
export function FichaDePersona({
  ficha,
  apariencia,
  bloqueada,
  respuesta,
  amistad,
  onReportar,
  onBloquear,
  onCerrar,
}: Props) {
  const [paso, setPaso] = useState<Paso>('inicio');
  const [pasoAmistad, setPasoAmistad] = useState<PasoAmistad>('quieto');
  const [errorAmistad, setErrorAmistad] = useState<string | null>(null);
  const [motivo, setMotivo] = useState<ReportReason | null>(null);
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fichaRef = useRef<HTMLDivElement>(null);
  /** Las respuestas que cuentan son las que llegan DESPUÉS de pedir. */
  const esperaDesde = useRef(respuesta?.n ?? 0);
  const look = useMemo(() => (apariencia ? lookFromAppearance(apariencia) : null), [apariencia]);

  // Al abrir, el foco entra a la ficha. Al cerrar, regresa a donde estaba
  // solo si se llegó con teclado; con ratón o dedo, vuelve al juego.
  useLayoutEffect(() => {
    const activo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const antes = activo?.matches(':focus-visible') ? activo : null;
    fichaRef.current?.focus({ preventScroll: true });
    return () => {
      if (antes?.isConnected) antes.focus({ preventScroll: true });
      else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCerrar]);

  // La sala contestó.
  const respuestaN = respuesta?.n;
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo reacciona a una respuesta nueva
  useEffect(() => {
    if (!respuesta || respuesta.n <= esperaDesde.current) return;
    const regreso = REGRESO[paso];
    if (respuesta.tipo === 'error') {
      if (!regreso) return;
      setError(respuesta.texto);
      setPaso(regreso);
      return;
    }
    if (respuesta.id !== ficha.id) return;
    if (respuesta.tipo === 'reporte' && paso === 'reportando') setPaso('reportado');
    if (respuesta.tipo === 'bloqueo' && respuesta.bloqueado && paso === 'bloqueando') {
      setPaso('bloqueado');
    }
    if (respuesta.tipo === 'bloqueo' && !respuesta.bloqueado && paso === 'desbloqueando') {
      setPaso('inicio');
    }
  }, [respuestaN]);

  // Esperando a la sala: si no contesta, se dice y se regresa.
  useEffect(() => {
    const regreso = REGRESO[paso];
    if (!regreso) return;
    const timer = window.setTimeout(() => {
      setError('La sala no contestó. Intenta otra vez.');
      setPaso(regreso);
    }, ESPERA_MS);
    return () => window.clearTimeout(timer);
  }, [paso]);

  const pedir = (siguiente: Paso, enviar: () => boolean) => {
    setError(null);
    esperaDesde.current = respuesta?.n ?? 0;
    if (!enviar()) {
      setError('Sin conexión: espera a que vuelva e intenta otra vez.');
      return;
    }
    setPaso(siguiente);
  };

  const enviarReporte = (e: FormEvent) => {
    e.preventDefault();
    if (!motivo) return;
    pedir('reportando', () => onReportar(motivo, nota, ficha.mensaje?.id ?? null));
  };

  const amistadPedida = async (pedir: () => Promise<FriendRelation>, espera: PasoAmistad) => {
    setErrorAmistad(null);
    setPasoAmistad(espera);
    try {
      const quedo = await pedir();
      setPasoAmistad(quedo === 'FRIENDS' ? 'amigos' : quedo === 'OUTGOING' ? 'enviada' : 'quieto');
    } catch (err) {
      setErrorAmistad(mensajeDeError(err));
      setPasoAmistad('quieto');
    }
  };

  const nombre = ficha.nombre;
  const esperando = paso === 'reportando' || paso === 'bloqueando' || paso === 'desbloqueando';
  // A quien bloqueaste no se le pide amistad (el servidor diría que primero desbloquees).
  const conAmistad = amistad !== null && !bloqueada;
  const relacion = amistad?.relacion ?? 'NONE';
  const estadoAmistad =
    !conAmistad || pasoAmistad === 'enviada' || pasoAmistad === 'amigos'
      ? null
      : relacion === 'FRIENDS'
        ? { icono: 'corazon' as const, texto: 'Es de tu banda' }
        : relacion === 'OUTGOING'
          ? { icono: 'agregar' as const, texto: 'Le mandaste solicitud' }
          : relacion === 'INCOMING'
            ? { icono: 'agregar' as const, texto: 'Te mandó solicitud' }
            : null;

  return (
    <div
      className="ficha"
      ref={fichaRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="false"
      aria-labelledby="ficha-nombre"
      aria-busy={esperando || undefined}
    >
      <span className="ficha__masking" aria-hidden="true" />
      <button type="button" className="ficha__cerrar" aria-label="Cerrar" onClick={onCerrar}>
        <Icono name="cerrar" size={20} />
      </button>

      <div className="ficha__quien">
        {look ? (
          <div className="ficha__retrato">
            <Miniatura look={look} recorte={RETRATO} escala={3} />
          </div>
        ) : null}
        <div className="ficha__nombre-caja">
          <h2 className="ficha__nombre" id="ficha-nombre">
            {nombre}
          </h2>
          {bloqueada && paso !== 'bloqueado' ? (
            <p className="ficha__estado">
              <Icono name="globo-tachado" size={17} />
              Con bloqueo: no se oyen
            </p>
          ) : null}
          {estadoAmistad ? (
            <p className={`ficha__estado${relacion === 'FRIENDS' ? ' ficha__estado--amigos' : ''}`}>
              <Icono name={estadoAmistad.icono} size={17} />
              {estadoAmistad.texto}
            </p>
          ) : null}
        </div>
      </div>

      {paso === 'inicio' || paso === 'desbloqueando' ? (
        <>
          {ficha.mensaje ? (
            <figure className="ficha__cita">
              <figcaption>Dijo:</figcaption>
              <blockquote>«{ficha.mensaje.texto}»</blockquote>
            </figure>
          ) : null}
          {conAmistad && amistad ? (
            <div className="ficha__amistad" aria-live="polite">
              {pasoAmistad === 'enviada' ? (
                <div className="ficha__hecho ficha__hecho--amistad">
                  <Sello>¡Enviada!</Sello>
                  <p>Si acepta, aparece en tu banda.</p>
                </div>
              ) : pasoAmistad === 'amigos' ? (
                <div className="ficha__hecho ficha__hecho--amistad">
                  <Sello>¡Ya son amigos!</Sello>
                  <p>{nombre} ya es de tu banda.</p>
                </div>
              ) : relacion === 'NONE' ? (
                <Cartulina
                  type="button"
                  icono="agregar"
                  cargando={pasoAmistad === 'pidiendo'}
                  onClick={() => amistadPedida(amistad.onAgregar, 'pidiendo')}
                >
                  Agregar amigo
                </Cartulina>
              ) : relacion === 'INCOMING' ? (
                <Cartulina
                  type="button"
                  icono="corazon"
                  cargando={pasoAmistad === 'aceptando'}
                  onClick={() => amistadPedida(amistad.onAceptar, 'aceptando')}
                >
                  Aceptar solicitud
                </Cartulina>
              ) : null}
              {errorAmistad ? <Aviso>{errorAmistad}</Aviso> : null}
            </div>
          ) : null}
          <div className="ficha__acciones">
            <Cartulina
              type="button"
              variante="trazo"
              icono="bandera"
              onClick={() => {
                setError(null);
                setPaso('reportar');
              }}
            >
              Reportar
            </Cartulina>
            {bloqueada ? (
              <Cartulina
                type="button"
                variante="trazo"
                icono="globo"
                cargando={paso === 'desbloqueando'}
                onClick={() => pedir('desbloqueando', () => onBloquear(false))}
              >
                Desbloquear
              </Cartulina>
            ) : (
              <Cartulina
                type="button"
                variante="trazo"
                icono="bloquear"
                onClick={() => {
                  setError(null);
                  setPaso('confirmar');
                }}
              >
                Bloquear
              </Cartulina>
            )}
          </div>
        </>
      ) : null}

      {paso === 'reportar' || paso === 'reportando' ? (
        <form className="ficha__reporte" onSubmit={enviarReporte}>
          <fieldset className="motivos" disabled={paso === 'reportando'}>
            <legend className="ficha__pregunta">¿Qué pasó?</legend>
            {REPORT_REASONS.map((r) => (
              <label key={r} className="motivo">
                <input
                  type="radio"
                  name="motivo"
                  value={r}
                  className="motivo__radio"
                  checked={motivo === r}
                  onChange={() => setMotivo(r)}
                />
                <span className="motivo__texto">{MOTIVO[r]}</span>
              </label>
            ))}
          </fieldset>
          <label className="ficha__nota-rotulo" htmlFor="ficha-nota">
            ¿Algo más que debamos saber? <span>(opcional)</span>
          </label>
          <textarea
            id="ficha-nota"
            className="ficha__nota"
            rows={2}
            maxLength={SOCIAL.reportNoteMaxChars}
            value={nota}
            disabled={paso === 'reportando'}
            onChange={(e) => setNota(e.target.value)}
          />
          <p className="ficha__incluye">
            {ficha.mensaje
              ? 'Va con su mensaje y lo que se dijo justo antes.'
              : 'Va con lo último que dijo en esta sala.'}
          </p>
          <div className="ficha__botones">
            <Cartulina type="submit" disabled={!motivo} cargando={paso === 'reportando'}>
              Enviar reporte
            </Cartulina>
            <Cartulina
              type="button"
              variante="trazo"
              disabled={paso === 'reportando'}
              onClick={() => setPaso('inicio')}
            >
              Volver
            </Cartulina>
          </div>
        </form>
      ) : null}

      {paso === 'reportado' ? (
        <div className="ficha__hecho">
          <Sello>¡Enviado!</Sello>
          <p>Gracias. Lo revisamos con lo que la sala guardó de esa plática.</p>
          {!bloqueada ? <p>¿También quieres dejar de oír a {nombre}?</p> : null}
          <div className="ficha__botones">
            <Cartulina type="button" onClick={onCerrar}>
              Listo
            </Cartulina>
            {!bloqueada ? (
              <Cartulina
                type="button"
                variante="trazo"
                icono="bloquear"
                onClick={() => setPaso('confirmar')}
              >
                Bloquear también
              </Cartulina>
            ) : null}
          </div>
        </div>
      ) : null}

      {paso === 'confirmar' || paso === 'bloqueando' ? (
        <div className="ficha__confirmar">
          <p className="ficha__pregunta">¿Bloquear a {nombre}?</p>
          <p>
            Ya no se van a oír ni a ver sus gestos, aunque estén en la misma sala. No se le avisa, y
            lo puedes deshacer cuando quieras.
          </p>
          <div className="ficha__botones">
            <Cartulina
              type="button"
              cargando={paso === 'bloqueando'}
              onClick={() => pedir('bloqueando', () => onBloquear(true))}
            >
              Bloquear
            </Cartulina>
            <Cartulina
              type="button"
              variante="trazo"
              disabled={paso === 'bloqueando'}
              onClick={() => setPaso('inicio')}
            >
              Cancelar
            </Cartulina>
          </div>
        </div>
      ) : null}

      {paso === 'bloqueado' ? (
        <div className="ficha__hecho">
          <Sello>¡Hecho!</Sello>
          <p>Ya no se oyen. Lo puedes deshacer aquí o desde tu casa.</p>
          <div className="ficha__botones">
            <Cartulina type="button" onClick={onCerrar}>
              Listo
            </Cartulina>
            <Cartulina
              type="button"
              variante="trazo"
              onClick={() => pedir('desbloqueando', () => onBloquear(false))}
            >
              Deshacer
            </Cartulina>
          </div>
        </div>
      ) : null}

      {error ? <Aviso>{error}</Aviso> : null}
    </div>
  );
}
