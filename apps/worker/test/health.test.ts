import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

describe('GET /api/v1/health', () => {
  it('responde ok con el entorno local', async () => {
    const res = await exports.default.fetch('http://localhost/api/v1/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { status: string; environment: string } };
    expect(body.data.status).toBe('ok');
    expect(body.data.environment).toBe('local');
  });
});
