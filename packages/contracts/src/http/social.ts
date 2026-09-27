import { z } from 'zod';
import { AppearanceInput } from '../domain/appearance.ts';
import { CharacterId } from '../domain/ids.ts';

/**
 * Personas que bloqueaste (ADR-0010). Se bloquea desde la sala (la sala sabe
 * quién está y lo aplica en el acto) o desde la lista de amigos (ADR-0011);
 * en la casa se ve la lista y se desbloquea.
 */
export const BlockedPerson = z.object({
  characterId: CharacterId,
  displayName: z.string(),
  appearance: AppearanceInput,
  blockedAt: z.number().int(),
});
export type BlockedPerson = z.infer<typeof BlockedPerson>;

/** GET /api/v1/blocks */
export const BlockListResponse = z.object({ blocked: z.array(BlockedPerson) });
export type BlockListResponse = z.infer<typeof BlockListResponse>;

/**
 * POST /api/v1/users/:characterId/block — bloquear desde la lista de amigos
 * (ADR-0011). Termina la amistad del par y, si estás en una sala, aplica ahí
 * en el acto, igual que bloquear desde la ficha.
 */
export const BlockResponse = z.object({ blocked: z.literal(true) });
export type BlockResponse = z.infer<typeof BlockResponse>;
