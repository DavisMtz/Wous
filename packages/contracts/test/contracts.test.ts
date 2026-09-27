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

describe('mensajes del mundo', () => {
  it('PLAYER_INPUT es intención: rechaza coordenadas coladas', async () => {
    const { ClientMessage } = await import('../src/index.ts');
    const ok = { v: 1, type: 'PLAYER_INPUT', seq: 3, payload: { moveX: 1, moveY: 0 } };
    expect(ClientMessage.safeParse(ok).success).toBe(true);
    const hack = { ...ok, payload: { moveX: 1, moveY: 0, x: 30, y: 4 } };
    expect(ClientMessage.safeParse(hack).success).toBe(false);
    const tooFast = { ...ok, payload: { moveX: 5, moveY: 0 } };
    expect(ClientMessage.safeParse(tooFast).success).toBe(false);
    const sinSeq = { v: 1, type: 'PLAYER_INPUT', payload: { moveX: 0, moveY: 0 } };
    expect(ClientMessage.safeParse(sinSeq).success).toBe(false);
  });

  it('ENTER_PORTAL solo lleva la puerta: ni sala, ni instancia, ni punto de llegada', async () => {
    const { ClientMessage } = await import('../src/index.ts');
    const ok = { v: 1, type: 'ENTER_PORTAL', payload: { portalId: 'plaza-cafe' } };
    expect(ClientMessage.safeParse(ok).success).toBe(true);
    for (const extra of [{ to: 'cafe' }, { roomId: 'room:cafe:01' }, { spawn: 'desde-plaza' }]) {
      const hack = { ...ok, payload: { ...ok.payload, ...extra } };
      expect(ClientMessage.safeParse(hack).success).toBe(false);
    }
    expect(ClientMessage.safeParse({ ...ok, payload: { portalId: '' } }).success).toBe(false);
  });

  it('el texto del ping es el que la auto-respuesta espera', async () => {
    const { ClientMessage, WS_PING_TEXT, WS_PONG_TEXT } = await import('../src/index.ts');
    expect(WS_PING_TEXT).toBe('{"v":1,"type":"PING"}');
    expect(WS_PONG_TEXT).toBe('{"v":1,"type":"PONG"}');
    expect(ClientMessage.safeParse(JSON.parse(WS_PING_TEXT)).success).toBe(true);
  });
});
