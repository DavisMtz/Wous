/**
 * Normalización para comparar y garantizar unicidad (§6). El valor visible se
 * conserva tal cual; la columna `*_normalized` es la que lleva el UNIQUE.
 */

/**
 * Correo: NFC, sin espacios y en minúsculas completo. NO se quitan puntos ni
 * sufijos `+algo`: esa equivalencia es propia de cada proveedor y aplicarla a
 * todos juntaría cuentas de personas distintas.
 */
export function normalizeEmail(email: string): string {
  return email.normalize('NFC').trim().toLowerCase();
}

/** Nombre de usuario: el patrón ya es ASCII; se compara sin mayúsculas. */
export function normalizeUsername(username: string): string {
  return username.normalize('NFC').trim().toLowerCase();
}

/** Nombres que confunden con el equipo o el sistema. */
const RESERVED_USERNAMES = new Set([
  'admin',
  'administrador',
  'administrator',
  'root',
  'system',
  'sistema',
  'staff',
  'soporte',
  'support',
  'moderador',
  'moderator',
  'mod',
  'wous',
  'oficial',
  'official',
  'null',
  'undefined',
  'anonimo',
  'anonymous',
]);

export function isReservedUsername(normalized: string): boolean {
  if (RESERVED_USERNAMES.has(normalized)) return true;
  return /^(wous|admin|mod|staff)_/.test(normalized);
}

/** Enmascara un correo para logs: `an***@example.com`. */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
}
