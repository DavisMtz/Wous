import { createMiddleware } from 'hono/factory';
import { Errors } from '../errors.ts';
import type { AppHono } from '../types.ts';

/**
 * Cabeceras de seguridad para las respuestas de la API (§22). Las del HTML
 * las pone la capa de assets con `apps/web/public/_headers`.
 */
export const apiSecurityHeaders = createMiddleware<AppHono>(async (c, next) => {
  await next();
  const h = c.res.headers;
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'no-referrer');
  h.set('X-Frame-Options', 'DENY');
  h.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  if (!h.has('Cache-Control')) h.set('Cache-Control', 'no-store');
  if (c.get('config')?.isProduction) {
    h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
});

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Las acciones con efecto exigen `Origin` igual a APP_ORIGIN (§22). Junto con
 * la cookie SameSite=Lax y el cuerpo JSON obligatorio, cierra la puerta a CSRF.
 */
export const requireSameOrigin = createMiddleware<AppHono>(async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) return next();
  const origin = c.req.header('Origin');
  if (!origin || origin !== c.get('config').origin) {
    c.get('log').warn('http.origin_rejected', { origin: origin ?? null });
    throw Errors.forbidden();
  }
  return next();
});
