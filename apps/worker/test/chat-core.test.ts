import { CHAT, SOCIAL } from '@wous/config';
import { describe, expect, it } from 'vitest';
import {
  buildEvidence,
  type ChatRecord,
  pruneRecent,
  slidingWindow,
  textPrint,
} from '../src/world/chat.ts';

const T = 1_790_000_000_000;

function record(n: number, overrides: Partial<ChatRecord> = {}): ChatRecord {
  return {
    id: `msg_01J8ZQ4Y7V3M2N6P8R0S1T${String(n).padStart(4, '0')}`,
    from: 'chr_01J8ZQ4Y7V3M2N6P8R0S1T2V3W',
    name: 'Alguien',
    text: `mensaje ${n}`,
    at: T + n * 1000,
    acc: 'acc_01J8ZQ4Y7V3M2N6P8R0S1T2V3W',
    ...overrides,
  };
}

describe('ventana deslizante', () => {
  it('deja pasar el límite y después dice cuánto esperar', () => {
    let stamps: number[] = [];
    for (let i = 0; i < CHAT.rate.limit; i++) {
      const check = slidingWindow(stamps, T + i * 100, CHAT.rate);
      expect(check.allowed).toBe(true);
      stamps = check.stamps;
    }
    const lleno = slidingWindow(stamps, T + 1000, CHAT.rate);
    expect(lleno.allowed).toBe(false);
    expect(lleno.retryAfterMs).toBe(CHAT.rate.windowMs - 1000);
    // Pasada la ventana del más viejo, vuelve a caber uno.
    expect(slidingWindow(stamps, T + CHAT.rate.windowMs, CHAT.rate).allowed).toBe(true);
  });
});

describe('huella del texto', () => {
  it('ignora mayúsculas, espacios y puntuación; distingue palabras', () => {
    expect(textPrint('Hola!!')).toBe(textPrint('hola'));
    expect(textPrint('h o l a')).toBe(textPrint('HOLA...'));
    expect(textPrint('hola')).not.toBe(textPrint('holi'));
    expect(textPrint('ÑANDÚ')).toBe(textPrint('ñandú'));
  });
});

describe('ventana reciente', () => {
  it('tira lo vencido y lo que pasa del tope, del más viejo al más nuevo', () => {
    const recent = Array.from({ length: CHAT.recent.max + 3 }, (_, i) => record(i));
    const dropped = pruneRecent(recent, T + CHAT.recent.max * 1000);
    expect(dropped).toHaveLength(3);
    expect(recent).toHaveLength(CHAT.recent.max);

    const viejos = [record(1), record(2), record(3)];
    expect(pruneRecent(viejos, T + 2000 + CHAT.recent.ttlMs + 1)).toHaveLength(2);
    expect(viejos.map((r) => r.text)).toEqual(['mensaje 3']);
  });
});

describe('evidencia de un reporte', () => {
  const target = {
    characterId: 'chr_01J8ZQ4Y7V3M2N6P8R0S1TGGGG',
    accountId: 'acc_01J8ZQ4Y7V3M2N6P8R0S1TGGGG',
    displayName: 'Gil',
    appearance: null,
  };
  const deGil = (n: number) =>
    record(n, { from: target.characterId, acc: target.accountId, name: 'Gil' });

  it('el contexto es corto: pocos mensajes y solo los de antes, dentro de la ventana', () => {
    const muchos = Array.from({ length: 30 }, (_, i) => record(i));
    const recent = [...muchos, deGil(30)];
    const result = buildEvidence(recent, target, deGil(30).id, T + 31_000);
    if (!result.ok) throw new Error('debía aceptarse');
    expect(result.evidence.message?.text).toBe('mensaje 30');
    expect(result.evidence.context).toHaveLength(SOCIAL.reportContext.messages);
    expect(result.evidence.context.at(-1)?.text).toBe('mensaje 29');
    // Nada de cuentas en la evidencia.
    expect(JSON.stringify(result.evidence)).not.toContain('acc_');
  });

  it('un mensaje que ya salió de la ventana se anota por ID y el reporte sigue', () => {
    const result = buildEvidence([deGil(1)], target, 'msg_01J8ZQ4Y7V3M2N6P8R0S1TZZZZ', T + 5000);
    if (!result.ok) throw new Error('debía aceptarse');
    expect(result.evidence.message).toBeNull();
    expect(result.evidence.requestedMessageId).toBe('msg_01J8ZQ4Y7V3M2N6P8R0S1TZZZZ');
  });

  it('un mensaje de otra persona no es evidencia contra esta', () => {
    const ajeno = record(1);
    expect(buildEvidence([ajeno], target, ajeno.id, T + 5000)).toEqual({
      ok: false,
      reason: 'NOT_THEIRS',
    });
  });
});
