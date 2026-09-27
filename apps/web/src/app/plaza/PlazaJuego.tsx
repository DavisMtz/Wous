import '../../ui/styles/plaza.css';
import type { ServerMessage } from '@wous/contracts';
import { getMap, type MapDef, PLAZA } from '@wous/world-data';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { HudStore } from '../../game/hud-store.ts';
import { type Controls, createControls, TOUCH_CONTROL_ATTR } from '../../game/input/controls.ts';
import { RoomState } from '../../game/network/room-state.ts';
import {
  checkSessionOverHttp,
  WorldConnection,
  worldUrl,
} from '../../game/network/world-connection.ts';
import { createGame, type GameHandle } from '../../game/phaser/create-game.ts';
import { NAME_FONT } from '../../game/phaser/persona.ts';
import type { Look } from '../../game/rendering/pixel-character.ts';
import { Icono } from '../../ui/components/Icono.tsx';
import type { LonaColor } from '../../ui/components/Puesto.tsx';
import { Estrella } from '../../ui/components/Tianguis.tsx';
import { prefersReducedMotion } from '../../ui/motion.ts';
import { CortinaDeSala } from './CortinaDeSala.tsx';
import { FinDeConexion } from './FinDeConexion.tsx';
import { GiraTuTelefono } from './GiraTuTelefono.tsx';
import { Joystick } from './Joystick.tsx';
import { Pistas } from './Pistas.tsx';

declare global {
  interface Window {
    /** Solo en desarrollo: lo que las pruebas E2E leen del juego. */
    __wousJuego?: {
      posicion(): { x: number; y: number } | null;
      metodo(): string;
      remotos(): { id: string; x: number; y: number }[];
      conexion(): string;
      /** ID del mapa donde estás («plaza», «cafe»). */
      sala(): string;
      /** Tu ID de personaje según la sala (null sin red o antes del snapshot). */
      yo(): string | null;
    };
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

/** La fuente de los nombres tiene que estar lista antes del primer texto de Phaser. */
async function fuenteDeNombres(): Promise<void> {
  try {
    await Promise.race([
      document.fonts.load(`600 13px ${NAME_FONT}`),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
  } catch {
    // Sin la fuente se dibuja con la de respaldo: no es motivo para no entrar.
  }
}

const ESTADO_CONEXION: Partial<Record<string, string>> = {
  CONNECTING: 'Entrando…',
  RECONNECTING: 'Se cortó la conexión. Reconectando…',
};

/** La lona de cada sala: la cortina que baja al cruzar es del color de a dónde vas. */
const LONA_DE_SALA: Record<string, LonaColor> = { plaza: 'naranja', cafe: 'rosa' };

/**
 * La sala del snapshot, si este cliente la conoce en esa versión. Si no, el
 * servidor va adelante (despliegue nuevo) y hay que recargar.
 */
function salaConocida(room: { mapId: string; mapVersion: number }): MapDef | null {
  const map = getMap(room.mapId);
  return map && map.version === room.mapVersion ? map : null;
}

/**
 * El mundo: el lienzo de Phaser a pantalla completa y, encima, el HUD de
 * papel del tianguis. Aquí se arma la entrada, el cable con la sala
 * (WorldConnection → RoomState) y el juego, y se conecta el puente del HUD.
 *
 * Con red, la sala la dice el servidor: el juego no arranca hasta el primer
 * snapshot (puedes volver directo al Café) y cambia de sala cuando llega el
 * de otra. Entre una y otra baja la cortina de lona.
 */
export function PlazaJuego({
  look,
  nombre,
  onSalir,
  spawn,
  mapa,
  conectar = true,
}: {
  look: Look;
  /** Tu nombre en la etiqueta de marcatextos. */
  nombre?: string;
  onSalir: () => void;
  /** Dónde aparecer (el banco de desarrollo lo usa para revisar cada rincón). */
  spawn?: string;
  /** Sala del banco de desarrollo (sin red). Con red, la decide el servidor. */
  mapa?: string;
  /** Sin red (banco de desarrollo): solo tú, como en la Fase 4. */
  conectar?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameHandle | null>(null);
  const connectionRef = useRef<WorldConnection | null>(null);
  const [controls, setControls] = useState<Controls | null>(null);
  const hud = useMemo(
    () =>
      new HudStore({
        sala: '',
        mapa: conectar ? '' : (getMap(mapa ?? '') ?? PLAZA).id,
        metodo: 'KEYBOARD_MOUSE',
        cercano: null,
        aviso: null,
        camino: false,
        listo: false,
        conexion: conectar ? 'CONNECTING' : 'SIN_RED',
        fin: null,
        gente: 1,
        transicion: null,
      }),
    [conectar, mapa],
  );
  const state = useSyncExternalStore(hud.subscribe, hud.get);
  const vertical = useMedia(VERTICAL);
  const tactil = controls ? controls.profile.hasTouch && !controls.profile.hover : false;
  const girar = tactil && vertical;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    const nextControls = createControls(window);
    setControls(nextControls);
    hud.set({ metodo: nextControls.manager.activeMethod });
    const unsubscribe = nextControls.manager.subscribe((metodo) => hud.set({ metodo }));

    const room = new RoomState();
    let connection: WorldConnection | null = null;
    const onMessage = (message: ServerMessage) => {
      if (message.type === 'ROOM_SNAPSHOT' && !salaConocida(message.payload.room)) {
        // El servidor ya trae otra versión del mundo: seguir aquí sería caminar en otro mapa.
        connection?.stop();
        hud.set({ conexion: 'ENDED', fin: 'UPDATE_REQUIRED' });
        return;
      }
      room.apply(message, performance.now());
      // Volviste a la misma sala (el cruce no aplicó): la escena no se reinicia y la cortina sube aquí.
      if (message.type === 'ROOM_SNAPSHOT' && message.payload.room.mapId === hud.get().mapa) {
        hud.set({ transicion: null });
      }
      if (message.type === 'ROOM_TRANSFER') {
        const { name, mapId } = message.payload.to;
        hud.set({ transicion: { destino: name, mapa: mapId } });
      }
    };
    connection = conectar
      ? new WorldConnection({
          url: worldUrl(),
          onMessage,
          onStatus: (conexion, fin) => hud.set({ conexion, fin: fin ?? null }),
          checkSession: checkSessionOverHttp,
        })
      : null;
    connectionRef.current = connection;
    connection?.start();

    // Con red, el juego espera a saber en qué sala estás; sin red, la del banco.
    let dejarDeEsperar = () => {};
    const primeraSala = new Promise<MapDef>((resolve) => {
      if (!conectar) {
        resolve(getMap(mapa ?? '') ?? PLAZA);
        return;
      }
      const revisar = () => {
        const map = room.room ? salaConocida(room.room) : null;
        if (!map) return;
        dejarDeEsperar();
        resolve(map);
      };
      dejarDeEsperar = room.subscribe(revisar);
    });
    const retry = () => {
      if (document.visibilityState === 'visible') connection?.retryNow();
    };
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', retry);

    const quiet = document.documentElement.dataset.quieto !== undefined || prefersReducedMotion();
    let game: GameHandle | null = null;
    void Promise.all([primeraSala, fuenteDeNombres()]).then(([map]) => {
      if (cancelled) return;
      const net = connection;
      game = createGame(host, {
        map,
        ...(spawn ? { spawn } : {}),
        look,
        ...(nombre ? { name: nombre } : {}),
        input: nextControls.manager,
        hud,
        quiet,
        ...(net
          ? {
              net: {
                room,
                send: (input) => net.send(input),
                enterPortal: (portalId) => net.enterPortal(portalId),
              },
            }
          : {}),
      });
      gameRef.current = game;
      if (import.meta.env.DEV) {
        const handle = game;
        window.__wousJuego = {
          posicion: () => handle.position(),
          metodo: () => nextControls.manager.activeMethod,
          remotos: () => handle.remotes(),
          conexion: () => hud.get().conexion,
          sala: () => hud.get().mapa,
          yo: () => room.selfId,
        };
      }
    });

    return () => {
      cancelled = true;
      dejarDeEsperar();
      unsubscribe();
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', retry);
      connection?.stop();
      connectionRef.current = null;
      game?.destroy();
      gameRef.current = null;
      nextControls.dispose();
      if (import.meta.env.DEV) delete window.__wousJuego;
    };
  }, [hud, look, nombre, spawn, mapa, conectar]);

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
  const cubierta = !state.listo || state.transicion !== null;
  const estadoConexion = cubierta ? undefined : ESTADO_CONEXION[state.conexion];
  const lona = LONA_DE_SALA[state.transicion?.mapa ?? state.mapa] ?? 'naranja';
  const notaCortina =
    state.conexion === 'RECONNECTING'
      ? 'Se cortó la conexión. Reconectando…'
      : state.transicion
        ? 'Cruzando la puerta…'
        : 'Entrando…';
  const nota =
    state.conexion === 'SIN_RED'
      ? 'Banco de desarrollo · sin conexión'
      : state.gente > 1
        ? `${state.gente} personas aquí`
        : 'Solo tú por ahora';

  return (
    <div className="plaza" data-metodo={metodo}>
      <div
        className="plaza__mundo"
        ref={hostRef}
        role="application"
        aria-roledescription="juego"
        aria-label={`${state.sala || 'Wous'}. Camina con W A S D o las flechas; E para interactuar.`}
      />

      <header className="hud hud--arriba">
        <div className="letrero">
          <span className="letrero__masking" aria-hidden="true" />
          <h1 className="letrero__sala">{state.sala}</h1>
          <p className="letrero__nota" aria-live="polite">
            {nota}
          </p>
        </div>
        <button type="button" className="hud__salir" onClick={onSalir}>
          <Icono name="salir" size={20} />
          <span>Salir</span>
        </button>
      </header>

      {estadoConexion ? (
        <p className="hud__conexion" role="status">
          <span className="hud__conexion-punto" aria-hidden="true" />
          {estadoConexion}
        </p>
      ) : null}

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

      <CortinaDeSala
        cubre={cubierta}
        contenido={{ lona, destino: state.transicion?.destino ?? null, nota: notaCortina }}
      />

      {state.conexion === 'ENDED' && state.fin ? (
        <FinDeConexion
          motivo={state.fin}
          onSeguir={() => connectionRef.current?.start()}
          onSalir={onSalir}
        />
      ) : null}

      {girar ? <GiraTuTelefono onSalir={onSalir} /> : null}
    </div>
  );
}
