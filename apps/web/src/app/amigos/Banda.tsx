import { useGSAP } from '@gsap/react';
import type { FriendListResponse } from '@wous/contracts';
import { useRef } from 'react';
import { mensajeDeError } from '../../ui/components/Formulario.tsx';
import { Aviso, Cartulina, EnlaceTrazo } from '../../ui/components/Tianguis.tsx';
import { entrance } from '../../ui/motion.ts';
import { ROUTES } from '../router.tsx';
import { AvisosPorCorreo } from './AvisosPorCorreo.tsx';
import { FotoDeGrupo } from './FotoDeGrupo.tsx';
import type { AccionesDeBanda } from './piezas.tsx';
import { Esperando, TeBuscan } from './Recados.tsx';

type Props = {
  /** null mientras carga. */
  listas: FriendListResponse | null;
  error: unknown;
  acciones: AccionesDeBanda;
  /** Hora de referencia para «hace 2 horas». */
  ahora: number;
  onReintentar: () => void;
  onHecho: (texto: string) => void;
};

/**
 * Tu banda (ADR-0011) bajo la lona verde: la foto de grupo a un lado y, al
 * otro, los recados de quien te busca, lo que mandaste y los avisos por
 * correo (el correo de amistad trae el enlace a esta página).
 */
export function Banda({ listas, error, acciones, ahora, onReintentar, onHecho }: Props) {
  const root = useRef<HTMLDivElement>(null);

  // La foto se pega en la lona y los recados detrás de ella.
  useGSAP(
    () => {
      entrance(
        (tl) => {
          tl.from('.foto__marco', {
            y: -24,
            rotation: -3,
            opacity: 0,
            duration: 0.9,
            ease: 'back.out(1.5)',
          }).from(
            '.banda__lado > *',
            { y: 14, opacity: 0, stagger: 0.08, duration: 0.5 },
            '-=0.55',
          );
        },
        { clear: ['.foto__marco', '.banda__lado > *'] },
      );
    },
    { scope: root },
  );

  return (
    <div className="banda" ref={root}>
      <div className="banda__foto">
        <FotoDeGrupo amigos={listas?.friends ?? null} acciones={acciones} onHecho={onHecho} />
        {error && !listas ? (
          <div className="banda__error">
            <Aviso>{mensajeDeError(error)}</Aviso>
            <Cartulina type="button" variante="trazo" icono="girar" onClick={onReintentar}>
              Intentar otra vez
            </Cartulina>
          </div>
        ) : null}
      </div>
      <div className="banda__lado">
        {listas ? (
          <>
            <TeBuscan incoming={listas.incoming} ahora={ahora} acciones={acciones} />
            <Esperando outgoing={listas.outgoing} ahora={ahora} acciones={acciones} />
          </>
        ) : null}
        <div className="banda__avisos">
          <AvisosPorCorreo />
        </div>
        <div className="banda__salida">
          <EnlaceTrazo to={ROUTES.plaza} icono="caminar">
            Salir a la plaza
          </EnlaceTrazo>
        </div>
      </div>
    </div>
  );
}
