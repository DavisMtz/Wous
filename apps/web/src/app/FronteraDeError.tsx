import { Component, type ReactNode } from 'react';
import { OrillaDeLona, Rotulo } from '../ui/components/Tianguis.tsx';

type Props = { children: ReactNode; titulo: string; onSalir: () => void };

/**
 * Si una pantalla truena (o su código no llega), la lona baja con una salida
 * en vez de dejar la página en blanco.
 */
export class FronteraDeError extends Component<Props, { error: boolean }> {
  override state = { error: false };

  static getDerivedStateFromError(): { error: boolean } {
    return { error: true };
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="gira" role="alert" data-lona="naranja">
        <OrillaDeLona />
        <div className="gira__cuerpo">
          <Rotulo className="rotulo--chico" />
          <h1 className="gira__titulo">{this.props.titulo}</h1>
          <p className="gira__texto">Recarga la página; si sigue igual, vuelve en un ratito.</p>
          <button
            type="button"
            className="cartulina cartulina--trazo gira__salir"
            onClick={() => window.location.reload()}
          >
            <span className="cartulina__texto">Recargar</span>
          </button>
          <button
            type="button"
            className="cartulina cartulina--trazo gira__salir"
            onClick={this.props.onSalir}
          >
            <span className="cartulina__texto">Regresar a la casa</span>
          </button>
        </div>
      </div>
    );
  }
}
