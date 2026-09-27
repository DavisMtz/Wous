import type { GameInput, InputMethod } from '@wous/game-core';
import { normalizeInput } from '@wous/game-core';
import type { InputSource } from './adapters.ts';

type Listener = (method: InputMethod) => void;

/**
 * Junta las fuentes de entrada en un solo `GameInput` normalizado. La escena
 * de Phaser importa ESTO y nada más: nunca un adaptador concreto (§11).
 *
 * Método activo: pasar a táctil es inmediato; dejar el táctil por teclado,
 * ratón o mando espera un momento (debounce), para que un toque accidental
 * del teclado de un híbrido no esconda los controles.
 */
export class InputManager {
  private method: InputMethod;
  private pending: { method: InputMethod; since: number } | null = null;
  private readonly listeners = new Set<Listener>();
  private sources: InputSource[] = [];

  constructor(
    initial: InputMethod,
    private readonly now: () => number = () => performance.now(),
    private readonly debounceMs = 400,
  ) {
    this.method = initial;
  }

  setSources(sources: InputSource[]): void {
    this.sources = sources;
  }

  get activeMethod(): InputMethod {
    return this.method;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Evidencia de uso de un método (tecla, toque, mando, ratón). */
  markActive(method: InputMethod): void {
    if (method === this.method) {
      this.pending = null;
      return;
    }
    if (method === 'TOUCH') {
      this.switchTo(method);
      return;
    }
    if (!this.pending || this.pending.method !== method) {
      this.pending = { method, since: this.now() };
    }
    this.settle();
  }

  /** Aplica un cambio pendiente si ya pasó el debounce (se llama cada cuadro). */
  settle(): void {
    if (this.pending && this.now() - this.pending.since >= this.debounceMs) {
      const next = this.pending.method;
      this.pending = null;
      this.switchTo(next);
    }
  }

  private switchTo(method: InputMethod): void {
    this.pending = null;
    if (method === this.method) return;
    this.method = method;
    for (const listener of this.listeners) listener(method);
  }

  /**
   * Lee todas las fuentes. Gana la primera con movimiento, en el orden del
   * método activo primero; interactuar cuenta si cualquiera lo pidió, y el
   * gesto es el primero que alguna pidió.
   */
  poll(): Omit<GameInput, 'seq'> {
    this.settle();
    const ordered = [...this.sources].sort(
      (a, b) => Number(b.method === this.method) - Number(a.method === this.method),
    );
    let move = { x: 0, y: 0 };
    let interact = false;
    let emote: string | undefined;
    for (const source of ordered) {
      const raw = source.read();
      interact ||= raw.interact;
      emote ??= raw.emote;
      if (move.x === 0 && move.y === 0) move = normalizeInput(raw.x, raw.y);
    }
    return { moveX: move.x, moveY: move.y, interact, ...(emote ? { emote } : {}) };
  }

  release(): void {
    for (const source of this.sources) source.release();
  }
}
