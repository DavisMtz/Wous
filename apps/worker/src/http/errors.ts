import type { ErrorEnvelope, HttpErrorCode } from '@wous/contracts';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { errorFields } from '../lib/log.ts';
import type { AppHono } from './types.ts';

type ErrorExtra = {
  fields?: Record<string, string>;
  retryAfterSeconds?: number;
};

/**
 * Error de dominio con código estable (§32). Los handlers lanzan AppError y el
 * manejador global lo convierte en el sobre `{ error, requestId }`.
 */
export class AppError extends Error {
  constructor(
    readonly code: HttpErrorCode,
    readonly status: ContentfulStatusCode,
    message: string,
    readonly extra: ErrorExtra = {},
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  invalidRequest: (fields?: Record<string, string>) =>
    new AppError('INVALID_REQUEST', 400, 'La petición no es válida.', fields ? { fields } : {}),
  payloadTooLarge: () => new AppError('PAYLOAD_TOO_LARGE', 413, 'La petición es demasiado grande.'),
  unsupportedMediaType: () =>
    new AppError('UNSUPPORTED_MEDIA_TYPE', 415, 'Se esperaba un cuerpo JSON.'),
  notFound: () => new AppError('NOT_FOUND', 404, 'No encontramos lo que buscas.'),
  forbidden: () => new AppError('FORBIDDEN', 403, 'No tienes permiso para hacer esto.'),
  rateLimited: (retryAfterSeconds: number) =>
    new AppError('RATE_LIMITED', 429, 'Demasiados intentos. Espera un momento.', {
      retryAfterSeconds,
    }),
  unavailable: () =>
    new AppError('SERVICE_UNAVAILABLE', 503, 'El servicio no está disponible ahora mismo.'),
  internal: () => new AppError('INTERNAL_ERROR', 500, 'Algo salió mal. Inténtalo de nuevo.'),
} as const;

export function errorResponse(c: Context<AppHono>, err: AppError) {
  const body: ErrorEnvelope = {
    error: {
      code: err.code,
      message: err.message,
      ...(err.extra.fields ? { fields: err.extra.fields } : {}),
      ...(err.extra.retryAfterSeconds !== undefined
        ? { retryAfterSeconds: err.extra.retryAfterSeconds }
        : {}),
    },
    requestId: c.get('requestId') ?? 'req_desconocido',
  };
  if (err.extra.retryAfterSeconds !== undefined) {
    c.header('Retry-After', String(err.extra.retryAfterSeconds));
  }
  return c.json(body, err.status);
}

/** Manejador global: los AppError salen tal cual; lo demás es 500 sin detalles. */
export function handleError(err: unknown, c: Context<AppHono>) {
  if (err instanceof AppError) return errorResponse(c, err);
  c.get('log')?.error('http.unhandled_error', errorFields(err));
  return errorResponse(c, Errors.internal());
}
