import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AccountId, ErrorEnvelope, WS_PROTOCOL_VERSION, wsEnvelope } from '../src/index.ts';

describe('IDs', () => {
  it('acepta prefijo + ULID', () => {
    expect(AccountId.safeParse('acc_01J8ZQ4Y7V3M2N6P8R0S1T2V3W').success).toBe(true);
  });

  it('rechaza el prefijo de otra entidad', () => {
    expect(AccountId.safeParse('chr_01J8ZQ4Y7V3M2N6P8R0S1T2V3W').success).toBe(false);
  });

  it('rechaza caracteres fuera del alfabeto Crockford', () => {
    expect(AccountId.safeParse('acc_01J8ZQ4Y7V3M2N6P8R0S1T2V3I').success).toBe(false);
  });
});

describe('sobre de error HTTP', () => {
  it('exige un código conocido', () => {
    const ok = ErrorEnvelope.safeParse({
      error: { code: 'INVALID_CREDENTIALS', message: 'No se pudo iniciar sesión' },
      requestId: 'req_01J8ZQ4Y7V3M2N6P8R0S1T2V3W',
    });
    expect(ok.success).toBe(true);

    const unknown = ErrorEnvelope.safeParse({
      error: { code: 'ALGO_INVENTADO', message: 'x' },
      requestId: 'req_x',
    });
    expect(unknown.success).toBe(false);
  });
});

describe('sobre WebSocket', () => {
  const Ping = wsEnvelope('PING', z.object({ t: z.number() }));

  it('valida versión, tipo y payload', () => {
    expect(
      Ping.safeParse({ v: WS_PROTOCOL_VERSION, type: 'PING', payload: { t: 1 } }).success,
    ).toBe(true);
  });

  it('rechaza una versión distinta', () => {
    expect(Ping.safeParse({ v: 99, type: 'PING', payload: { t: 1 } }).success).toBe(false);
  });
});
