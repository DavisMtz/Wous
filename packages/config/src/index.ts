/**
 * Valores configurables de Wous. Un solo lugar para los números del plan:
 * nada de límites, expiraciones o capacidades escritos a mano en el código.
 * Todos los tiempos van en milisegundos (ADR-0004).
 */

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const TIME = { SECOND, MINUTE, HOUR, DAY } as const;

export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;

/** Límites de las peticiones HTTP. */
export const HTTP_LIMITS = {
  /** Tamaño máximo de un cuerpo JSON aceptado por la API. */
  maxJsonBytes: 16 * 1024,
  /** Tamaño máximo de un webhook entrante (Brevo puede agrupar eventos). */
  maxWebhookBytes: 256 * 1024,
} as const;

/** Identidad, tokens y sesiones (§6). */
export const AUTH = {
  verificationTokenTtlMs: 30 * MINUTE,
  passwordResetTokenTtlMs: 20 * MINUTE,
  sessionTtlMs: 30 * DAY,
  /** `last_seen_at` se escribe como máximo cada este intervalo, no en cada petición. */
  sessionTouchIntervalMs: 15 * MINUTE,
  resendVerificationCooldownMs: 60 * SECOND,
  resendVerificationMaxPerDay: 5,
  /** Bytes aleatorios de los tokens de sesión, verificación y reset (256 bits). */
  tokenBytes: 32,
  termsVersion: '2026-01',
} as const;

/** Políticas de nombre de usuario y contraseña. */
export const ACCOUNT_POLICY = {
  usernameMinLength: 3,
  usernameMaxLength: 20,
  passwordMinLength: 10,
  passwordMaxLength: 128,
  emailMaxLength: 254,
} as const;

/** Ventana deslizante simple: `limit` eventos por `windowMs`. */
export type RateLimitRule = { readonly limit: number; readonly windowMs: number };

/** Límites de abuso para endpoints sensibles (§23). */
export const RATE_LIMITS = {
  registerPerIp: { limit: 5, windowMs: 15 * MINUTE },
  loginPerIp: { limit: 10, windowMs: 10 * MINUTE },
  loginPerAccount: { limit: 10, windowMs: 15 * MINUTE },
  forgotPasswordPerIp: { limit: 5, windowMs: HOUR },
  forgotPasswordPerEmail: { limit: 3, windowMs: HOUR },
  resendVerificationPerIp: { limit: 10, windowMs: HOUR },
  resetPasswordPerIp: { limit: 10, windowMs: 15 * MINUTE },
  verifyEmailPerIp: { limit: 20, windowMs: 15 * MINUTE },
} as const satisfies Record<string, RateLimitRule>;

/** Cola de correo y outbox (§7). */
export const EMAIL = {
  /** Reintentos de la cola antes de ir a la DLQ (coincide con wrangler.jsonc). */
  maxQueueRetries: 5,
  /** Un outbox PENDING más viejo que esto lo rescata el barrido programado. */
  sweepPendingAfterMs: 2 * MINUTE,
  /** Máximo de filas que rescata el barrido en una pasada. */
  sweepBatchSize: 50,
} as const;
