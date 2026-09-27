import { getMap, STARTING_MAP } from '@wous/world-data';
import { directoryObjectName, roomObjectName } from './players.ts';

export type RoomStub = ReturnType<Env['ROOM']['get']>;

/**
 * La sala donde está alguien AHORA, si está en alguna: la sala lógica sale de
 * D1 (`last_room_id`, ADR-0009) y la instancia, del directorio de esa sala.
 * La usan quienes cambian algo desde fuera y quieren que aplique en el acto:
 * bloquear por HTTP (ADR-0011) y la caseta (ADR-0012). Si alguien va cruzando
 * un portal puede no encontrarse: entonces aplica al entrar o con la revisión
 * del minuto.
 */
export async function roomOf(env: Env, characterId: string): Promise<RoomStub | null> {
  const row = await env.DB.prepare('SELECT last_room_id FROM characters WHERE id = ?')
    .bind(characterId)
    .first<{ last_room_id: string | null }>();
  const mapId = (row?.last_room_id ? getMap(row.last_room_id)?.id : undefined) ?? STARTING_MAP;
  const directory = env.ROOM_DIRECTORY.get(
    env.ROOM_DIRECTORY.idFromName(directoryObjectName(mapId)),
  );
  const instance = await directory.whereIs(characterId);
  if (!instance) return null;
  return env.ROOM.get(env.ROOM.idFromName(roomObjectName(mapId, instance)));
}
