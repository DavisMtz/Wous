import { DurableObject } from 'cloudflare:workers';

/**
 * Presente de una instancia de sala (§13). Declarado desde la Fase 1 para
 * fijar bindings y migración; el WebSocket con Hibernation llega en la Fase 5.
 */
export class RoomDO extends DurableObject<Env> {
  async ping(): Promise<'pong'> {
    return 'pong';
  }

  override async fetch(): Promise<Response> {
    return new Response('La sala todavía no está disponible.', { status: 501 });
  }
}
