import { API_PREFIX } from '@wous/config';
import { Hono } from 'hono';
import { Errors, errorResponse, handleError } from './http/errors.ts';
import { contextMiddleware } from './http/middleware/context.ts';
import { apiSecurityHeaders, requireSameOrigin } from './http/middleware/security.ts';
import { healthRoutes } from './http/routes/health.ts';
import type { AppHono, Deps } from './http/types.ts';

/**
 * Construye la app HTTP. `index.ts` la usa con las dependencias reales; las
 * pruebas pueden pasar un reloj fijo o un generador de IDs determinista.
 */
export function createApp(overrides: Partial<Deps> = {}) {
  const app = new Hono<AppHono>();

  app.use('*', contextMiddleware(overrides));
  app.use(`${API_PREFIX}/*`, apiSecurityHeaders);
  app.use(`${API_PREFIX}/*`, requireSameOrigin);

  app.route(`${API_PREFIX}/health`, healthRoutes);

  app.notFound((c) => errorResponse(c, Errors.notFound()));
  app.onError(handleError);
  return app;
}
