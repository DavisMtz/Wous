import { z } from 'zod';
import { AppearanceInput } from '../domain/appearance.ts';

/**
 * Nombre visible del personaje: letras con acentos del español, números,
 * espacio, punto, guion y guion bajo. Sin emoji ni alfabetos parecidos
 * (evita suplantar a otra persona con homógrafos).
 */
export const DISPLAY_NAME_PATTERN = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ._-]+$/;

export const DisplayNameInput = z
  .string()
  .transform((v) => v.normalize('NFC').trim().replace(/\s+/g, ' '))
  .pipe(
    z
      .string()
      .min(3, 'Mínimo 3 caracteres.')
      .max(20, 'Máximo 20 caracteres.')
      .regex(DISPLAY_NAME_PATTERN, 'Usa letras, números, espacios, punto o guion.')
      .refine((v) => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(v), 'Incluye al menos una letra.'),
  );

/** POST /api/v1/characters */
export const CreateCharacterRequest = z.object({
  displayName: DisplayNameInput,
  appearance: AppearanceInput,
});
export type CreateCharacterRequest = z.infer<typeof CreateCharacterRequest>;

export const CharacterView = z.object({
  id: z.string(),
  displayName: z.string(),
  appearance: AppearanceInput,
  createdAt: z.number().int(),
});
export type CharacterView = z.infer<typeof CharacterView>;
