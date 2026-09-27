import type { AdminAccountDetail, AdminAccountSearchResponse, AdminPerson } from '@wous/contracts';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api.ts';
import { Aviso, Cartulina } from '../../ui/components/Tianguis.tsx';
import { Link, useRouter } from '../router.tsx';
import { hrefCaseta } from './Caseta.tsx';
import {
  ACCION_BITACORA,
  ESTADO_CUENTA,
  ESTADO_REPORTE,
  Etiqueta,
  fecha,
  fechaHora,
  MOTIVO,
  nombreDe,
  RetratoDe,
  tonoDeCuenta,
  usePedido,
} from './piezas.tsx';
import { FormaDeSancion } from './Sancion.tsx';

/**
 * Personas en la caseta (ADR-0012): buscar a alguien y ver su ficha, con su
 * historia en la bitácora y lo que se le puede hacer.
 */
export function Personas({
  cuentaId,
  busqueda,
  yo,
  onAnuncio,
}: {
  cuentaId: string | null;
  busqueda: string;
  /** Tu propia cuenta: no te puedes sancionar. */
  yo: string;
  onAnuncio(texto: string): void;
}) {
  if (cuentaId) return <Ficha id={cuentaId} yo={yo} busqueda={busqueda} onAnuncio={onAnuncio} />;
  return <Buscador busqueda={busqueda} />;
}

function Buscador({ busqueda }: { busqueda: string }) {
  const { navigate } = useRouter();
  const [texto, setTexto] = useState(busqueda);
  const [resultados, setResultados] = useState<AdminPerson[] | null>(null);
  const { enCurso, error, pedir } = usePedido();

  useEffect(() => {
    setTexto(busqueda);
    if (busqueda.trim().length < 2) {
      setResultados(null);
      return;
    }
    let vivo = true;
    void pedir(() =>
      api.get<AdminAccountSearchResponse>(`/admin/accounts?q=${encodeURIComponent(busqueda)}`),
    ).then((data) => {
      if (vivo && data) setResultados(data.results);
    });
    return () => {
      vivo = false;
    };
  }, [busqueda, pedir]);

  const buscar = (event: FormEvent) => {
    event.preventDefault();
    navigate(hrefCaseta('personas', { q: texto.trim() }));
  };

  return (
    <section className="caseta-hoja" aria-labelledby="personas-titulo">
      <h2 className="caseta-hoja__titulo" id="personas-titulo">
        Buscar a alguien
      </h2>
      <search>
        <form className="caseta-buscador" onSubmit={buscar}>
          <div className="campo">
            <label className="campo__etiqueta" htmlFor="buscar-persona">
              @usuario, nombre del personaje, correo o ID
            </label>
            <input
              id="buscar-persona"
              className="campo__entrada"
              type="search"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          </div>
          <Cartulina type="submit" cargando={enCurso}>
            Buscar
          </Cartulina>
        </form>
      </search>
      {error ? <Aviso>{error}</Aviso> : null}
      {resultados?.length === 0 ? (
        <p className="caseta__nota">Nadie con ese nombre, correo o ID.</p>
      ) : null}
      {resultados && resultados.length > 0 ? (
        <ul className="caseta-lista">
          {resultados.map((p) => (
            <li key={p.accountId}>
              <Link
                to={hrefCaseta('personas', { cuenta: p.accountId, q: busqueda })}
                className="caseta-fila"
              >
                <RetratoDe persona={p} />
                <span className="caseta-fila__cuerpo">
                  <span className="caseta-fila__nombre">{nombreDe(p)}</span>
                  {!p.displayName ? (
                    <span className="caseta-fila__detalle">Todavía sin personaje</span>
                  ) : null}
                </span>
                <span className="caseta-fila__lado">
                  <Etiqueta tono={tonoDeCuenta(p.status)}>{ESTADO_CUENTA[p.status]}</Etiqueta>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Ficha({
  id,
  yo,
  busqueda,
  onAnuncio,
}: {
  id: string;
  yo: string;
  busqueda: string;
  onAnuncio(texto: string): void;
}) {
  const [cuenta, setCuenta] = useState<AdminAccountDetail | null>(null);
  const { error, pedir } = usePedido();

  const cargar = useCallback(async () => {
    const data = await pedir(() =>
      api.get<AdminAccountDetail>(`/admin/accounts/${encodeURIComponent(id)}`),
    );
    if (data) setCuenta(data);
  }, [id, pedir]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const volver = (
    <Link
      to={hrefCaseta('personas', busqueda ? { q: busqueda } : {})}
      className="enlace caseta__volver"
    >
      ← {busqueda ? 'Resultados' : 'Buscar a alguien'}
    </Link>
  );

  if (!cuenta) {
    return (
      <section className="caseta-hoja">
        {volver}
        {error ? <Aviso>{error}</Aviso> : <p className="caseta__nota">Abriendo la ficha…</p>}
      </section>
    );
  }

  const { person } = cuenta;
  const esStaff = cuenta.staffRole !== null;
  return (
    <section className="caseta-hoja" aria-labelledby="ficha-titulo">
      {volver}
      <div className="caseta-persona">
        <RetratoDe persona={person} escala={3} />
        <div>
          <h2 className="caseta-hoja__titulo" id="ficha-titulo">
            {person.displayName ?? `@${person.username}`}
          </h2>
          <p className="caseta-fila__detalle">@{person.username}</p>
        </div>
        <span className="caseta-persona__etiquetas">
          <Etiqueta tono={tonoDeCuenta(person.status)}>{ESTADO_CUENTA[person.status]}</Etiqueta>
          {esStaff ? <Etiqueta tono="neutro">Atiende la caseta</Etiqueta> : null}
        </span>
      </div>

      <dl className="caseta-datos caseta-datos--linea">
        <div>
          <dt>Correo</dt>
          <dd>
            {cuenta.email}
            {cuenta.emailDeliverability === 'UNDELIVERABLE' ? ' (rebota)' : ''}
            {cuenta.emailDeliverability === 'SOFT_BOUNCE' ? ' (a veces rebota)' : ''}
          </dd>
        </div>
        <div>
          <dt>En Wous desde</dt>
          <dd>{fecha(cuenta.createdAt)}</dd>
        </div>
        <div>
          <dt>Correo confirmado</dt>
          <dd>{cuenta.emailVerifiedAt ? fecha(cuenta.emailVerifiedAt) : 'Todavía no'}</dd>
        </div>
        {cuenta.invitation ? (
          <div>
            <dt>Entró con la invitación</dt>
            <dd>{cuenta.invitation.label}</dd>
          </div>
        ) : null}
        <div>
          <dt>Sesiones abiertas</dt>
          <dd>
            {cuenta.sessions.active}
            {cuenta.sessions.lastSeenAt ? ` · vista ${fechaHora(cuenta.sessions.lastSeenAt)}` : ''}
          </dd>
        </div>
        {cuenta.chatMutedUntil ? (
          <div>
            <dt>Silencio hasta</dt>
            <dd>{fechaHora(cuenta.chatMutedUntil)}</dd>
          </div>
        ) : null}
        {person.status === 'SUSPENDED' ? (
          <div>
            <dt>Suspendida hasta</dt>
            <dd>{cuenta.suspendedUntil ? fechaHora(cuenta.suspendedUntil) : 'Nuevo aviso'}</dd>
          </div>
        ) : null}
        <div>
          <dt>Reportes en su contra</dt>
          <dd>
            {cuenta.reports.against} ({cuenta.reports.openAgainst} abiertos)
          </dd>
        </div>
        <div>
          <dt>Reportes que hizo</dt>
          <dd>{cuenta.reports.made}</dd>
        </div>
      </dl>

      {cuenta.recentReports.length > 0 ? (
        <div className="caseta-bloque">
          <h3 className="caseta-acciones__titulo">Reportes recientes en su contra</h3>
          <ul className="caseta-lista caseta-lista--compacta">
            {cuenta.recentReports.map((r) => (
              <li key={r.id}>
                <Link to={hrefCaseta('reportes', { reporte: r.id })} className="caseta-fila">
                  <span className="caseta-fila__cuerpo">
                    <span className="caseta-fila__nombre">{MOTIVO[r.reason]}</span>
                    <span className="caseta-fila__detalle">
                      {fechaHora(r.createdAt)}
                      {r.messageText ? ` · «${r.messageText}»` : ''}
                    </span>
                  </span>
                  <span className="caseta-fila__lado">
                    <Etiqueta tono={r.status === 'OPEN' ? 'aviso' : 'neutro'}>
                      {ESTADO_REPORTE[r.status]}
                    </Etiqueta>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="caseta-acciones">
        <h3 className="caseta-acciones__titulo">Actuar</h3>
        {esStaff || person.accountId === yo ? (
          <p className="caseta__nota">
            {person.accountId === yo
              ? 'Es tu cuenta: la caseta no te deja sancionarte.'
              : 'Atiende la caseta: para sancionarla, primero hay que quitarle el rol con el script.'}
          </p>
        ) : (
          <FormaDeSancion
            persona={person}
            silenciadoHasta={cuenta.chatMutedUntil}
            onHecho={(respuesta, texto) => {
              setCuenta(respuesta.account);
              onAnuncio(texto);
            }}
          />
        )}
      </div>

      <div className="caseta-bloque">
        <h3 className="caseta-acciones__titulo">Bitácora</h3>
        {cuenta.audit.length === 0 ? <p className="caseta__nota">Nada anotado.</p> : null}
        <ol className="caseta-bitacora">
          {cuenta.audit.map((a) => (
            <li key={a.id}>
              <span className="caseta-bitacora__cuando">{fechaHora(a.at)}</span>
              <span className="caseta-bitacora__que">
                {ACCION_BITACORA[a.action] ?? a.action}
                {a.reason ? ` · ${a.reason}` : ''}
              </span>
              <span className="caseta-bitacora__quien">{a.actor ?? 'Wous'}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
