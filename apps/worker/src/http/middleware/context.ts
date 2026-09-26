import { createMiddleware } from 'hono/factory';
import { readConfig } from '../../config.ts';
import { systemClock } from '../../lib/clock.ts';
import { createIdGenerator } from '../../lib/ids.ts';
import { createLogger } from '../../lib/log.ts';
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

    const config = readConfig(c.env);
    const log = createLogger({ requestId, environment: config.env });
    c.set('config', config);
    c.set('log', log);
    c.set('deps', { clock, ids });

    const started = Date.now();
    await next();
    c.res.headers.set('X-Request-Id', requestId);
    log.info('http.request', {
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      status: c.res.status,
      durationMs: Date.now() - started,
    });
  });
}
