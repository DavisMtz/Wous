import { API_PREFIX } from '@wous/config';
import { Hono } from 'hono';
import { Errors, errorResponse, handleError } from './http/errors.ts';
import { contextMiddleware } from './http/middleware/context.ts';
import { apiSecurityHeaders, requireSameOrigin } from './http/middleware/security.ts';
import { adminRoutes } from './http/routes/admin.ts';
import { authRoutes } from './http/routes/auth.ts';
import { characterRoutes } from './http/routes/characters.ts';
import { configRoutes } from './http/routes/config.ts';
import { devRoutes } from './http/routes/dev.ts';
import { friendRoutes, preferenceRoutes, userRoutes } from './http/routes/friends.ts';
import { healthRoutes } from './http/routes/health.ts';
import { socialRoutes } from './http/routes/social.ts';
import { webhookRoutes } from './http/routes/webhooks.ts';
import { worldRoutes } from './http/routes/world.ts';
import type { AppHono, Deps } from './http/types.ts';

/**
 * Construye la app HTTP. `index.ts` la usa con las dependencias reales; las
 * pruebas pueden pasar un reloj fijo, un Turnstile falso, etc.
 */
export function createApp(overrides: Partial<Deps> = {}) {
  const app = new Hono<AppHono>();

  app.use('*', contextMiddleware(overrides));
  app.use(`${API_PREFIX}/*`, apiSecurityHeaders);
  app.use(`${API_PREFIX}/*`, requireSameOrigin);

  app.route(`${API_PREFIX}/health`, healthRoutes);
  app.route(`${API_PREFIX}/config`, configRoutes);
  app.route(`${API_PREFIX}/auth`, authRoutes);
  app.route(`${API_PREFIX}/characters`, characterRoutes);
  app.route(`${API_PREFIX}/blocks`, socialRoutes);
  app.route(`${API_PREFIX}/friends`, friendRoutes);
  app.route(`${API_PREFIX}/users`, userRoutes);
  app.route(`${API_PREFIX}/preferences`, preferenceRoutes);
  app.route(`${API_PREFIX}/webhooks`, webhookRoutes);
  app.route(`${API_PREFIX}/admin`, adminRoutes);
  app.route(`${API_PREFIX}/dev`, devRoutes);
  app.route('/ws', worldRoutes);

  app.notFound((c) => errorResponse(c, Errors.notFound()));
  app.onError(handleError);
  return app;
}
