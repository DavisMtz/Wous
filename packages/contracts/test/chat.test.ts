import { CHAT } from '@wous/config';
import { describe, expect, it } from 'vitest';
import {
  ChatSendMessage,
  ClientMessage,
  chatLength,
  ReportPlayerMessage,
  ServerMessage,
  sanitizeChat,
} from '../src/index.ts';

const clean = (raw: string) => {
  const r = sanitizeChat(raw);
  return r.ok ? r.text : `✗${r.reason}`;
};

describe('saneado del chat (§18)', () => {
  it('el HTML y los scripts quedan como texto: no se escapan ni se quitan', () => {
    expect(clean('<img src=x onerror=alert(1)>')).toBe('<img src=x onerror=alert(1)>');
    expect(clean('<script>alert("hola")</script>')).toBe('<script>alert("hola")</script>');
    expect(clean('te quiero <3')).toBe('te quiero <3');
  });

  it('quita controles, marcas de dirección e invisibles; conserva el texto', () => {
    expect(clean('hola‮adiós')).toBe('holaadiós');
    expect(clean('ho​la⁦!⁩')).toBe('hola!');
    expect(clean('\u0007ding\u0000')).toBe('ding');
    expect(clean('uno\ndos\r\ntres\tcuatro')).toBe('uno dos tres cuatro');
    expect(clean('﻿bom')).toBe('bom');
    expect(clean('privado')).toBe('privado');
  });

  it('los rellenos que se ven como espacio cuentan como espacio', () => {
    expect(clean('aㅤㅤb')).toBe('a b');
    expect(clean('ㅤᅟᅠ⠀')).toBe('✗EMPTY');
  });

  it('colapsa espacios y recorta orillas', () => {
    expect(clean('   hola      qué     onda   ')).toBe('hola qué onda');
    expect(clean('a  　b')).toBe('a b');
  });

  it('un mensaje sin nada visible está vacío', () => {
    expect(clean('')).toBe('✗EMPTY');
    expect(clean('    ')).toBe('✗EMPTY');
    expect(clean('​‍‍')).toBe('✗EMPTY');
    expect(clean('́́')).toBe('✗EMPTY');
  });

  it('respeta los emojis compuestos (ZWJ, tono de piel, banderas, teclas)', () => {
    const familia = '👨‍👩‍👧';
    expect(clean(familia)).toBe(familia);
    expect(clean('👍🏽')).toBe('👍🏽');
    expect(clean('🇲🇽')).toBe('🇲🇽');
    expect(clean('1️⃣')).toBe('1️⃣');
    expect(clean('❤️')).toBe('❤️');
    // Muchos ZWJ seguidos se vuelven uno.
    expect(clean(`a${'‍'.repeat(20)}b`)).toBe('a‍b');
  });

  it('corta el texto «zalgo»: pocas marcas por letra', () => {
    const zalgo = `a${'̀́̂̃̄̅'.repeat(5)}`;
    expect(chatLength(clean(zalgo))).toBe(1 + CHAT.maxCombiningMarks);
    // Los acentos normales siguen igual (y en NFC).
    expect(clean('él cantó')).toBe('él cantó');
  });

  it('el límite es en caracteres, no en unidades UTF-16', () => {
    expect(clean('😀'.repeat(CHAT.maxChars))).toBe('😀'.repeat(CHAT.maxChars));
    expect(clean('a'.repeat(CHAT.maxChars + 1))).toBe('✗TOO_LONG');
    // Espacios de más no cuentan: se colapsan antes de medir.
    expect(clean(`${'a '.repeat(10)}${' '.repeat(200)}`)).toBe('a a a a a a a a a a');
  });
});

describe('mensajes del chat en el cable', () => {
  it('CHAT_SEND es un objeto estricto: nada más que el texto', () => {
    const base = { v: 1, type: 'CHAT_SEND', payload: { text: 'hola' } };
    expect(ChatSendMessage.safeParse(base).success).toBe(true);
    const extra = { ...base, payload: { text: 'hola', from: 'chr_01J8ZQ4Y7V3M2N6P8R0S1T2V3W' } };
    expect(ClientMessage.safeParse(extra).success).toBe(false);
  });

  it('un reporte nombra el mensaje por ID: mandar el texto lo invalida', () => {
    const report = {
      v: 1,
      type: 'REPORT_PLAYER',
      payload: {
        characterId: 'chr_01J8ZQ4Y7V3M2N6P8R0S1T2V3W',
        reason: 'HARASSMENT',
        messageId: 'msg_01J8ZQ4Y7V3M2N6P8R0S1T2V3W',
      },
    };
    expect(ReportPlayerMessage.safeParse(report).success).toBe(true);
    const conTexto = { ...report, payload: { ...report.payload, text: 'lo que dijo' } };
    expect(ClientMessage.safeParse(conTexto).success).toBe(false);
    const motivoInventado = { ...report, payload: { ...report.payload, reason: 'ME_CAE_MAL' } };
    expect(ClientMessage.safeParse(motivoInventado).success).toBe(false);
  });

  it('los gestos son un catálogo cerrado', () => {
    const emote = (e: string) => ({ v: 1, type: 'EMOTE_PLAY', payload: { emote: e } });
    expect(ClientMessage.safeParse(emote('wave')).success).toBe(true);
    expect(ClientMessage.safeParse(emote('https://evil.example/anim.json')).success).toBe(false);
  });

  it('un ERROR con los campos nuevos sigue siendo un ERROR', () => {
    const error = {
      v: 1,
      type: 'ERROR',
      payload: { code: 'RATE_LIMITED', message: 'x', about: 'CHAT_SEND', retryAfterMs: 1200 },
    };
    expect(ServerMessage.safeParse(error).success).toBe(true);
  });
});
