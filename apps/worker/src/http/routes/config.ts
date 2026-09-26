import { AUTH } from '@wous/config';
import type { ClientConfig } from '@wous/contracts';
import { Hono } from 'hono';
import { ok } from '../respond.ts';
import type { AppHono } from '../types.ts';

/**
 * Configuración pública del cliente. Un solo build de la web sirve para
 * staging y producción: lo que cambia por entorno se pide aquí.
 */
export const configRoutes = new Hono<AppHono>().get('/', (c) => {
  const config = c.get('config');
  const body: ClientConfig = {
    environment: config.env,
    turnstileSiteKey: config.turnstileSiteKey,
    termsVersion: AUTH.termsVersion,
  };
  c.header('Cache-Control', 'public, max-age=300');
  return ok(c, body);
});
