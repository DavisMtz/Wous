import { exports } from 'cloudflare:workers';

export const ORIGIN = 'http://localhost:5173';

/** Petición al Worker completo (index.ts), como llegaría desde la web. */
export function call(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('Origin')) headers.set('Origin', ORIGIN);
  return exports.default.fetch(new Request(`http://localhost${path}`, { ...init, headers }));
}

export function postJson(path: string, body: unknown, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  return call(path, { ...init, method: 'POST', headers, body: JSON.stringify(body) });
}
