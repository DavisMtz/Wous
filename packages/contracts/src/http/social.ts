import { z } from 'zod';
import { AppearanceInput } from '../domain/appearance.ts';
import { CharacterId } from '../domain/ids.ts';

/**
 * Personas que bloqueaste (ADR-0010). Se bloquea desde la sala (la sala sabe
 * quién está y lo aplica en el acto); desde la casa solo se ve la lista y se
 * desbloquea.
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
