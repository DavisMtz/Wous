import { DurableObject } from 'cloudflare:workers';

/**
 * Límites estrictos para endpoints sensibles (§23). Una instancia por clave de
 * límite. La lógica de ventanas llega con WOU-006; en la Fase 1 solo responde
 * al health para comprobar que el binding y la migración existen.
 */
export class RateLimitDO extends DurableObject<Env> {
  async ping(): Promise<'pong'> {
    return 'pong';
  }
}
