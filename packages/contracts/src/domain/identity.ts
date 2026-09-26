import { ACCOUNT_POLICY } from '@wous/config';
import { z } from 'zod';

/**
 * Reglas de identidad compartidas: el formulario las usa para avisar antes de
 * enviar y el servidor para decidir. El servidor normaliza después (§6).
 */

export const EmailInput = z
  .string()
  .trim()
  .min(3, 'Escribe tu correo.')
  .max(ACCOUNT_POLICY.emailMaxLength, 'El correo es demasiado largo.')
  .pipe(z.email('Ese correo no parece válido.'));

/** Letras ASCII, números y guion bajo; al menos una letra. Sin homógrafos Unicode. */
export const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/;

export const UsernameInput = z
  .string()
  .trim()
  .min(ACCOUNT_POLICY.usernameMinLength, `Mínimo ${ACCOUNT_POLICY.usernameMinLength} caracteres.`)
  .max(ACCOUNT_POLICY.usernameMaxLength, `Máximo ${ACCOUNT_POLICY.usernameMaxLength} caracteres.`)
  .regex(USERNAME_PATTERN, 'Solo letras sin acentos, números y guion bajo.')
  .refine((v) => /[A-Za-z]/.test(v), 'Incluye al menos una letra.');

/** Longitud acotada también por arriba: el hash de una contraseña enorme es un DoS. */
export const PasswordInput = z
  .string()
  .min(ACCOUNT_POLICY.passwordMinLength, `Mínimo ${ACCOUNT_POLICY.passwordMinLength} caracteres.`)
  .max(ACCOUNT_POLICY.passwordMaxLength, 'La contraseña es demasiado larga.');

/** Token opaco de un solo uso (base64url de 32 bytes). */
export const OpaqueToken = z
  .string()
  .min(20)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

export const TurnstileToken = z.string().min(1, 'Completa la verificación.').max(4096);
