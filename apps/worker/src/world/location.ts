import { getMap, type MapId, STARTING_MAP } from '@wous/world-data';

/**
 * Dónde está un personaje (ADR-0009). La sala lógica vive en
 * `characters.last_room_id` y el turno vigente en `presence_epoch`:
 *
 * - Cada conexión al mundo toma turno nuevo (sube el epoch) y, en la misma
 *   sentencia, lee a qué sala va. El cliente nunca la dice.
 * - Solo una sala, al validar un portal, cambia `last_room_id`, y solo si el
 *   turno de ese socket sigue siendo el vigente. Si otra conexión llegó
 *   después, el cambio no aplica y ese socket ya no representa a nadie.
 *
 * Así una misma persona no puede quedar activa en dos salas aunque dos
 * pestañas se crucen con un portal.
 */

export type PresenceClaim = {
  epoch: number;
  /** Sala lógica donde entra (la guardada si sigue existiendo; si no, la de inicio). */
  mapId: MapId;
};

/** Toma turno y resuelve la sala. `null` si el personaje no existe. */
export async function claimPresence(
  db: D1Database,
  characterId: string,
): Promise<PresenceClaim | null> {
  const row = await db
    .prepare(
      `UPDATE characters SET presence_epoch = presence_epoch + 1
        WHERE id = ?
        RETURNING presence_epoch, last_room_id`,
    )
    .bind(characterId)
    .first<{ presence_epoch: number; last_room_id: string | null }>();
  if (!row) return null;
  const saved = row.last_room_id ? getMap(row.last_room_id) : undefined;
  return { epoch: row.presence_epoch, mapId: saved?.id ?? STARTING_MAP };
}

/**
 * Mueve al personaje a otra sala lógica, pero solo con el turno vigente.
 * Devuelve `false` si otra conexión ya tomó turno (este socket quedó viejo).
 */
export async function moveCharacter(
  db: D1Database,
  characterId: string,
  epoch: number,
  mapId: MapId,
): Promise<boolean> {
  const result = await db
    .prepare('UPDATE characters SET last_room_id = ? WHERE id = ? AND presence_epoch = ?')
    .bind(mapId, characterId, epoch)
    .run();
  return result.meta.changes === 1;
}
