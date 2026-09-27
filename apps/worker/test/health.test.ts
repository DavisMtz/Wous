import { env } from 'cloudflare:workers';
import type { HealthResponse } from '@wous/contracts';
import { describe, expect, it } from 'vitest';
import { call } from './helpers.ts';

describe('GET /api/v1/health', () => {
  it('reporta cada dependencia y responde ok en local', async () => {
    const res = await call('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Request-Id')).toMatch(/^req_/);

    const { data } = (await res.json()) as { data: HealthResponse };
    expect(data.status).toBe('ok');
    expect(data.environment).toBe('local');
    expect(data.checks.d1?.status).toBe('ok');
    expect(data.checks.d1?.detail).toBe('migraciones aplicadas: 3');
    expect(data.checks.r2?.status).toBe('ok');
    expect(data.checks.durableObjects?.status).toBe('ok');
    expect(data.checks.secrets?.detail).toBe('5 de 5 configurados');
  });

  it('no revela el valor de ningún secreto', async () => {
    const text = await (await call('/api/v1/health')).text();
    for (const secret of [
      env.SESSION_PEPPER,
      env.TOKEN_PEPPER,
      env.TURNSTILE_SECRET_KEY,
      env.BREVO_API_KEY,
      env.BREVO_WEBHOOK_SECRET,
    ]) {
      expect(text).not.toContain(secret);
    }
  });

  it('lleva cabeceras de seguridad y no se cachea', async () => {
    const res = await call('/api/v1/health');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
  });
});
