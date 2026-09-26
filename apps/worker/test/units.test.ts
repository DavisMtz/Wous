import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import {
  isReservedUsername,
  normalizeEmail,
  normalizeUsername,
} from '../src/accounts/normalize.ts';
import { checkPassword } from '../src/accounts/password-policy.ts';
import { argon2idHasher } from '../src/auth/password.ts';
import { hashOneTimeToken } from '../src/auth/tokens.ts';
import { readConfig } from '../src/config.ts';
import { createBrevoProvider } from '../src/email/brevo.ts';
import { buildTemplateParams } from '../src/email/catalog.ts';
import { EmailSendError } from '../src/email/provider.ts';
import { isAllowedRecipient, retryDelaySeconds } from '../src/email/queue-consumer.ts';
import { decryptString, encryptString, randomToken } from '../src/lib/crypto.ts';
import { createLogger } from '../src/lib/log.ts';
import { createTurnstileVerifier } from '../src/security/turnstile.ts';

describe('normalización', () => {
  it('el correo se compara sin mayúsculas ni espacios, sin tocar puntos ni +', () => {
    expect(normalizeEmail('  Ana.Maria+wous@Example.COM ')).toBe('ana.maria+wous@example.com');
  });

  it('el nombre de usuario se compara sin mayúsculas', () => {
    expect(normalizeUsername(' DaVid_01 ')).toBe('david_01');
  });

  it('reserva los nombres del equipo', () => {
    expect(isReservedUsername('admin')).toBe(true);
    expect(isReservedUsername('wous_oficial')).toBe(true);
    expect(isReservedUsername('adminia')).toBe(false);
  });
});

describe('política de contraseña', () => {
  const who = { username: 'david', email: 'davidm@example.com' };
  it('rechaza comunes, repetidas y las que contienen la identidad', () => {
    expect(checkPassword('Contraseña123', who)).toBe('COMMON');
    expect(checkPassword('aaaaaaaaaaaa', who)).toBe('REPEATED');
    expect(checkPassword('mi-David-2026!', who)).toBe('CONTAINS_IDENTITY');
    expect(checkPassword('xx-davidm-xx-9', who)).toBe('CONTAINS_IDENTITY');
  });
  it('acepta una frase razonable', () => {
    expect(checkPassword('Plaza de noche 42', who)).toBeNull();
  });
});

describe('Argon2id', () => {
  it('hashea con los parámetros del ADR y verifica', async () => {
    const hash = await argon2idHasher.hash('una frase larga 123');
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(await argon2idHasher.verify(hash, 'una frase larga 123')).toBe(true);
    expect(await argon2idHasher.verify(hash, 'otra frase larga 123')).toBe(false);
    expect(argon2idHasher.needsRehash(hash)).toBe(false);
    expect(argon2idHasher.needsRehash('$argon2id$v=19$m=65536,t=3,p=4$abc$def')).toBe(true);
  });
});

describe('criptografía', () => {
  it('los tokens son de 256 bits en base64url', () => {
    const token = randomToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(token);
  });

  it('el HMAC separa dominios: un token de verificación no vale como reset', async () => {
    const token = randomToken();
    const verify = await hashOneTimeToken(env, 'verify', token);
    const reset = await hashOneTimeToken(env, 'reset', token);
    expect(verify).not.toBe(reset);
  });

  it('AES-GCM cifra y descifra; con otra etiqueta no descifra', async () => {
    const sealed = await encryptString('pepper-de-prueba-123', 'etiqueta/a', 'secreto');
    expect(sealed).not.toContain('secreto');
    expect(await decryptString('pepper-de-prueba-123', 'etiqueta/a', sealed)).toBe('secreto');
    await expect(decryptString('pepper-de-prueba-123', 'etiqueta/b', sealed)).rejects.toThrow();
  });
});

describe('correo', () => {
  it('arma los enlaces con URL, no concatenando', () => {
    const params = buildTemplateParams(
      'PASSWORD_RESET',
      { displayName: 'Ana', expiresMinutes: 20 },
      'tok_123-_abc',
      'https://wous.logidma.com',
    );
    expect(params.resetUrl).toBe('https://wous.logidma.com/reset-password?token=tok_123-_abc');
    expect(params.expiresMinutes).toBe(20);
  });

  it('lista permitida por correo exacto o por @dominio', () => {
    expect(isAllowedRecipient([], 'cualquiera@x.com')).toBe(true);
    expect(isAllowedRecipient(['@logidma.com'], 'ana@logidma.com')).toBe(true);
    expect(isAllowedRecipient(['yo@gmail.com'], 'YO@gmail.com')).toBe(true);
    expect(isAllowedRecipient(['@logidma.com'], 'ana@gmail.com')).toBe(false);
  });

  it('la espera entre reintentos crece y tiene tope', () => {
    expect([1, 2, 3, 10].map(retryDelaySeconds)).toEqual([30, 60, 120, 900]);
  });

  it('clasifica los errores de Brevo: 400 permanente; 401, 429 y 5xx transitorios', async () => {
    const send = async (status: number) => {
      const provider = createBrevoProvider({
        apiKey: 'k',
        sender: { name: 'Wous', email: 'wous@logidma.com' },
        fetchFn: (async () => new Response('{}', { status })) as typeof fetch,
      });
      try {
        await provider.send({
          outboxId: 'obx_x',
          type: 'WELCOME_EMAIL',
          to: { email: 'a@b.com', name: 'A' },
          templateId: 3,
          params: {},
        });
        return 'ok';
      } catch (err) {
        return err instanceof EmailSendError && err.permanent ? 'permanente' : 'transitorio';
      }
    };
    expect(await send(400)).toBe('permanente');
    expect(await send(401)).toBe('transitorio');
    expect(await send(429)).toBe('transitorio');
    expect(await send(503)).toBe('transitorio');
  });
});

describe('Turnstile', () => {
  const stagingLike = {
    ...readConfig(env),
    env: 'staging' as const,
    origin: 'https://wous-staging.logidma.workers.dev',
  };
  const verifierWith = (response: unknown) =>
    createTurnstileVerifier(env, stagingLike, createLogger(), (async () =>
      Response.json(response)) as typeof fetch);

  it('acepta un token válido del hostname y la acción esperados', async () => {
    const v = verifierWith({
      success: true,
      hostname: 'wous-staging.logidma.workers.dev',
      action: 'register',
    });
    expect(await v.verify('t', { action: 'register', remoteIp: null })).toBe(true);
  });

  it('rechaza otro hostname, otra acción o un fallo', async () => {
    const otherHost = verifierWith({ success: true, hostname: 'evil.example', action: 'register' });
    expect(await otherHost.verify('t', { action: 'register', remoteIp: null })).toBe(false);
    const otherAction = verifierWith({
      success: true,
      hostname: 'wous-staging.logidma.workers.dev',
      action: 'login',
    });
    expect(await otherAction.verify('t', { action: 'register', remoteIp: null })).toBe(false);
    const failed = verifierWith({ success: false, 'error-codes': ['invalid-input-response'] });
    expect(await failed.verify('t', { action: 'register', remoteIp: null })).toBe(false);
  });
});
