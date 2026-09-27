import { API_PREFIX } from '@wous/config';
import { ErrorEnvelope, type HttpErrorCode } from '@wous/contracts';

/**
 * Error de la API con su código estable. La UI decide SIEMPRE por `code`,
 * nunca comparando el texto del mensaje (§32).
 */
export class ApiError extends Error {
  constructor(
    readonly code: HttpErrorCode | 'NETWORK_ERROR',
    message: string,
    readonly status: number,
    readonly fields: Record<string, string> = {},
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Method = 'GET' | 'POST' | 'DELETE';

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_PREFIX}${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      'NETWORK_ERROR',
      'No hay conexión con Wous. Revisa tu internet e inténtalo otra vez.',
      0,
    );
  }

  if (res.status === 204) return undefined as T;
  const json: unknown = await res.json().catch(() => null);
  if (res.ok) return (json as { data: T }).data;

  const parsed = ErrorEnvelope.safeParse(json);
  if (parsed.success) {
    const { error } = parsed.data;
    throw new ApiError(
      error.code,
      error.message,
      res.status,
      error.fields ?? {},
      error.retryAfterSeconds,
    );
  }
  throw new ApiError('INTERNAL_ERROR', 'Algo salió mal. Inténtalo de nuevo.', res.status);
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  del: <T>(path: string) => request<T>('DELETE', path),
};
