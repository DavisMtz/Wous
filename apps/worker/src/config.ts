import { AppEnv } from '@wous/contracts';
import { z } from 'zod';

/**
 * Configuración del Worker leída y validada desde los bindings. Un var mal
 * escrito falla aquí, de forma explícita, y no a media petición.
 */
const TemplateId = z.coerce.number().int().nonnegative();

const RuntimeConfig = z.object({
  APP_ENV: AppEnv,
  APP_ORIGIN: z.url(),
  EMAIL_MODE: z.enum(['log', 'brevo']),
  TURNSTILE_SITE_KEY: z.string().min(1),
  MAIL_FROM_NAME: z.string().min(1),
  MAIL_FROM_EMAIL: z.email(),
  /** Correos o `@dominios` permitidos; vacío = sin restricción. Solo para staging. */
  EMAIL_ALLOWLIST: z.string(),
  BREVO_TEMPLATE_VERIFY_EMAIL: TemplateId,
  BREVO_TEMPLATE_WELCOME: TemplateId,
  BREVO_TEMPLATE_PASSWORD_RESET: TemplateId,
  BREVO_TEMPLATE_PASSWORD_CHANGED: TemplateId,
  BREVO_TEMPLATE_FRIEND_REQUEST: TemplateId,
  BREVO_TEMPLATE_FRIEND_ACCEPTED: TemplateId,
});

export type EmailTemplateKey =
  | 'EMAIL_VERIFY'
  | 'WELCOME_EMAIL'
  | 'PASSWORD_RESET'
  | 'PASSWORD_CHANGED'
  | 'FRIEND_REQUEST'
  | 'FRIEND_ACCEPTED';

export type AppConfig = {
  env: AppEnv;
  origin: string;
  isProduction: boolean;
  turnstileSiteKey: string;
  email: {
    mode: 'log' | 'brevo';
    fromName: string;
    fromEmail: string;
    allowlist: string[];
    templates: Record<EmailTemplateKey, number>;
  };
};

const cache = new WeakMap<object, AppConfig>();

export function readConfig(env: Env): AppConfig {
  const cached = cache.get(env);
  if (cached) return cached;

  const p = RuntimeConfig.parse(env);
  const config: AppConfig = {
    env: p.APP_ENV,
    origin: p.APP_ORIGIN.replace(/\/$/, ''),
    isProduction: p.APP_ENV === 'production',
    turnstileSiteKey: p.TURNSTILE_SITE_KEY,
    email: {
      mode: p.EMAIL_MODE,
      fromName: p.MAIL_FROM_NAME,
      fromEmail: p.MAIL_FROM_EMAIL,
      allowlist: p.EMAIL_ALLOWLIST.split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
      templates: {
        EMAIL_VERIFY: p.BREVO_TEMPLATE_VERIFY_EMAIL,
        WELCOME_EMAIL: p.BREVO_TEMPLATE_WELCOME,
        PASSWORD_RESET: p.BREVO_TEMPLATE_PASSWORD_RESET,
        PASSWORD_CHANGED: p.BREVO_TEMPLATE_PASSWORD_CHANGED,
        FRIEND_REQUEST: p.BREVO_TEMPLATE_FRIEND_REQUEST,
        FRIEND_ACCEPTED: p.BREVO_TEMPLATE_FRIEND_ACCEPTED,
      },
    },
  };
  cache.set(env, config);
  return config;
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
