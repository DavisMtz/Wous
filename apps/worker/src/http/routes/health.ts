import type { DependencyCheck, HealthResponse } from '@wous/contracts';
import { Hono } from 'hono';
import { hasSecret, SECRET_NAMES } from '../../config.ts';
import { errorFields } from '../../lib/log.ts';
import type { AppHono } from '../types.ts';

export const APP_VERSION = '0.1.0';

async function timed(
  probe: () => Promise<string | undefined>,
  onError: (err: unknown) => void,
): Promise<DependencyCheck> {
  const started = performance.now();
  try {
    const detail = await probe();
    const latencyMs = Math.round(performance.now() - started);
    return detail === undefined ? { status: 'ok', latencyMs } : { status: 'ok', latencyMs, detail };
  } catch (err) {
    onError(err);
    return { status: 'down', latencyMs: Math.round(performance.now() - started) };
  }
}

/**
 * Health con dependencias (DoD Fase 1): dice si cada pieza responde o está
 * configurada, nunca valores de secretos ni identificadores internos.
 */
export const healthRoutes = new Hono<AppHono>().get('/', async (c) => {
  const { env } = c;
  const log = c.get('log');
  const config = c.get('config');
  const fail = (dep: string) => (err: unknown) =>
    log.error('health.dependency_down', { dependency: dep, ...errorFields(err) });

  const [d1, r2, durableObjects] = await Promise.all([
    timed(async () => {
      const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM d1_migrations').first<{
        n: number;
      }>();
      return `migraciones aplicadas: ${row?.n ?? 0}`;
    }, fail('d1')),
    timed(async () => {
      await env.ASSETS_BUCKET.head('__health__');
      return undefined;
    }, fail('r2')),
    timed(async () => {
      const stub = env.RATE_LIMIT.get(env.RATE_LIMIT.idFromName('health'));
      await stub.ping();
      return undefined;
    }, fail('durableObjects')),
  ]);

  const configuredSecrets = SECRET_NAMES.filter((name) => hasSecret(env, name)).length;
  const brevoReady = hasSecret(env, 'BREVO_API_KEY');

  const checks: Record<string, DependencyCheck> = {
    d1,
    r2,
    durableObjects,
    emailQueue: { status: 'ok', detail: 'productor configurado' },
    email: {
      status: config.email.mode === 'log' || brevoReady ? 'ok' : 'not_configured',
      detail: `modo ${config.email.mode}`,
    },
    secrets: {
      status: configuredSecrets === SECRET_NAMES.length ? 'ok' : 'degraded',
      detail: `${configuredSecrets} de ${SECRET_NAMES.length} configurados`,
    },
  };

  const degraded = Object.values(checks).some((check) => check.status !== 'ok');
  const body: HealthResponse = {
    status: degraded ? 'degraded' : 'ok',
    service: 'wous',
    environment: config.env,
    version: APP_VERSION,
    serverTime: c.get('deps').clock.now(),
    checks,
  };
  return c.json({ data: body, requestId: c.get('requestId') }, d1.status === 'down' ? 503 : 200);
});
