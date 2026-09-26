import { createMiddleware } from 'hono/factory';
import { argon2idHasher } from '../../auth/password.ts';
import { readConfig } from '../../config.ts';
import { systemClock } from '../../lib/clock.ts';
import { createIdGenerator } from '../../lib/ids.ts';
import { createLogger } from '../../lib/log.ts';
import { durableObjectRateLimiter } from '../../security/rate-limit.ts';
import { createTurnstileVerifier } from '../../security/turnstile.ts';
import type { AppHono, Deps } from '../types.ts';

/**
 * Primer middleware: asigna el request ID (§24), la configuración validada, el
 * logger con contexto y las dependencias. Registra un resumen por petición
 * (sin query string: nunca debe acabar un token en el log).
 */
export function contextMiddleware(overrides: Partial<Deps> = {}) {
  return createMiddleware<AppHono>(async (c, next) => {
    const clock = overrides.clock ?? systemClock;
    const ids = overrides.ids ?? createIdGenerator(clock);
    const requestId = ids.next('request');
    c.set('requestId', requestId);
    c.set('session', null);

    const config = readConfig(c.env);
    const log = createLogger({ requestId, environment: config.env });
    c.set('config', config);
    c.set('log', log);
    c.set('deps', {
      clock,
      ids,
      hasher: overrides.hasher ?? argon2idHasher,
      turnstile: overrides.turnstile ?? createTurnstileVerifier(c.env, config, log),
      rateLimiter: overrides.rateLimiter ?? durableObjectRateLimiter(c.env, clock),
    });

    const started = Date.now();
    await next();
    // Un 101 (WebSocket) trae cabeceras inmutables: ahí no se agrega nada.
    if (c.res.status !== 101) c.res.headers.set('X-Request-Id', requestId);
    log.info('http.request', {
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      status: c.res.status,
      durationMs: Date.now() - started,
    });
  });
}
