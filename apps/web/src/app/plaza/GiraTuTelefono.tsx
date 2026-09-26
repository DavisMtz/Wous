import { OrillaDeLona } from '../../ui/components/Tianguis.tsx';

/**
 * En vertical la plaza no se juega (§11: MVP apaisado). En vez de encoger el
 * mundo, la lona baja y pide girar el teléfono; el juego queda en pausa.
 */
export function GiraTuTelefono({ onSalir }: { onSalir: () => void }) {
  return (
    <div className="gira" role="dialog" aria-modal="true" aria-labelledby="gira-titulo">
      <OrillaDeLona />
      <div className="gira__cuerpo">
        <svg className="gira__telefono" viewBox="0 0 120 120" aria-hidden="true">
          <g className="gira__giro">
            <rect x="38" y="16" width="44" height="88" rx="9" className="gira__marco" />
            <rect x="44" y="26" width="32" height="64" rx="2" className="gira__pantalla" />
            <circle cx="60" cy="97" r="3" className="gira__boton" />
          </g>
          <path d="M100 44c6 10 6 22 0 32M94 72l6 5 5-7" className="gira__flecha" />
        </svg>
        <h1 className="gira__titulo" id="gira-titulo">
          Gira tu teléfono
        </h1>
        <p className="gira__texto">La plaza se ve de lado. Ponlo horizontal y sigue caminando.</p>
        <button type="button" className="cartulina cartulina--trazo gira__salir" onClick={onSalir}>
          <span className="cartulina__texto">Salir de la plaza</span>
        </button>
      </div>
    </div>
  );
}
