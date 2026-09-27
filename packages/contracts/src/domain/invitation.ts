import { INVITATIONS } from '@wous/config';
import { z } from 'zod';

/**
 * Códigos de invitación de la alpha cerrada (ADR-0012). Se dictan, se copian
 * de un mensaje o llegan en un enlace: por eso usan el alfabeto de Crockford
 * (sin I, L, O ni U) y se leen con tolerancia. El formulario y el servidor
 * normalizan con la misma regla.
 */

const CODE = new RegExp(`^[0-9A-HJKMNP-TV-Z]{${INVITATIONS.codeLength}}$`);

/**
 * Lo que la persona escribió o pegó, como código canónico: mayúsculas, sin
 * espacios ni guiones, y las letras que se confunden leídas como Crockford
 * (I y L son 1; O es 0). `null` si no tiene forma de código.
 */
export function normalizeInvitationCode(raw: string): string | null {
  const clean = raw
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[\s‐-―-]+/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');
  return CODE.test(clean) ? clean : null;
}

/** Como se muestra y se comparte: `ABCDE-FGHJK`. */
export function formatInvitationCode(code: string): string {
  const half = Math.ceil(code.length / 2);
  return `${code.slice(0, half)}-${code.slice(half)}`;
}

/** El campo del formulario de registro (solo se pide con `registration: 'invite'`). */
export const InvitationCodeInput = z
  .string()
  .trim()
  .min(1, 'Escribe tu código de invitación.')
  .max(40, 'Ese código es demasiado largo.')
  .refine((v) => normalizeInvitationCode(v) !== null, 'El código tiene la forma XXXXX-XXXXX.');
