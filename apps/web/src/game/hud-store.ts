import type { InputMethod } from '@wous/game-core';

/**
 * El puente entre el juego y la interfaz: la escena publica lo que el HUD
 * necesita saber y React lo lee con useSyncExternalStore. La escena nunca
 * importa React y el HUD nunca toca la escena.
 */
export type Cercano = { id: string; label: string } | null;

export type HudState = {
  sala: string;
  metodo: InputMethod;
  /** Lo que el botón contextual haría ahora («Entrar al Café»), o nada. */
  cercano: Cercano;
  /** Un aviso breve del mundo (se reemplaza por id). */
  aviso: { id: number; texto: string } | null;
  /** Ya caminó al menos una vez: las pistas de arranque se retiran. */
  camino: boolean;
  /** La escena ya pintó su primer cuadro. */
  listo: boolean;
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
