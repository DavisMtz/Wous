/**
 * Reloj del servidor. Toda expiración y cooldown depende de él, nunca del
 * navegador (§9). Es una interfaz para poder fijar el tiempo en las pruebas.
 */
export interface Clock {
  now(): number;
}

export const systemClock: Clock = {
  now: () => Date.now(),
};

/** Reloj controlable para pruebas. */
export class FixedClock implements Clock {
  constructor(private current: number) {}

  now(): number {
    return this.current;
  }

  advance(ms: number): void {
    this.current += ms;
  }
}
