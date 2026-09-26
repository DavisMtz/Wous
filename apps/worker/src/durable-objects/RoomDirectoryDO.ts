import { DurableObject } from 'cloudflare:workers';

/**
 * Asignación de instancias por sala lógica (§13). Declarado desde la Fase 1
 * para fijar bindings y migración; su lógica llega en la Fase 5.
 */
export class RoomDirectoryDO extends DurableObject<Env> {
  async ping(): Promise<'pong'> {
    return 'pong';
  }
}
