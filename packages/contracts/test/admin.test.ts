import { describe, expect, it } from 'vitest';
import {
  CreateInvitationRequest,
  formatInvitationCode,
  InvitationCodeInput,
  ModerationReason,
  normalizeInvitationCode,
  RegisterRequest,
  SanctionRequest,
} from '../src/index.ts';

describe('códigos de invitación (ADR-0012)', () => {
  it('se leen con tolerancia: minúsculas, espacios, guiones y letras que se confunden', () => {
    expect(normalizeInvitationCode('7K2QD-M9XHF')).toBe('7K2QDM9XHF');
    expect(normalizeInvitationCode('  7k2qd m9xhf ')).toBe('7K2QDM9XHF');
    expect(normalizeInvitationCode('7K2QD–M9XHF')).toBe('7K2QDM9XHF');
    // O se lee 0; I y L se leen 1 (Crockford).
    expect(normalizeInvitationCode('OOIIL-00000')).toBe('0011100000');
  });

  it('rechaza lo que no tiene forma de código', () => {
    expect(normalizeInvitationCode('')).toBeNull();
    expect(normalizeInvitationCode('7K2QD-M9XH')).toBeNull();
    expect(normalizeInvitationCode('7K2QD-M9XHFF')).toBeNull();
    // La U no existe en el alfabeto de Crockford.
    expect(normalizeInvitationCode('UUUUU-UUUUU')).toBeNull();
    expect(normalizeInvitationCode('<script>')).toBeNull();
  });

  it('se muestra en dos mitades', () => {
    expect(formatInvitationCode('7K2QDM9XHF')).toBe('7K2QD-M9XHF');
  });

  it('el formulario pide el código y avisa si no tiene forma', () => {
    expect(InvitationCodeInput.safeParse('').success).toBe(false);
    expect(InvitationCodeInput.safeParse('hola').success).toBe(false);
    expect(InvitationCodeInput.safeParse('7k2qd-m9xhf').success).toBe(true);
  });

  it('el registro lo acepta como opcional (con registro abierto no hace falta)', () => {
    const base = {
      email: 'ana@example.com',
      username: 'ana_luz',
      password: 'Plaza-de-noche-42',
      turnstileToken: 'x',
      termsVersion: '2026-01',
    };
    expect(RegisterRequest.safeParse(base).success).toBe(true);
    expect(RegisterRequest.safeParse({ ...base, invitationCode: '7K2QD-M9XHF' }).success).toBe(
      true,
    );
    expect(RegisterRequest.safeParse({ ...base, invitationCode: 'nop' }).success).toBe(false);
  });
});

describe('la caseta', () => {
  it('el motivo se limpia y es obligatorio', () => {
    expect(ModerationReason.safeParse('  ').success).toBe(false);
    const limpio = ModerationReason.safeParse(' Insultos\nen   la plaza ');
    expect(limpio.success && limpio.data).toBe('Insultos en la plaza');
    expect(ModerationReason.safeParse('x'.repeat(301)).success).toBe(false);
  });

  it('silenciar lleva horas; suspender puede llevarlas; lo demás, no', () => {
    const ok = (body: unknown) => SanctionRequest.safeParse(body).success;
    expect(ok({ action: 'MUTE', hours: 24, reason: 'flood' })).toBe(true);
    expect(ok({ action: 'MUTE', reason: 'flood' })).toBe(false);
    expect(ok({ action: 'SUSPEND', reason: 'acoso' })).toBe(true);
    expect(ok({ action: 'SUSPEND', hours: 72, reason: 'acoso' })).toBe(true);
    expect(ok({ action: 'BAN', hours: 3, reason: 'spam' })).toBe(false);
    expect(ok({ action: 'SUSPEND', hours: 24 * 91, reason: 'acoso' })).toBe(false);
    expect(ok({ action: 'SUSPEND', hours: 0, reason: 'acoso' })).toBe(false);
  });

  it('es un objeto estricto: nada de campos colados (quién actúa lo dice el servidor)', () => {
    expect(
      SanctionRequest.safeParse({ action: 'BAN', reason: 'spam', actorAccountId: 'acc_x' }).success,
    ).toBe(false);
    expect(SanctionRequest.safeParse({ action: 'BORRAR', reason: 'spam' }).success).toBe(false);
  });

  it('una invitación nueva lleva nombre, usos y vencimiento dentro de los topes', () => {
    const ok = (body: unknown) => CreateInvitationRequest.safeParse(body).success;
    expect(ok({ label: 'Primos', maxUses: 5, expiresInDays: 30 })).toBe(true);
    expect(ok({ label: 'P', maxUses: 5, expiresInDays: 30 })).toBe(false);
    expect(ok({ label: 'Primos', maxUses: 0, expiresInDays: 30 })).toBe(false);
    expect(ok({ label: 'Primos', maxUses: 51, expiresInDays: 30 })).toBe(false);
    expect(ok({ label: 'Primos', maxUses: 5, expiresInDays: 91 })).toBe(false);
    expect(ok({ label: 'Primos', maxUses: 5 })).toBe(false);
  });
});
