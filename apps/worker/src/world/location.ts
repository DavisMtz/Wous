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
  /** Silencio de moderación de la cuenta (epoch ms), si lo tiene (ADR-0010). */
  chatMutedUntil: number | null;
};

/**
 * Toma turno y resuelve la sala. `null` si el personaje no existe. En la
 * misma ida a D1 lee el silencio de moderación de la cuenta: la sala lo
 * necesita desde el primer mensaje.
 */
export async function claimPresence(
  db: D1Database,
  characterId: string,
  accountId: string,
): Promise<PresenceClaim | null> {
  const [claimed, account] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `UPDATE characters SET presence_epoch = presence_epoch + 1
          WHERE id = ?
          RETURNING presence_epoch, last_room_id`,
      )
      .bind(characterId),
    db.prepare('SELECT chat_muted_until FROM accounts WHERE id = ?').bind(accountId),
  ]);
  const row = claimed?.results[0] as
    | { presence_epoch: number; last_room_id: string | null }
    | undefined;
  if (!row) return null;
  const saved = row.last_room_id ? getMap(row.last_room_id) : undefined;
  const muted = account?.results[0]?.chat_muted_until;
  return {
    epoch: row.presence_epoch,
    mapId: saved?.id ?? STARTING_MAP,
    chatMutedUntil: typeof muted === 'number' ? muted : null,
  };
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
