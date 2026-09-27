import type { InputMethod } from '@wous/game-core';
import type { ConnectionStatus, EndReason } from './network/world-connection.ts';

/**
 * El puente entre el juego y la interfaz: la escena publica lo que el HUD
 * necesita saber y React lo lee con useSyncExternalStore. La escena nunca
 * importa React y el HUD nunca toca la escena.
 */
export type Cercano = { id: string; label: string } | null;

/** Cruzaste una puerta y se está abriendo la otra sala (la cortina baja mientras). */
export type Transicion = { destino: string; mapa: string } | null;

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
