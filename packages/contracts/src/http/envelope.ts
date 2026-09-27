import { z } from 'zod';

/**
 * Códigos de error HTTP estables (§32). El frontend decide SIEMPRE por `code`,
 * nunca comparando el texto de `message`. Agregar códigos es seguro;
 * renombrar o reutilizar uno existente rompe a los clientes viejos.
 */
export const HttpErrorCode = z.enum([
  // Genéricos
  'INVALID_REQUEST',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'NOT_FOUND',
  'METHOD_NOT_ALLOWED',
  'FORBIDDEN',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
  // Identidad
  'AUTH_REQUIRED',
  'TURNSTILE_FAILED',
  'INVALID_CREDENTIALS',
  'EMAIL_NOT_VERIFIED',
  'ACCOUNT_NOT_ACTIVE',
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_BANNED',
  'INVALID_EMAIL',
  'INVALID_USERNAME',
  'USERNAME_TAKEN',
  'WEAK_PASSWORD',
  'TERMS_NOT_ACCEPTED',
  'TOKEN_INVALID',
  // Personaje
  'CHARACTER_EXISTS',
  'CHARACTER_REQUIRED',
  'INVALID_APPEARANCE',
  'INVALID_DISPLAY_NAME',
  // Amistades (ADR-0011)
  /** Tu última solicitud a esa persona terminó hace poco: `retryAfterSeconds` dice cuándo. */
  'FRIEND_REQUEST_COOLDOWN',
  /** Llegaste a un tope (amistades, solicitudes sin contestar, bloqueos); la interfaz sabe cuál. */
  'LIMIT_REACHED',
  /** Tienes bloqueada a esa persona: primero desbloquéala. */
  'BLOCKED_BY_YOU',
  // Webhooks
  'WEBHOOK_UNAUTHORIZED',
]);
export type HttpErrorCode = z.infer<typeof HttpErrorCode>;

export const HttpError = z.object({
  code: HttpErrorCode,
  message: z.string(),
  /** Detalle opcional por campo, para formularios. Nunca contiene secretos. */
  fields: z.record(z.string(), z.string()).optional(),
  /** Segundos sugeridos antes de reintentar (RATE_LIMITED). */
  retryAfterSeconds: z.number().int().nonnegative().optional(),
});
export type HttpError = z.infer<typeof HttpError>;

export const ErrorEnvelope = z.object({
  error: HttpError,
  requestId: z.string(),
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>;

export function successEnvelope<T extends z.ZodType>(data: T) {
  return z.object({ data, requestId: z.string() });
}

export type SuccessEnvelope<T> = { data: T; requestId: string };
