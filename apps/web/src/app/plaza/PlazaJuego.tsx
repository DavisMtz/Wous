import '../../ui/styles/plaza.css';
import '../../ui/styles/charla.css';
import type { Emote, ReportReason, ServerMessage } from '@wous/contracts';
import { getMap, type MapDef, PLAZA } from '@wous/world-data';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { HudStore } from '../../game/hud-store.ts';
import { type Controls, createControls, TOUCH_CONTROL_ATTR } from '../../game/input/controls.ts';
import { ChatLog } from '../../game/network/chat-log.ts';
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
import { useAmigos } from '../amigos/useAmigos.ts';
import { Charla, type LineaDeChat } from './Charla.tsx';
import { CortinaDeSala } from './CortinaDeSala.tsx';
import { type AmistadEnFicha, FichaDePersona } from './FichaDePersona.tsx';
import { FinDeConexion } from './FinDeConexion.tsx';
import { GenteAqui } from './GenteAqui.tsx';
import { Gestos } from './Gestos.tsx';
import { GiraTuTelefono } from './GiraTuTelefono.tsx';
import { Joystick } from './Joystick.tsx';
import { Pistas } from './Pistas.tsx';
import { Placa } from './Placa.tsx';

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
      /** Quién tiene un globo o un gesto encima ahora. */
      colgado(): { id: string; globo: boolean; gesto: string | null }[];
      /** Presentes que bloqueaste. */
      bloqueados(): string[];
      /** Tus amigos que la escena marca (por personaje). */
      amigos(): string[];
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

/** Pedidos de la ficha: sus errores los contesta la ficha, no el chat. */
const PEDIDOS_SOCIALES = new Set(['BLOCK_PLAYER', 'UNBLOCK_PLAYER', 'REPORT_PLAYER']);

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
 *
 * Encima del mundo, la plática (Fase 7): el chat de papel, los gestos y la
 * ficha de cada persona para reportarla o bloquearla.
 */
export function PlazaJuego({
  look,
  nombre,
  onSalir,
  spawn,
  mapa,
  inicio,
  zoom,
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
  /** Solo el banco de desarrollo: dónde aparecer (tiles). */
  inicio?: { x: number; y: number };
  /** Solo el banco de desarrollo: zoom fijo. */
  zoom?: number;
  /** Sin red (banco de desarrollo): solo tú, como en la Fase 4. */
  conectar?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameHandle | null>(null);
  const connectionRef = useRef<WorldConnection | null>(null);
  const chatLogRef = useRef<ChatLog | null>(null);
  const roomRef = useRef<RoomState | null>(null);
  // Tu banda (ADR-0011): la ficha agrega y acepta, y la escena marca a tus amigos.
  const amigos = useAmigos({ activo: conectar });
  const amigosRef = useRef(amigos);
  amigosRef.current = amigos;
  const idsDeAmigos = useMemo(
    () => amigos.listas?.friends.map((f) => f.characterId) ?? [],
    [amigos.listas],
  );
  const [controls, setControls] = useState<Controls | null>(null);
  const [charlaAbierta, setCharlaAbierta] = useState(false);
  const hud = useMemo(
    () =>
      new HudStore({
        sala: '',
        mapa: conectar ? '' : (getMap(mapa ?? '') ?? PLAZA).id,
        metodo: 'KEYBOARD_MOUSE',
        cercano: null,
        placa: null,
        aviso: null,
        camino: false,
        listo: false,
        conexion: conectar ? 'CONNECTING' : 'SIN_RED',
        fin: null,
        gente: 1,
        transicion: null,
        chat: [],
        salaChat: null,
        yo: null,
        presentes: [],
        bloqueados: [],
        ocultos: [],
        ficha: null,
        avisoChat: null,
        silencioHasta: null,
        social: null,
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
    roomRef.current = room;
    room.setFriends(amigosRef.current.listas?.friends.map((f) => f.characterId) ?? []);
    const chatLog = new ChatLog();
    chatLogRef.current = chatLog;
    let respuestas = 0;
    let avisos = 0;
    let salaActual: string | null = null;
    /** A quién bloqueaste en esta visita: su chat se oculta aunque ya no esté en la sala. */
    const ocultos = new Set<string>();
    const ocultar = (id: string, si: boolean) => {
      if (si === ocultos.has(id)) return;
      if (si) ocultos.add(id);
      else ocultos.delete(id);
      hud.set({ ocultos: [...ocultos] });
    };

    // Quién está y a quién bloqueaste: lo que el HUD enseña en la lista y la ficha.
    const alCambiarLaSala = () => {
      hud.set({
        presentes: [...room.remotes.values()].map((r) => ({
          id: r.id,
          nombre: r.displayName,
          apariencia: r.appearance,
        })),
        bloqueados: [...room.blocked],
      });
    };
    const soltarSala = room.subscribe(alCambiarLaSala);

    let connection: WorldConnection | null = null;
    const onMessage = (message: ServerMessage) => {
      if (message.type === 'ROOM_SNAPSHOT' && !salaConocida(message.payload.room)) {
        // El servidor ya trae otra versión del mundo: seguir aquí sería caminar en otro mapa.
        connection?.stop();
        hud.set({ conexion: 'ENDED', fin: 'UPDATE_REQUIRED' });
        return;
      }
      room.apply(message, performance.now());
      if (chatLog.apply(message)) {
        hud.set({ chat: chatLog.entries, salaChat: chatLog.currentRoom });
      }
      switch (message.type) {
        case 'ROOM_SNAPSHOT': {
          const { room: ref, selfId } = message.payload;
          const sala = `${ref.mapId}:${ref.instance}`;
          // En otra sala, la ficha de alguien de la anterior ya no aplica.
          if (salaActual !== null && salaActual !== sala) hud.set({ ficha: null });
          salaActual = sala;
          for (const id of message.payload.blocked ?? []) ocultar(id, true);
          hud.set({ yo: selfId });
          // Volviste a la misma sala (el cruce no aplicó): la escena no se reinicia y la cortina sube aquí.
          if (ref.mapId === hud.get().mapa) hud.set({ transicion: null });
          return;
        }
        case 'ROOM_TRANSFER': {
          const { name, mapId } = message.payload.to;
          hud.set({ transicion: { destino: name, mapa: mapId } });
          return;
        }
        case 'PLAYER_BLOCKED': {
          respuestas += 1;
          const { characterId, blocked } = message.payload;
          ocultar(characterId, blocked);
          // El bloqueo gana: el servidor ya terminó la amistad o la solicitud.
          if (blocked) amigosRef.current.olvidar(characterId);
          hud.set({
            social: { n: respuestas, tipo: 'bloqueo', id: characterId, bloqueado: blocked },
          });
          return;
        }
        case 'REPORT_ACCEPTED': {
          respuestas += 1;
          hud.set({ social: { n: respuestas, tipo: 'reporte', id: message.payload.characterId } });
          return;
        }
        case 'ERROR': {
          const { code, about, retryAfterMs } = message.payload;
          if (about === 'CHAT_SEND') {
            avisos += 1;
            const espera =
              code === 'RATE_LIMITED' && retryAfterMs
                ? ` (${Math.max(1, Math.ceil(retryAfterMs / 1000))} s)`
                : '';
            hud.set({
              avisoChat: { n: avisos, texto: `${message.payload.message}${espera}` },
              ...(code === 'CHAT_MUTED' && retryAfterMs
                ? { silencioHasta: Date.now() + retryAfterMs }
                : {}),
            });
          } else if (about && PEDIDOS_SOCIALES.has(about)) {
            respuestas += 1;
            hud.set({ social: { n: respuestas, tipo: 'error', texto: message.payload.message } });
          }
          return;
        }
        default:
          return;
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
        ...(inicio ? { inicio } : {}),
        ...(zoom ? { zoom } : {}),
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
                emote: (emote) => net.emote(emote),
                sit: (seatId) => net.sit(seatId),
                stand: () => net.stand(),
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
          colgado: () => handle.hanging(),
          bloqueados: () => [...room.blocked],
          amigos: () => [...room.friends],
        };
      }
    });

    return () => {
      cancelled = true;
      dejarDeEsperar();
      soltarSala();
      unsubscribe();
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', retry);
      connection?.stop();
      connectionRef.current = null;
      chatLogRef.current = null;
      roomRef.current = null;
      game?.destroy();
      gameRef.current = null;
      nextControls.dispose();
      if (import.meta.env.DEV) delete window.__wousJuego;
    };
  }, [hud, look, nombre, spawn, mapa, inicio, zoom, conectar]);

  // Cada cambio en tu banda llega a la escena (la marca en la etiqueta).
  useEffect(() => {
    roomRef.current?.setFriends(idsDeAmigos);
  }, [idsDeAmigos]);

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

  // ─── Plática ────────────────────────────────────────────────────────────

  const decir = useCallback(
    (texto: string): boolean => {
      const net = connectionRef.current;
      if (net) return net.chat(texto);
      // Banco sin red: lo dicho cuelga sobre ti y va al registro.
      const log = chatLogRef.current;
      if (!log) return false;
      log.local({
        id: `msg_local_${Date.now()}`,
        from: 'yo',
        name: nombre ?? 'Tú',
        text: texto,
        at: Date.now(),
      });
      hud.set({ chat: log.entries, salaChat: log.currentRoom });
      gameRef.current?.sayLocal(texto);
      return true;
    },
    [hud, nombre],
  );

  const gesto = useCallback(
    (emote: Emote) => {
      if (!controls) return;
      // Entra al juego como entrada normalizada, por la misma fuente que se usó.
      if (hud.get().metodo === 'TOUCH') controls.touch.pressEmote(emote);
      else controls.keyboard.pressEmote(emote);
    },
    [controls, hud],
  );

  const abrirFicha = useCallback(
    (id: string, nombreDe: string, mensaje: { id: string; texto: string } | null) => {
      hud.set({ ficha: { id, nombre: nombreDe, mensaje } });
    },
    [hud],
  );
  const cerrarFicha = useCallback(() => hud.set({ ficha: null }), [hud]);
  const cerrarPlaca = useCallback(() => hud.set({ placa: null }), [hud]);

  const reportar = useCallback(
    (motivo: ReportReason, nota: string, messageId: string | null): boolean => {
      const net = connectionRef.current;
      const ficha = hud.get().ficha;
      if (!net || !ficha) return false;
      const limpia = nota.trim();
      return net.report({
        characterId: ficha.id,
        reason: motivo,
        ...(messageId ? { messageId } : {}),
        ...(limpia ? { note: limpia } : {}),
      });
    },
    [hud],
  );

  const bloquear = useCallback(
    (bloqueo: boolean): boolean => {
      const net = connectionRef.current;
      const ficha = hud.get().ficha;
      if (!net || !ficha) return false;
      return net.block(ficha.id, bloqueo);
    },
    [hud],
  );

  const alNombre = useCallback(
    (linea: LineaDeChat) =>
      abrirFicha(linea.line.from, linea.line.name, { id: linea.line.id, texto: linea.line.text }),
    [abrirFicha],
  );

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
  const ficha = state.ficha;
  const ocultos = state.ocultos;
  const chatVisible = useMemo(
    () =>
      ocultos.length === 0
        ? state.chat
        : state.chat.filter((e) => e.kind !== 'line' || !ocultos.includes(e.line.from)),
    [state.chat, ocultos],
  );
  const hayPlatica = chatVisible.some((e) => e.kind === 'line' && e.room === state.salaChat);
  const presenteDeFicha = ficha ? state.presentes.find((p) => p.id === ficha.id) : undefined;
  const fichaId = ficha?.id ?? null;
  const amistadDeFicha = useMemo((): AmistadEnFicha | null => {
    // Sin red (banco) o sin tu lista todavía, la ficha no ofrece amistad.
    if (!conectar || !fichaId || !amigos.listas) return null;
    const { relation, entry } = amigos.relacionCon(fichaId);
    return {
      relacion: relation,
      onAgregar: async () => (await amigos.pedir(fichaId)).relation,
      onAceptar: async () => {
        if (!entry) throw new Error('Sin solicitud');
        return (await amigos.aceptar(entry)).relation;
      },
    };
  }, [conectar, fichaId, amigos]);

  return (
    <div className="plaza" data-metodo={metodo}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: tocar a alguien es un atajo; por teclado se llega desde «Gente aquí» y los nombres del chat */}
      <div
        className="plaza__mundo"
        ref={hostRef}
        role="application"
        aria-roledescription="juego"
        aria-label={`${state.sala || 'Wous'}. Camina con W A S D o las flechas; E para interactuar; Enter para hablar; 1 a 4 para los gestos.`}
        onPointerMove={(e) => {
          // Con ratón, la mano dice que a esa persona se le puede hacer clic.
          if (e.pointerType !== 'mouse') return;
          const id = gameRef.current?.personAt(e.clientX, e.clientY) ?? null;
          e.currentTarget.style.cursor = id ? 'pointer' : '';
        }}
        onClick={(e) => {
          const id = gameRef.current?.personAt(e.clientX, e.clientY) ?? null;
          const presente = id ? hud.get().presentes.find((p) => p.id === id) : undefined;
          if (presente) abrirFicha(presente.id, presente.nombre, null);
          else if (hud.get().ficha) cerrarFicha();
        }}
      />

      <header className="hud hud--arriba">
        <div className="letrero">
          <span className="letrero__masking" aria-hidden="true" />
          <h1 className="letrero__sala">{state.sala}</h1>
          <GenteAqui
            nota={nota}
            presentes={state.presentes}
            bloqueados={state.bloqueados}
            onElegir={(p) => abrirFicha(p.id, p.nombre, null)}
          />
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

      {state.placa ? <Placa placa={state.placa} onCerrar={cerrarPlaca} /> : null}

      {metodo === 'TOUCH' && controls ? (
        <div className="hud hud--tactil">
          <Joystick touch={controls.touch} />
          {!state.camino && !hayPlatica ? <p className="hud__guia">Arrastra para caminar</p> : null}
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

      <Charla
        entradas={chatVisible}
        sala={state.salaChat}
        metodo={metodo}
        abierta={charlaAbierta}
        onAbrir={() => setCharlaAbierta(true)}
        onCerrar={() => setCharlaAbierta(false)}
        onDecir={decir}
        onNombre={alNombre}
        aviso={state.avisoChat}
        silencioHasta={state.silencioHasta}
      />

      <Gestos look={look} metodo={metodo} onGesto={gesto} />

      {ficha ? (
        <FichaDePersona
          key={ficha.id + (ficha.mensaje?.id ?? '')}
          ficha={ficha}
          apariencia={presenteDeFicha?.apariencia ?? null}
          bloqueada={state.bloqueados.includes(ficha.id)}
          respuesta={state.social}
          amistad={amistadDeFicha}
          onReportar={reportar}
          onBloquear={bloquear}
          onCerrar={cerrarFicha}
        />
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
