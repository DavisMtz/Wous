import '../../ui/styles/caseta.css';
import type { SessionResponse } from '@wous/contracts';
import { useState } from 'react';
import { Puesto } from '../../ui/components/Puesto.tsx';
import { EnlaceTrazo } from '../../ui/components/Tianguis.tsx';
import { Link, ROUTES, useRouter } from '../router.tsx';
import { useSession } from '../session.tsx';
import { Invitaciones } from './Invitaciones.tsx';
import { Personas } from './Personas.tsx';
import { Reportes } from './Reportes.tsx';
import { Tablero } from './Tablero.tsx';

/**
 * `/caseta` (Fase 9, ADR-0012): donde se atiende el tianguis. Tablero,
 * reportes, personas e invitaciones, cada una en su pestaña; la sección y lo
 * que se está viendo viven en la URL, así el botón de atrás funciona y un
 * enlace lleva directo a un reporte o a una ficha.
 */

const SECCIONES = [
  { id: 'tablero', titulo: 'Tablero' },
  { id: 'reportes', titulo: 'Reportes' },
  { id: 'personas', titulo: 'Personas' },
  { id: 'invitaciones', titulo: 'Invitaciones' },
] as const;

export type Seccion = (typeof SECCIONES)[number]['id'];

/** Enlace a una sección de la caseta, con lo que se quiere ver en ella. */
export function hrefCaseta(seccion: Seccion, extra: Record<string, string> = {}): string {
  return `${ROUTES.caseta}?${new URLSearchParams({ seccion, ...extra })}`;
}

const ENTORNO: Record<string, string> = {
  local: 'Local',
  staging: 'Staging',
  production: 'Producción',
};

export default function Caseta({ session }: { session: SessionResponse }) {
  const { location } = useRouter();
  const { config } = useSession();
  const [anuncio, setAnuncio] = useState('');
  const pedida = location.search.get('seccion');
  const seccion: Seccion = SECCIONES.find((s) => s.id === pedida)?.id ?? 'tablero';

  return (
    <Puesto className="puesto--caseta">
      <div className="caseta">
        <header className="caseta__cabecera">
          <div className="caseta__letrero">
            <h1 className="caseta__titulo">La caseta</h1>
            {config ? (
              <span
                className={`caseta__entorno caseta__entorno--${config.environment}`}
                title="Entorno donde estás actuando"
              >
                {ENTORNO[config.environment] ?? config.environment}
              </span>
            ) : null}
          </div>
          <p className="caseta__quien">Atiendes como @{session.account.username}</p>
          <nav className="caseta__pestanas" aria-label="Secciones de la caseta">
            {SECCIONES.map((s) => (
              <Link
                key={s.id}
                to={hrefCaseta(s.id)}
                className="caseta__pestana"
                aria-current={s.id === seccion ? 'page' : undefined}
              >
                {s.titulo}
              </Link>
            ))}
          </nav>
        </header>

        <div className="caseta__seccion">
          {seccion === 'tablero' ? <Tablero /> : null}
          {seccion === 'reportes' ? (
            <Reportes
              reporteId={location.search.get('reporte')}
              todos={location.search.get('estado') === 'todos'}
              onAnuncio={setAnuncio}
            />
          ) : null}
          {seccion === 'personas' ? (
            <Personas
              cuentaId={location.search.get('cuenta')}
              busqueda={location.search.get('q') ?? ''}
              yo={session.account.id}
              onAnuncio={setAnuncio}
            />
          ) : null}
          {seccion === 'invitaciones' ? <Invitaciones onAnuncio={setAnuncio} /> : null}
        </div>

        <div className="caseta__salida">
          <EnlaceTrazo to={ROUTES.home} icono="regresar">
            Volver a la casa
          </EnlaceTrazo>
        </div>
      </div>
      <p className="visually-hidden" aria-live="polite">
        {anuncio}
      </p>
    </Puesto>
  );
}
