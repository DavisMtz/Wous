import { NETWORK } from '@wous/config';
import type { GameInput } from '@wous/game-core';

/**
 * Cadencia de envío de la intención (§14): a ~12 Hz mientras hay movimiento
 * y pronto cuando cambia la dirección, se suelta o se pide interactuar. Cada
 * envío lleva `seq` creciente (el servidor descarta los viejos).
 *
 * Un joystick análogo cambia en cada cuadro (60–120 Hz en un iPad): los
 * cambios salen con al menos `inputMinGapMs` entre uno y otro, y el cambio
 * que llega antes espera al siguiente cuadro permitido. Soltar, interactuar y
 * los gestos salen en el acto. Sin esto, la sala recibía más de 40 inputs por
 * segundo y terminaba cortando a quien jugaba con el dedo.
 */
export class InputSampler {
  private seq = 0;
  private last: { x: number; y: number } = { x: 0, y: 0 };
  private lastSentAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly send: (input: GameInput) => void,
    private readonly hz: number = NETWORK.inputSendHz,
    private readonly minGapMs: number = NETWORK.inputMinGapMs,
  ) {}

  get lastSeq(): number {
    return this.seq;
  }

  tick(nowMs: number, input: Omit<GameInput, 'seq'>): void {
    const dir = { x: round(input.moveX), y: round(input.moveY) };
    const changed = dir.x !== this.last.x || dir.y !== this.last.y;
    const moving = dir.x !== 0 || dir.y !== 0;
    const since = nowMs - this.lastSentAt;
    const urgent = (changed && !moving) || input.interact || input.emote;
    if (!urgent) {
      const due = moving && since >= 1000 / this.hz;
      if (!changed && !due) return;
      if (since < this.minGapMs) return;
    }

    this.seq += 1;
    this.last = dir;
    this.lastSentAt = nowMs;
    this.send({ ...input, seq: this.seq });
  }
}

/** Una décima basta: el temblor del dedo sobre el joystick no cuenta como cambio. */
function round(v: number): number {
  return Math.round(v * 10) / 10;
}
