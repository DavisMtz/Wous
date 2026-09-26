import '../../ui/styles/plaza.css';
import { PLAZA } from '@wous/world-data';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { HudStore } from '../../game/hud-store.ts';
import { type Controls, createControls, TOUCH_CONTROL_ATTR } from '../../game/input/controls.ts';
import { InputSampler } from '../../game/network/input-sampler.ts';
import { createGame, type GameHandle } from '../../game/phaser/create-game.ts';
import type { Look } from '../../game/rendering/pixel-character.ts';
import { Icono } from '../../ui/components/Icono.tsx';
import { Estrella, Rotulo } from '../../ui/components/Tianguis.tsx';
import { prefersReducedMotion } from '../../ui/motion.ts';
import { GiraTuTelefono } from './GiraTuTelefono.tsx';
import { Joystick } from './Joystick.tsx';
import { Pistas } from './Pistas.tsx';

declare global {
  interface Window {
    /** Solo en desarrollo: lo que las pruebas E2E leen del juego. */
    __wousJuego?: { posicion(): { x: number; y: number } | null; metodo(): string };
  }
}

const VERTICAL = '(orientation: portrait)';

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
  );
}

/**
 * La Plaza: el lienzo de Phaser a pantalla completa y, encima, el HUD de
 * papel del tianguis. Aquí se arma la entrada (InputManager y adaptadores),
 * se arranca el juego y se conecta el puente del HUD.
 */
export function PlazaJuego({
  look,
  onSalir,
  spawn,
}: {
  look: Look;
  onSalir: () => void;
  /** Dónde aparecer (el banco de desarrollo lo usa para revisar cada rincón). */
  spawn?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameHandle | null>(null);
  const [controls, setControls] = useState<Controls | null>(null);
  const hud = useMemo(
    () =>
      new HudStore({
        sala: PLAZA.name,
        metodo: 'KEYBOARD_MOUSE',
        cercano: null,
        aviso: null,
        camino: false,
        listo: false,
      }),
    [],
  );
  const state = useSyncExternalStore(hud.subscribe, hud.get);
  const vertical = useMedia(VERTICAL);
  const tactil = controls ? controls.profile.hasTouch && !controls.profile.hover : false;
  const girar = tactil && vertical;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const nextControls = createControls(window);
    setControls(nextControls);
    hud.set({ metodo: nextControls.manager.activeMethod });
    const unsubscribe = nextControls.manager.subscribe((metodo) => hud.set({ metodo }));
    // Fase 4: sin servidor, el muestreador corre igual para que la Fase 5
    // solo cambie el destino de los envíos (el WebSocket).
    const sampler = new InputSampler(() => {});
    const quiet = document.documentElement.dataset.quieto !== undefined || prefersReducedMotion();
    const game = createGame(host, {
      map: PLAZA,
      ...(spawn ? { spawn } : {}),
      look,
      input: nextControls.manager,
      hud,
      quiet,
      cafeAbierto: false,
      onInput: (now, input) => sampler.tick(now, input),
    });
    gameRef.current = game;
    if (import.meta.env.DEV) {
      window.__wousJuego = {
        posicion: () => game.position(),
        metodo: () => nextControls.manager.activeMethod,
      };
    }
    return () => {
      unsubscribe();
      game.destroy();
      gameRef.current = null;
      nextControls.dispose();
      if (import.meta.env.DEV) delete window.__wousJuego;
    };
  }, [hud, look, spawn]);

  // En vertical el juego descansa; al girar, sigue donde estaba.
  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    if (girar) {
      controls?.manager.release();
      game.pause();
    } else {
      game.resume();
    }
  }, [girar, controls]);

  // Los avisos se despegan solos.
  const [avisoVisible, setAvisoVisible] = useState<number | null>(null);
  useEffect(() => {
    if (!state.aviso) return;
    setAvisoVisible(state.aviso.id);
    const timer = window.setTimeout(() => setAvisoVisible(null), 3600);
    return () => window.clearTimeout(timer);
  }, [state.aviso]);

  const metodo = state.metodo;
  const [verbo = '', ...resto] = (state.cercano?.label ?? '').split(' ');

  return (
    <div className="plaza" data-metodo={metodo}>
      <div
        className="plaza__mundo"
        ref={hostRef}
        role="application"
        aria-roledescription="juego"
        aria-label={`${state.sala}. Camina con W A S D o las flechas; E para interactuar.`}
      />

      <header className="hud hud--arriba">
        <div className="letrero">
          <span className="letrero__masking" aria-hidden="true" />
          <h1 className="letrero__sala">{state.sala}</h1>
          <p className="letrero__nota">Solo tú por ahora · la gente llega pronto</p>
        </div>
        <button type="button" className="hud__salir" onClick={onSalir}>
          <Icono name="salir" size={20} />
          <span>Salir</span>
        </button>
      </header>

      <p className="visually-hidden" aria-live="polite">
        {state.cercano
          ? `Cerca: ${state.cercano.label}. ${metodo === 'TOUCH' ? 'Toca la estrella.' : 'Presiona E.'}`
          : ''}
      </p>

      {state.aviso && avisoVisible === state.aviso.id ? (
        <p className="hud__aviso" role="status" key={state.aviso.id}>
          <span className="hud__aviso-masking" aria-hidden="true" />
          {state.aviso.texto}
        </p>
      ) : null}

      <Pistas metodo={metodo} cercano={state.cercano} camino={state.camino} />

      {metodo === 'TOUCH' && controls ? (
        <div className="hud hud--tactil">
          <Joystick touch={controls.touch} />
          {!state.camino ? <p className="hud__guia">Arrastra para caminar</p> : null}
          <div className="hud__contexto" {...{ [TOUCH_CONTROL_ATTR]: '' }}>
            {state.cercano ? (
              <Estrella
                grande={verbo}
                chica={resto.join(' ')}
                color="naranja"
                className="estrella--hud"
                onClick={() => controls.touch.pressInteract()}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {!state.listo ? (
        <div className="plaza__cargando" aria-busy="true">
          <Rotulo className="rotulo--chico" />
          <p>Abriendo la plaza…</p>
        </div>
      ) : null}

      {girar ? <GiraTuTelefono onSalir={onSalir} /> : null}
    </div>
  );
}
