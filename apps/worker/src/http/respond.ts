import type { SuccessEnvelope } from '@wous/contracts';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { AppHono } from './types.ts';

/** Respuesta exitosa estándar `{ data, requestId }` (§32). */
export function ok<T>(c: Context<AppHono>, data: T, status: ContentfulStatusCode = 200) {
  const body: SuccessEnvelope<T> = { data, requestId: c.get('requestId') };
  return c.json(body, status);
}
