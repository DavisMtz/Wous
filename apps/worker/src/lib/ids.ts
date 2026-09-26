import { ID_PREFIXES, type IdKind } from '@wous/contracts';
import type { Clock } from './clock.ts';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * ULID: 10 caracteres de tiempo (48 bits, ms) + 16 aleatorios (80 bits).
 * Ordenable por tiempo y no adivinable (ADR-0004).
 */
export function ulid(
  timeMs: number,
  random: Uint8Array = crypto.getRandomValues(new Uint8Array(10)),
) {
  if (!Number.isSafeInteger(timeMs) || timeMs < 0 || timeMs > 2 ** 48 - 1) {
    throw new RangeError('Tiempo fuera del rango de ULID');
  }
  if (random.length !== 10) throw new RangeError('ULID requiere 10 bytes aleatorios');

  let time = timeMs;
  let timePart = '';
  for (let i = 0; i < 10; i++) {
    const mod = time % 32;
    timePart = CROCKFORD.charAt(mod) + timePart;
    time = (time - mod) / 32;
  }

  let randomPart = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of random) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      randomPart += CROCKFORD.charAt((buffer >> bits) & 31);
    }
    buffer &= (1 << bits) - 1;
  }

  return timePart + randomPart;
}

export interface IdGenerator {
  next(kind: IdKind): string;
}

export function createIdGenerator(clock: Clock): IdGenerator {
  return {
    next: (kind) => `${ID_PREFIXES[kind]}_${ulid(clock.now())}`,
  };
}
