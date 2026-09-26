import { NETWORK } from '@wous/config';
import type { GameInput } from '@wous/game-core';

/**
 * Cadencia de envío de la intención (§14): a ~12 Hz mientras hay movimiento
 * y en el acto cuando cambia la dirección, se suelta o se pide interactuar.
 * Cada envío lleva `seq` creciente (el servidor descarta los viejos).
 *
 * En la Fase 4 no hay servidor: `send` alimenta la predicción local. En la
 * Fase 5 el mismo flujo va al WebSocket sin tocar el juego.
 */
export class InputSampler {
  private seq = 0;
  private last: { x: number; y: number } = { x: 0, y: 0 };
  private lastSentAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly send: (input: GameInput) => void,
    private readonly hz: number = NETWORK.inputSendHz,
  ) {}

  get lastSeq(): number {
    return this.seq;
  }

  tick(nowMs: number, input: Omit<GameInput, 'seq'>): void {
    const dir = { x: round(input.moveX), y: round(input.moveY) };
    const changed = dir.x !== this.last.x || dir.y !== this.last.y;
    const moving = dir.x !== 0 || dir.y !== 0;
    const due = moving && nowMs - this.lastSentAt >= 1000 / this.hz;
    if (!changed && !due && !input.interact && !input.emote) return;

    this.seq += 1;
    this.last = dir;
    this.lastSentAt = nowMs;
    this.send({ ...input, seq: this.seq });
  }
}

/** Dos decimales bastan: evita reenvíos por ruido del joystick. */
function round(v: number): number {
  return Math.round(v * 100) / 100;
}
