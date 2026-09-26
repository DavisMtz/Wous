/**
 * Logs estructurados (§24). Workers Logs indexa los campos de cada objeto,
 * así que se registra un objeto por evento, nunca texto suelto.
 *
 * Defensa en profundidad: cualquier campo cuyo nombre parezca un secreto se
 * reemplaza antes de escribir, aunque alguien lo pase por error.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFields = Record<string, unknown>;

const SENSITIVE_KEY = /token|password|secret|cookie|authorization|api[-_]?key|pepper|hash/i;
const REDACTED = '[redactado]';

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    const isId = /Ids?$/.test(k);
    out[k] = SENSITIVE_KEY.test(k) && !isId ? REDACTED : redact(v, depth + 1);
  }
  return out;
}

export interface Logger {
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
}

export function createLogger(base: LogFields = {}): Logger {
  const write = (level: LogLevel, event: string, fields?: LogFields) => {
    const entry = redact({ level, event, ...base, ...fields }) as LogFields;
    if (level === 'error') console.error(entry);
    else if (level === 'warn') console.warn(entry);
    else console.log(entry);
  };
  return {
    debug: (e, f) => write('debug', e, f),
    info: (e, f) => write('info', e, f),
    warn: (e, f) => write('warn', e, f),
    error: (e, f) => write('error', e, f),
    child: (fields) => createLogger({ ...base, ...fields }),
  };
}

/** Resume un error para el log sin volcar objetos enteros (que pueden llevar datos). */
export function errorFields(err: unknown): LogFields {
  if (err instanceof Error) return { errorName: err.name, errorMessage: err.message };
  return { errorMessage: String(err) };
}
