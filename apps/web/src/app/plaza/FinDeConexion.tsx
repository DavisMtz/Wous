import type { EndReason } from '../../game/network/world-connection.ts';
import { OrillaDeLona, Rotulo } from '../../ui/components/Tianguis.tsx';

type Pantalla = {
  titulo: string;
  texto: string;
  accion: string;
  hacer: 'seguir' | 'entrar' | 'casa' | 'recargar';
};

const PANTALLAS: Record<EndReason, Pantalla> = {
  REPLACED: {
    titulo: 'Abriste la plaza en otro lado',
    texto:
      'Aquí se pausó para que no estés dos veces. Si quieres seguir en esta pestaña, entra otra vez.',
    accion: 'Seguir aquí',
    hacer: 'seguir',
  },
  AUTH_REQUIRED: {
    titulo: 'Tu sesión terminó',
    texto: 'Vuelve a entrar para seguir en la plaza.',
    accion: 'Entrar',
    hacer: 'entrar',
  },
  CHARACTER_REQUIRED: {
    titulo: 'Primero arma tu personaje',
    texto: 'Sin personaje no se puede entrar a la plaza.',
    accion: 'Ir al probador',
    hacer: 'casa',
  },
  UPDATE_REQUIRED: {
    titulo: 'Wous se actualizó',
    texto: 'Recarga la página para entrar con la versión nueva.',
    accion: 'Recargar',
    hacer: 'recargar',
  },
  POLICY: {
    titulo: 'Se cortó la conexión',
    texto:
      'La sala recibió demasiados mensajes seguidos desde este dispositivo y cerró el cable. Vuelve a entrar.',
    accion: 'Volver a entrar',
    hacer: 'seguir',
  },
};

/**
 * La conexión terminó y reintentar solo no sirve: la lona baja, dice por qué
 * y ofrece la única salida que tiene sentido.
 */
export function FinDeConexion({
  motivo,
  onSeguir,
  onSalir,
}: {
  motivo: EndReason;
  onSeguir: () => void;
  onSalir: () => void;
}) {
  const p = PANTALLAS[motivo];
  const actuar = () => {
    if (p.hacer === 'seguir') onSeguir();
    else if (p.hacer === 'entrar') window.location.assign('/login');
    else if (p.hacer === 'casa') window.location.assign('/');
    else window.location.reload();
  };
  return (
    <div className="gira" role="alertdialog" aria-modal="true" aria-labelledby="fin-titulo">
      <OrillaDeLona />
      <div className="gira__cuerpo">
        <Rotulo className="rotulo--chico" />
        <h1 className="gira__titulo" id="fin-titulo">
          {p.titulo}
        </h1>
        <p className="gira__texto">{p.texto}</p>
        <button type="button" className="cartulina cartulina--fosfo gira__accion" onClick={actuar}>
          <span className="cartulina__texto">{p.accion}</span>
        </button>
        <button type="button" className="cartulina cartulina--trazo gira__salir" onClick={onSalir}>
          <span className="cartulina__texto">Salir de la plaza</span>
        </button>
      </div>
    </div>
  );
}
