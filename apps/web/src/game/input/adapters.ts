import type { InputMethod } from '@wous/game-core';
import { connectedGamepads } from './device-profile.ts';

/** Lo que aporta una fuente de entrada en un instante. */
export type RawInput = { x: number; y: number; interact: boolean };

export interface InputSource {
  readonly method: InputMethod;
  /** Estado actual; `interact` es de flanco (se consume al leerlo). */
  read(): RawInput;
  /** Suelta todo (la ventana perdió el foco, el juego se pausó…). */
  release(): void;
}

type Activity = (method: InputMethod) => void;

const UP = new Set(['KeyW', 'ArrowUp']);
const DOWN = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const INTERACT = new Set(['KeyE', 'Space']);

/**
 * Teclado (§11): WASD o flechas para moverse, E o espacio para interactuar.
 * Usa `code` (posición física): funciona igual en teclado español o inglés.
 */
export class KeyboardAdapter implements InputSource {
  readonly method = 'KEYBOARD_MOUSE' as const;
  private readonly held = new Set<string>();
  private interactQueued = false;

  constructor(private readonly onActivity: Activity = () => {}) {}

  /** Devuelve true si la tecla pertenece al juego (para evitar el scroll). */
  handleKey(code: string, pressed: boolean, fromEditable: boolean): boolean {
    if (fromEditable) return false;
    const isMove = UP.has(code) || DOWN.has(code) || LEFT.has(code) || RIGHT.has(code);
    const isInteract = INTERACT.has(code);
    if (!isMove && !isInteract) return false;
    if (pressed) {
      this.onActivity(this.method);
      if (isMove) this.held.add(code);
      if (isInteract) this.interactQueued = true;
    } else {
      this.held.delete(code);
    }
    return true;
  }

  read(): RawInput {
    const has = (set: Set<string>) => [...set].some((code) => this.held.has(code));
    const interact = this.interactQueued;
    this.interactQueued = false;
    return {
      x: (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0),
      y: (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0),
      interact,
    };
  }

  release(): void {
    this.held.clear();
    this.interactQueued = false;
  }

  /** Conecta el adaptador a la ventana; devuelve la función para soltarlo. */
  attach(target: Window): () => void {
    const editable = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
    // Con un botón enfocado, Espacio y E son del botón (activarlo), no del juego.
    const control = (el: EventTarget | null) =>
      el instanceof HTMLElement && el.closest('button, a[href], [role="button"]') !== null;
    const scrolls = (code: string) => code.startsWith('Arrow') || code === 'Space';
    const down = (e: KeyboardEvent) => {
      const owned = editable(e.target) || (INTERACT.has(e.code) && control(e.target));
      // Mantener E o Espacio no repite la interacción; solo se evita el scroll.
      if (e.repeat && INTERACT.has(e.code)) {
        if (!owned) e.preventDefault();
        return;
      }
      if (this.handleKey(e.code, true, owned) && scrolls(e.code)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      this.handleKey(e.code, false, false);
    };
    const blur = () => this.release();
    target.addEventListener('keydown', down);
    target.addEventListener('keyup', up);
    target.addEventListener('blur', blur);
    return () => {
      target.removeEventListener('keydown', down);
      target.removeEventListener('keyup', up);
      target.removeEventListener('blur', blur);
    };
  }
}

/**
 * Táctil (§11): lo alimenta el joystick virtual (vector) y el botón contextual
 * (interactuar). El juego nunca sabe que fue un dedo.
 */
export class TouchAdapter implements InputSource {
  readonly method = 'TOUCH' as const;
  private vector = { x: 0, y: 0 };
  private interactQueued = false;

  constructor(private readonly onActivity: Activity = () => {}) {}

  setVector(x: number, y: number): void {
    this.vector = { x, y };
    if (x !== 0 || y !== 0) this.onActivity(this.method);
  }

  pressInteract(): void {
    this.interactQueued = true;
    this.onActivity(this.method);
  }

  read(): RawInput {
    const interact = this.interactQueued;
    this.interactQueued = false;
    return { ...this.vector, interact };
  }

  release(): void {
    this.vector = { x: 0, y: 0 };
    this.interactQueued = false;
  }
}

type PadLike = { axes: readonly number[]; buttons: readonly { pressed: boolean }[] } | null;

/**
 * Gamepad (§11: preparado, no obligatorio en el MVP). Lee el primer mando
 * conectado: palanca izquierda para moverse, botón A para interactuar.
 */
export class GamepadAdapter implements InputSource {
  readonly method = 'GAMEPAD' as const;
  private wasPressed = false;

  constructor(
    private readonly onActivity: Activity = () => {},
    private readonly pads: () => readonly PadLike[] = connectedGamepads,
  ) {}

  read(): RawInput {
    const pad = this.pads().find((p) => p !== null) ?? null;
    if (!pad) return { x: 0, y: 0, interact: false };
    const x = pad.axes[0] ?? 0;
    const y = pad.axes[1] ?? 0;
    const pressed = pad.buttons[0]?.pressed ?? false;
    const interact = pressed && !this.wasPressed;
    this.wasPressed = pressed;
    if (Math.hypot(x, y) > 0.3 || interact) this.onActivity(this.method);
    return { x: Math.hypot(x, y) > 0.2 ? x : 0, y: Math.hypot(x, y) > 0.2 ? y : 0, interact };
  }

  release(): void {
    this.wasPressed = false;
  }
}
