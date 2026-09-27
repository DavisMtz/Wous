import type { AppearanceInput } from '@wous/contracts';
import type { InputMethod } from '@wous/game-core';
import type { ChatEntry } from './network/chat-log.ts';
import type { ConnectionStatus, EndReason } from './network/world-connection.ts';

/**
 * El puente entre el juego y la interfaz: la escena publica lo que el HUD
 * necesita saber y React lo lee con useSyncExternalStore. La escena nunca
 * importa React y el HUD nunca toca la escena.
 */
export type Cercano = { id: string; label: string } | null;

/** Cruzaste una puerta y se está abriendo la otra sala (la cortina baja mientras). */
export type Transicion = { destino: string; mapa: string } | null;

/** Alguien en la sala (para la lista «Gente aquí» y la ficha). */
export type Presente = { id: string; nombre: string; apariencia: AppearanceInput };

/** La ficha abierta de alguien y, si se abrió desde un mensaje, cuál. */
export type Ficha = { id: string; nombre: string; mensaje: { id: string; texto: string } | null };

/** Lo último que contestó la sala a un bloqueo o un reporte. `n` cambia en cada respuesta. */
export type RespuestaSocial =
  | { n: number; tipo: 'bloqueo'; id: string; bloqueado: boolean }
  | { n: number; tipo: 'reporte'; id: string }
  | { n: number; tipo: 'error'; texto: string };

export type HudState = {
  sala: string;
  /** ID del mapa donde estás (la cortina toma de ahí su lona). */
  mapa: string;
  metodo: InputMethod;
  /** Lo que el botón contextual haría ahora («Entrar al Café»), o nada. */
  cercano: Cercano;
  /** Un aviso breve del mundo (se reemplaza por id). */
  aviso: { id: number; texto: string } | null;
  /** Ya caminó al menos una vez: las pistas de arranque se retiran. */
  camino: boolean;
  /** La escena ya pintó su primer cuadro. */
  listo: boolean;
  /** Estado del cable con la sala; `SIN_RED` en el banco de desarrollo. */
  conexion: ConnectionStatus | 'SIN_RED';
  /** Por qué terminó la conexión (cuando `conexion` es ENDED). */
  fin: EndReason | null;
  /** Personas en la sala contándote a ti. */
  gente: number;
  /** Cambio de sala en curso. */
  transicion: Transicion;
  /** Registro del chat (arreglo nuevo en cada cambio) y la sala actual del registro. */
  chat: readonly ChatEntry[];
  salaChat: string | null;
  /** Tu ID de personaje según la sala. */
  yo: string | null;
  /** Quiénes más están en la sala. */
  presentes: readonly Presente[];
  /** Presentes que bloqueaste. */
  bloqueados: readonly string[];
  /** Todas las personas que bloqueaste en esta visita (aunque ya se hayan ido): su chat no se ve. */
  ocultos: readonly string[];
  ficha: Ficha | null;
  /** Lo que la sala contestó a tu último mensaje (flood, vacío, silencio). */
  avisoChat: { n: number; texto: string } | null;
  /** Silencio de moderación vigente hasta (hora local, epoch ms). */
  silencioHasta: number | null;
  social: RespuestaSocial | null;
};

type Listener = () => void;

export class HudStore {
  private state: HudState;
  private readonly listeners = new Set<Listener>();

  constructor(initial: HudState) {
    this.state = initial;
  }

  get = (): HudState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  set(patch: Partial<HudState>): void {
    let changed = false;
    for (const key of Object.keys(patch) as (keyof HudState)[]) {
      if (!Object.is(this.state[key], patch[key])) changed = true;
    }
    if (!changed) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private avisos = 0;

  avisar(texto: string): void {
    this.avisos += 1;
    this.set({ aviso: { id: this.avisos, texto } });
  }
}
