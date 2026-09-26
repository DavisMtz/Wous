import { AppEnv } from '@wous/contracts';
import { z } from 'zod';

/**
 * Configuración del Worker leída y validada UNA vez desde los bindings.
 * Un var mal escrito falla aquí, al arrancar, y no a media petición.
 */
const RuntimeConfig = z.object({
  APP_ENV: AppEnv,
  APP_ORIGIN: z.url(),
  EMAIL_MODE: z.enum(['log', 'brevo']),
});

export type AppConfig = {
  env: AppEnv;
  origin: string;
  emailMode: 'log' | 'brevo';
  isProduction: boolean;
};

export function readConfig(env: Env): AppConfig {
  const parsed = RuntimeConfig.parse({
    APP_ENV: env.APP_ENV,
    APP_ORIGIN: env.APP_ORIGIN,
    EMAIL_MODE: env.EMAIL_MODE,
  });
  return {
    env: parsed.APP_ENV,
    origin: parsed.APP_ORIGIN.replace(/\/$/, ''),
    emailMode: parsed.EMAIL_MODE,
    isProduction: parsed.APP_ENV === 'production',
  };
}

/** Nombres de los secretos: se reporta si existen, jamás su valor. */
export const SECRET_NAMES = [
  'SESSION_PEPPER',
  'TOKEN_PEPPER',
  'TURNSTILE_SECRET_KEY',
  'BREVO_API_KEY',
  'BREVO_WEBHOOK_SECRET',
] as const;

export type SecretName = (typeof SECRET_NAMES)[number];

/** Un secreto cuenta como configurado si tiene longitud razonable. */
export function hasSecret(env: Env, name: SecretName): boolean {
  const value: unknown = env[name];
  return typeof value === 'string' && value.length >= 16;
}
