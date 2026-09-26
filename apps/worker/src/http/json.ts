import { HTTP_LIMITS } from '@wous/config';
import type { Context } from 'hono';
import type { z } from 'zod';
import { Errors } from './errors.ts';
import type { AppHono } from './types.ts';

/**
 * Lee el cuerpo como bytes sin pasar de `maxBytes`, aunque no venga
 * Content-Length o mienta: se corta la lectura en cuanto se excede.
 */
export async function readBodyCapped(request: Request, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(request.headers.get('Content-Length') ?? 'NaN');
  if (Number.isFinite(declared) && declared > maxBytes) throw Errors.payloadTooLarge();
  if (!request.body) return new Uint8Array(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw Errors.payloadTooLarge();
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** Convierte los issues de Zod en `{ campo: mensaje }` (solo el primero por campo). */
export function zodFields(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_';
    if (!(key in fields)) fields[key] = issue.message;
  }
  return fields;
}

/**
 * Cuerpo JSON validado por un esquema de @wous/contracts. Rechaza con códigos
 * estables: 415 si no es JSON, 413 si es grande, 400 si no cumple el contrato.
 */
export async function readJson<S extends z.ZodType>(
  c: Context<AppHono>,
  schema: S,
  maxBytes: number = HTTP_LIMITS.maxJsonBytes,
): Promise<z.infer<S>> {
  const contentType = c.req.header('Content-Type') ?? '';
  if (!/^application\/json\b/i.test(contentType)) throw Errors.unsupportedMediaType();

  const bytes = await readBodyCapped(c.req.raw, maxBytes);
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    throw Errors.invalidRequest();
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw Errors.invalidRequest();
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw Errors.invalidRequest(zodFields(parsed.error));
  return parsed.data;
}
