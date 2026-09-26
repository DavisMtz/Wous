import { env } from 'cloudflare:workers';
import type { ErrorEnvelope } from '@wous/contracts';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApp } from '../src/app.ts';
import { readJson } from '../src/http/json.ts';
import { ok } from '../src/http/respond.ts';
import { call, ORIGIN } from './helpers.ts';

// App de prueba con una ruta que usa readJson, para ejercitar el sobre de error.
const app = createApp();
app.post('/api/v1/__prueba', async (c) => {
  const body = await readJson(c, z.object({ nombre: z.string().min(2) }));
  return ok(c, { hola: body.nombre });
});

function send(init: RequestInit & { headers?: Record<string, string> }) {
  return app.request('/api/v1/__prueba', { method: 'POST', ...init }, env);
}

async function errorOf(res: Response) {
  return ((await res.json()) as ErrorEnvelope).error;
}

describe('sobre de error HTTP', () => {
  it('una ruta inexistente responde NOT_FOUND con requestId', async () => {
    const res = await call('/api/v1/no-existe');
    expect(res.status).toBe(404);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.requestId).toMatch(/^req_/);
    expect(res.headers.get('X-Request-Id')).toBe(body.requestId);
  });

  it('acepta JSON válido del mismo origen', async () => {
    const res = await send({
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'Ana' }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ data: { hola: 'Ana' } });
  });

  it('rechaza un POST sin Origin o de otro origen', async () => {
    const sinOrigen = await send({
      headers: { 'Content-Type': 'application/json' },
      body: '{"nombre":"Ana"}',
    });
    expect(sinOrigen.status).toBe(403);
    expect((await errorOf(sinOrigen)).code).toBe('FORBIDDEN');

    const ajeno = await send({
      headers: { Origin: 'https://malicioso.example', 'Content-Type': 'application/json' },
      body: '{"nombre":"Ana"}',
    });
    expect(ajeno.status).toBe(403);
  });

  it('rechaza lo que no es JSON con UNSUPPORTED_MEDIA_TYPE', async () => {
    const res = await send({
      headers: { Origin: ORIGIN, 'Content-Type': 'text/plain' },
      body: 'nombre=Ana',
    });
    expect(res.status).toBe(415);
    expect((await errorOf(res)).code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('corta un cuerpo demasiado grande con PAYLOAD_TOO_LARGE', async () => {
    const res = await send({
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'x'.repeat(20_000) }),
    });
    expect(res.status).toBe(413);
    expect((await errorOf(res)).code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('JSON roto o que no cumple el contrato es INVALID_REQUEST con campos', async () => {
    const roto = await send({
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      body: '{"nombre":',
    });
    expect(roto.status).toBe(400);
    expect((await errorOf(roto)).code).toBe('INVALID_REQUEST');

    const invalido = await send({
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'A' }),
    });
    const error = await errorOf(invalido);
    expect(error.code).toBe('INVALID_REQUEST');
    expect(error.fields).toHaveProperty('nombre');
  });
});
