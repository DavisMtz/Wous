import type { ReactNode } from 'react';
import { Link } from '../../app/router.tsx';
import { Calle } from '../scene/Calle.tsx';
import { OrillaDeLona, Rotulo } from './Tianguis.tsx';

export type LonaColor = 'rosa' | 'azul' | 'verde' | 'amarilla' | 'naranja';

type Props = {
  children: ReactNode;
  /** En la portada el rótulo es el protagonista; en el resto, una firma chica. */
  firma?: boolean;
  className?: string;
};

/**
 * Un puesto del tianguis: la orilla de la lona arriba, el contenido debajo y
 * la calle al pie. El color de la lona lo pone la ruta (App).
 */
export function Puesto({ children, firma = true, className = '' }: Props) {
  return (
    <div className={`puesto ${className}`}>
      <OrillaDeLona />
      {firma ? (
        <header className="puesto__firma">
          <Link to="/" className="puesto__inicio" aria-label="Wous, ir al inicio">
            <Rotulo className="rotulo--chico" />
          </Link>
        </header>
      ) : null}
      <main className="puesto__contenido" id="contenido">
        {children}
      </main>
      <Calle />
    </div>
  );
}
