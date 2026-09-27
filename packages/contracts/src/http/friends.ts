import { z } from 'zod';
import { AppearanceInput } from '../domain/appearance.ts';
import { CharacterId, FriendshipId } from '../domain/ids.ts';

/**
 * Amistades (§20, ADR-0011). Hacia fuera siempre se nombra al personaje: el
 * ID de cuenta nunca sale del servidor. Se agrega a la gente desde su ficha
 * en la plaza (no hay búsqueda por nombre).
 */

/** Tu relación con otra persona, desde tu lado. */
export const FriendRelation = z.enum(['FRIENDS', 'OUTGOING', 'INCOMING', 'NONE']);
export type FriendRelation = z.infer<typeof FriendRelation>;

export const FriendEntry = z.object({
  friendshipId: FriendshipId,
  characterId: CharacterId,
  displayName: z.string(),
  appearance: AppearanceInput,
  /** Amigos: desde cuándo. Solicitudes: cuándo se mandó. */
  since: z.number().int(),
});
export type FriendEntry = z.infer<typeof FriendEntry>;

/** GET /api/v1/friends — lo más reciente primero en cada lista. */
export const FriendListResponse = z.object({
  friends: z.array(FriendEntry),
  /** Te las mandaron y esperan tu respuesta. */
  incoming: z.array(FriendEntry),
  /** Las mandaste tú y siguen sin respuesta. */
  outgoing: z.array(FriendEntry),
});
export type FriendListResponse = z.infer<typeof FriendListResponse>;

/** POST /api/v1/friends/request */
export const FriendRequestBody = z.strictObject({ characterId: CharacterId });
export type FriendRequestBody = z.infer<typeof FriendRequestBody>;

/**
 * Respuesta de pedir, aceptar, rechazar o quitar: cómo quedó la relación.
 * Repetir una acción que ya pasó responde lo mismo que la primera vez.
 */
export const FriendActionResponse = z.object({
  relation: FriendRelation,
  /** La relación como aparece en tus listas; null si ya no hay ninguna. */
  entry: FriendEntry.nullable(),
});
export type FriendActionResponse = z.infer<typeof FriendActionResponse>;

/**
 * Avisos por correo que se pueden apagar (§7). Los de seguridad (verificar
 * correo, recuperar o cambiar contraseña) salen siempre y no aparecen aquí;
 * el consentimiento de marketing no existe todavía.
 */
export const NotificationPreferences = z.object({
  friendRequestEmail: z.boolean(),
  friendAcceptedEmail: z.boolean(),
});
export type NotificationPreferences = z.infer<typeof NotificationPreferences>;

/** POST /api/v1/preferences — solo lo que cambia. */
export const UpdateNotificationPreferences = NotificationPreferences.partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nada que cambiar.');
export type UpdateNotificationPreferences = z.infer<typeof UpdateNotificationPreferences>;
