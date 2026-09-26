import { AccountId } from '@wous/contracts';
import { describe, expect, it } from 'vitest';
import { FixedClock } from '../src/lib/clock.ts';
import { createIdGenerator, ulid } from '../src/lib/ids.ts';

describe('ULID', () => {
  it('codifica el tiempo en los 10 primeros caracteres', () => {
    expect(ulid(0, new Uint8Array(10))).toBe('0'.repeat(26));
    expect(ulid(2 ** 48 - 1, new Uint8Array(10)).slice(0, 10)).toBe('7ZZZZZZZZZ');
  });

  it('usa los 80 bits aleatorios en los 16 últimos', () => {
    expect(ulid(0, new Uint8Array(10).fill(255)).slice(10)).toBe('Z'.repeat(16));
  });

  it('se ordena por tiempo', () => {
    const a = ulid(1_000);
    const b = ulid(2_000);
    expect(a < b).toBe(true);
  });

  it('rechaza tiempos fuera de rango', () => {
    expect(() => ulid(-1)).toThrow(RangeError);
    expect(() => ulid(2 ** 48)).toThrow(RangeError);
  });
});

describe('IdGenerator', () => {
  it('produce IDs con prefijo que valida el contrato', () => {
    const ids = createIdGenerator(new FixedClock(1_790_000_000_000));
    const id = ids.next('account');
    expect(AccountId.safeParse(id).success).toBe(true);
    expect(ids.next('account')).not.toBe(id);
  });
});
