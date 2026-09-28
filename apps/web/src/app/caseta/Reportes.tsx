import { MODERATION } from '@wous/config';
import type {
  AdminEvidenceLine,
  AdminReportDetail,
  AdminReportListResponse,
  AdminReportSummary,
} from '@wous/contracts';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api.ts';
import { Aviso, Cartulina } from '../../ui/components/Tianguis.tsx';
import { haceCuanto } from '../amigos/piezas.tsx';
import { Link } from '../router.tsx';
import { hrefCaseta } from './Caseta.tsx';
import {
  ESTADO_REPORTE,
  Etiqueta,
  fechaHora,
  MOTIVO,
  nombreDe,
  RetratoDe,
  usePedido,
} from './piezas.tsx';
import { FormaDeSancion } from './Sancion.tsx';

/**
 * Reportes en la caseta (ADR-0012). La evidencia es la que guardó la sala al
 * reportar (ADR-0010): lo que repartió, nunca lo que dijo el cliente.
 */
export function Reportes({
  reporteId,
  todos,
  onAnuncio,
}: {
  reporteId: string | null;
  todos: boolean;
  onAnuncio(texto: string): void;
}) {
  if (reporteId) return <DetalleDeReporte id={reporteId} onAnuncio={onAnuncio} />;
  return <ListaDeReportes todos={todos} />;
}

function ListaDeReportes({ todos }: { todos: boolean }) {
  const [reportes, setReportes] = useState<AdminReportSummary[] | null>(null);
  const { error, pedir } = usePedido();

  useEffect(() => {
    let vivo = true;
    setReportes(null);
    void pedir(() =>
      api.get<AdminReportListResponse>(`/admin/reports?status=${todos ? 'all' : 'open'}`),
    ).then((data) => {
      if (vivo && data) setReportes(data.reports);
    });
    return () => {
      vivo = false;
    };
  }, [todos, pedir]);

  const ahora = Date.now();
  return (
    <section className="caseta-hoja" aria-labelledby="reportes-titulo">
      <div className="caseta-hoja__cabeza">
        <h2 className="caseta-hoja__titulo" id="reportes-titulo">
          {todos ? 'Todos los reportes' : 'Reportes abiertos'}
        </h2>
        <nav className="caseta-chips" aria-label="Filtrar reportes">
          <Link
            to={hrefCaseta('reportes')}
            className="caseta-chip"
            aria-current={todos ? undefined : 'page'}
          >
            Abiertos
          </Link>
          <Link
            to={hrefCaseta('reportes', { estado: 'todos' })}
            className="caseta-chip"
            aria-current={todos ? 'page' : undefined}
          >
            Todos
          </Link>
        </nav>
      </div>
      {error ? <Aviso>{error}</Aviso> : null}
      {reportes === null && !error ? <p className="caseta__nota">Buscando…</p> : null}
      {reportes?.length === 0 ? (
        <p className="caseta__nota">
          {todos ? 'Nadie ha reportado nada todavía.' : 'Nada pendiente. La plaza está tranquila.'}
        </p>
      ) : null}
      {reportes && reportes.length > 0 ? (
        <ul className="caseta-lista">
          {reportes.map((r) => (
            <li key={r.id}>
              <Link to={hrefCaseta('reportes', { reporte: r.id })} className="caseta-fila">
                <RetratoDe persona={r.target} />
                <span className="caseta-fila__cuerpo">
                  <span className="caseta-fila__nombre">{nombreDe(r.target)}</span>
                  <span className="caseta-fila__detalle">
                    {MOTIVO[r.reason]} · {haceCuanto(r.createdAt, ahora)} · lo reportó{' '}
                    {r.reporter.displayName ?? `@${r.reporter.username}`}
                  </span>
                  {r.messageText ? (
                    <span className="caseta-fila__cita">«{r.messageText}»</span>
                  ) : null}
                </span>
                <span className="caseta-fila__lado">
                  <Etiqueta tono={r.status === 'OPEN' ? 'aviso' : 'neutro'}>
                    {ESTADO_REPORTE[r.status]}
                  </Etiqueta>
                  {r.openAgainstTarget > 1 ? (
                    <span className="caseta-fila__cuenta">{r.openAgainstTarget} abiertos</span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Linea({ linea, resaltada = false }: { linea: AdminEvidenceLine; resaltada?: boolean }) {
  return (
    <li
      className={`caseta-evidencia__linea ${resaltada ? 'caseta-evidencia__linea--reportada' : ''}`}
    >
      <span className="caseta-evidencia__hora">{fechaHora(linea.at)}</span>
      <span className="caseta-evidencia__quien">{linea.name}</span>
      <span className="caseta-evidencia__texto">{linea.text}</span>
    </li>
  );
}

function DetalleDeReporte({ id, onAnuncio }: { id: string; onAnuncio(texto: string): void }) {
  const [reporte, setReporte] = useState<AdminReportDetail | null>(null);
  const carga = usePedido();
  const descarte = usePedido();
  const [motivo, setMotivo] = useState('');
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const data = await carga.pedir(() =>
      api.get<AdminReportDetail>(`/admin/reports/${encodeURIComponent(id)}`),
    );
    if (data) setReporte(data);
  }, [id, carga.pedir]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const descartar = async (event: FormEvent) => {
    event.preventDefault();
    const limpio = motivo.trim();
    if (limpio.length < MODERATION.reasonMinChars) {
      setErrorMotivo('Escribe por qué: queda en la bitácora.');
      return;
    }
    setErrorMotivo(null);
    const data = await descarte.pedir(() =>
      api.post<AdminReportDetail>(`/admin/reports/${encodeURIComponent(id)}/dismiss`, {
        reason: limpio,
      }),
    );
    if (!data) return;
    setReporte(data);
    setMotivo('');
    onAnuncio('Reporte descartado.');
  };

  const volver = (
    <Link to={hrefCaseta('reportes')} className="enlace caseta__volver">
      ← Reportes abiertos
    </Link>
  );

  if (!reporte) {
    return (
      <section className="caseta-hoja">
        {volver}
        {carga.error ? <Aviso>{carga.error}</Aviso> : <p className="caseta__nota">Abriendo…</p>}
      </section>
    );
  }

  const { evidence } = reporte;
  return (
    <section className="caseta-hoja" aria-labelledby="reporte-titulo">
      {volver}
      <div className="caseta-persona">
        <RetratoDe persona={reporte.target} escala={3} />
        <div>
          <h2 className="caseta-hoja__titulo" id="reporte-titulo">
            {nombreDe(reporte.target)}
          </h2>
          <p className="caseta-fila__detalle">
            {MOTIVO[reporte.reason]} · {fechaHora(reporte.createdAt)} · sala {reporte.room}
          </p>
          <Link
            to={hrefCaseta('personas', { cuenta: reporte.target.accountId })}
            className="enlace"
          >
            Ver su ficha
          </Link>
        </div>
        <Etiqueta tono={reporte.status === 'OPEN' ? 'aviso' : 'neutro'}>
          {ESTADO_REPORTE[reporte.status]}
        </Etiqueta>
      </div>

      <dl className="caseta-datos caseta-datos--linea">
        <div>
          <dt>Lo reportó</dt>
          <dd>{nombreDe(reporte.reporter)}</dd>
        </div>
        <div>
          <dt>Abiertos contra esta persona</dt>
          <dd>{reporte.openAgainstTarget}</dd>
        </div>
        {reporte.note ? (
          <div>
            <dt>Nota de quien reportó</dt>
            <dd>{reporte.note}</dd>
          </div>
        ) : null}
      </dl>

      <div className="caseta-evidencia">
        <h3 className="caseta-evidencia__titulo">Lo que vio la sala</h3>
        {evidence.context.length === 0 &&
        !evidence.message &&
        evidence.targetMessages.length === 0 ? (
          <p className="caseta__nota">La sala no tenía mensajes guardados en ese momento.</p>
        ) : null}
        <ol className="caseta-evidencia__lineas">
          {evidence.context.map((l) => (
            <Linea key={l.id} linea={l} />
          ))}
          {evidence.message ? <Linea linea={evidence.message} resaltada /> : null}
        </ol>
        {evidence.messageExpired ? (
          <p className="caseta__nota">
            El mensaje que eligió ya había salido de la ventana de la sala (10 minutos).
          </p>
        ) : null}
        {evidence.targetMessages.length > 0 ? (
          <>
            <h3 className="caseta-evidencia__titulo">Lo último que dijo</h3>
            <ol className="caseta-evidencia__lineas">
              {evidence.targetMessages.map((l) => (
                <Linea key={l.id} linea={l} resaltada />
              ))}
            </ol>
          </>
        ) : null}
      </div>

      {reporte.status === 'OPEN' ? (
        <div className="caseta-acciones">
          <h3 className="caseta-acciones__titulo">Atender</h3>
          <FormaDeSancion
            persona={reporte.target}
            silenciadoHasta={
              reporte.targetMutedUntil !== null && reporte.targetMutedUntil > Date.now()
                ? reporte.targetMutedUntil
                : null
            }
            reporte={{ id: reporte.id, abiertos: reporte.openAgainstTarget }}
            onHecho={(_, texto) => {
              onAnuncio(texto);
              void cargar();
            }}
          />
          <form className="caseta-descartar" onSubmit={descartar} noValidate>
            <h3 className="caseta-acciones__titulo">O descartar</h3>
            <div className={`campo ${errorMotivo ? 'campo--error' : ''}`}>
              <label className="campo__etiqueta" htmlFor="descartar-motivo">
                Por qué no pasa nada (queda en la bitácora)
              </label>
              <input
                id="descartar-motivo"
                className="campo__entrada"
                value={motivo}
                maxLength={MODERATION.reasonMaxChars}
                onChange={(e) => setMotivo(e.target.value)}
                aria-invalid={errorMotivo ? true : undefined}
                aria-describedby={errorMotivo ? 'descartar-motivo-error' : undefined}
              />
              {errorMotivo ? (
                <p className="campo__error" id="descartar-motivo-error">
                  {errorMotivo}
                </p>
              ) : null}
            </div>
            {descarte.error ? <Aviso>{descarte.error}</Aviso> : null}
            <Cartulina type="submit" variante="trazo" cargando={descarte.enCurso}>
              Descartar el reporte
            </Cartulina>
          </form>
        </div>
      ) : (
        <p className="caseta-resuelto">
          {reporte.resolution ?? ESTADO_REPORTE[reporte.status]}
          {reporte.resolvedAt ? ` · ${fechaHora(reporte.resolvedAt)}` : ''}
        </p>
      )}
    </section>
  );
}
