import type { AdminSummary } from '@wous/contracts';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api.ts';
import { Aviso, Cartulina } from '../../ui/components/Tianguis.tsx';
import { Link } from '../router.tsx';
import { hrefCaseta } from './Caseta.tsx';
import { fechaHora, usePedido } from './piezas.tsx';

/**
 * El tablero (ADR-0012): lo que vive en D1 y en los directorios de sala,
 * ahora. Lo que vive en los logs (errores, latencias, logins) se consulta
 * con `scripts/observabilidad/tablero.mts` (docs/runbooks/observabilidad.md).
 */
export function Tablero() {
  const [datos, setDatos] = useState<AdminSummary | null>(null);
  const { enCurso, error, pedir } = usePedido();

  const cargar = useCallback(async () => {
    const resumen = await pedir(() => api.get<AdminSummary>('/admin/summary'));
    if (resumen) setDatos(resumen);
  }, [pedir]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (!datos) {
    return (
      <section className="caseta-hoja" aria-busy={enCurso}>
        {error ? <Aviso>{error}</Aviso> : <p className="caseta__nota">Contando…</p>}
      </section>
    );
  }

  const { population, accounts, activity, moderation, email, invitations } = datos;
  const conGente = population.rooms.filter((r) => r.count > 0);

  return (
    <section className="caseta-tablero" aria-label="Tablero">
      <Tarjeta titulo="Ahora en Wous" cifra={population.total} unidad="en las salas">
        {conGente.length > 0 ? (
          <ul className="caseta-tarjeta__lista">
            {conGente.map((r) => (
              <li key={`${r.mapId}:${r.instance}`}>
                <span>
                  {r.name} · {r.instance}
                </span>
                <strong>{r.count}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="caseta__nota">Las salas están vacías.</p>
        )}
      </Tarjeta>

      <Tarjeta titulo="Cuentas" cifra={accounts.total} unidad="en total">
        <Datos
          filas={[
            ['Activas', accounts.active],
            ['Sin confirmar correo', accounts.pendingEmail],
            ['Suspendidas', accounts.suspended],
            ['Cerradas', accounts.banned],
            ['Nuevas en 24 h', accounts.newLast24h],
            ['Nuevas en 7 días', accounts.newLast7d],
          ]}
        />
      </Tarjeta>

      <Tarjeta titulo="Actividad" cifra={activity.accountsLast24h} unidad="usaron Wous hoy">
        <Datos
          filas={[
            ['En los últimos 7 días', activity.accountsLast7d],
            ['Sesiones abiertas', activity.sessionsActive],
          ]}
        />
      </Tarjeta>

      <Tarjeta titulo="Moderación" cifra={moderation.openReports} unidad="reportes abiertos">
        <Datos
          filas={[
            ['Reportes en 7 días', moderation.reportsLast7d],
            ['Con silencio ahora', moderation.mutedNow],
          ]}
        />
        {moderation.openReports > 0 ? (
          <Link to={hrefCaseta('reportes')} className="enlace">
            Revisar los reportes
          </Link>
        ) : null}
      </Tarjeta>

      <Tarjeta titulo="Correo" cifra={email.sentToday} unidad="enviados hoy (UTC)">
        <Datos
          filas={[
            ['En camino', email.inFlight],
            ['Fallidos en 7 días', email.failedLast7d],
            ['Direcciones que rebotan', email.undeliverable],
          ]}
        />
        <p className="caseta__nota">El plan gratuito de Brevo manda hasta 300 al día.</p>
      </Tarjeta>

      <Tarjeta
        titulo="Invitaciones"
        cifra={invitations.usesLeft}
        unidad={invitations.usesLeft === 1 ? 'lugar libre' : 'lugares libres'}
      >
        <Datos
          filas={[
            ['Invitaciones vigentes', invitations.active],
            ['Cuentas con invitación (7 días)', invitations.accountsLast7d],
          ]}
        />
        <p className="caseta__nota">
          Registro {datos.registration === 'invite' ? 'solo con invitación' : 'abierto'}.
        </p>
      </Tarjeta>

      <div className="caseta-tablero__pie">
        <p className="caseta__nota">Contado: {fechaHora(datos.generatedAt)}</p>
        {error ? <Aviso>{error}</Aviso> : null}
        <Cartulina
          type="button"
          variante="trazo"
          icono="girar"
          cargando={enCurso}
          onClick={() => void cargar()}
        >
          Volver a contar
        </Cartulina>
      </div>
    </section>
  );
}

function Tarjeta({
  titulo,
  cifra,
  unidad,
  children,
}: {
  titulo: string;
  cifra: number;
  unidad: string;
  children: ReactNode;
}) {
  return (
    <article className="caseta-tarjeta">
      <h2 className="caseta-tarjeta__titulo">{titulo}</h2>
      <p className="caseta-tarjeta__cifra">
        <strong>{cifra.toLocaleString('es-MX')}</strong> <span>{unidad}</span>
      </p>
      {children}
    </article>
  );
}

function Datos({ filas }: { filas: [string, number][] }) {
  return (
    <dl className="caseta-datos">
      {filas.map(([etiqueta, valor]) => (
        <div key={etiqueta}>
          <dt>{etiqueta}</dt>
          <dd>{valor.toLocaleString('es-MX')}</dd>
        </div>
      ))}
    </dl>
  );
}
