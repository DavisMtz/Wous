import type { InputMethod } from '@wous/game-core';
import type { Cercano } from '../../game/hud-store.ts';

function Tecla({ children, ancha = false }: { children: string; ancha?: boolean }) {
  return <kbd className={`tecla${ancha ? ' tecla--ancha' : ''}`}>{children}</kbd>;
}

/**
 * Pistas pegadas con masking al pie de la pantalla. Cambian con el método
 * activo sin recargar (§11): teclado, mando o nada (en táctil hablan los
 * controles). La de caminar se retira después de la primera vuelta.
 */
export function Pistas({
  metodo,
  cercano,
  camino,
}: {
  metodo: InputMethod;
  cercano: Cercano;
  camino: boolean;
}) {
  if (metodo === 'TOUCH') return null;
  const mando = metodo === 'GAMEPAD';
  return (
    <div className="pistas" data-metodo={metodo}>
      {!camino ? (
        <p className="pista">
          {mando ? (
            <Tecla ancha>Palanca</Tecla>
          ) : (
            <span className="pista__teclas">
              <Tecla>W</Tecla>
              <Tecla>A</Tecla>
              <Tecla>S</Tecla>
              <Tecla>D</Tecla>
              <span className="pista__o">o</span>
              <Tecla>←</Tecla>
              <Tecla>↑</Tecla>
              <Tecla>↓</Tecla>
              <Tecla>→</Tecla>
            </span>
          )}
          <span className="pista__texto">para caminar</span>
        </p>
      ) : null}
      {cercano ? (
        <p className="pista pista--accion">
          <Tecla>{mando ? 'A' : 'E'}</Tecla>
          <span className="pista__texto">{cercano.label}</span>
        </p>
      ) : null}
    </div>
  );
}
