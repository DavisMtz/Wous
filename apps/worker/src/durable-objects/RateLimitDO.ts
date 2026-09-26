import { DurableObject } from 'cloudflare:workers';
import type { RateLimitRule } from '@wous/config';

export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  /** Milisegundos hasta que vuelve a haber hueco (0 si se permitió). */
  retryAfterMs: number;
};

const HITS_KEY = 'hits';

/**
 * Límite de ventana deslizante (§23). UNA instancia por clave de límite
 * (p. ej. `register:ip:<hmac>`): el Durable Object serializa las peticiones,
 * así que no hay carreras entre intentos simultáneos.
 *
 * Guarda como mucho `limit` marcas de tiempo. Una alarma borra todo cuando la
 * ventana vence: una clave inactiva no deja datos (ni IPs, que ya van con HMAC).
 */
export class RateLimitDO extends DurableObject<Env> {
  async hit(rule: RateLimitRule, now: number): Promise<RateLimitDecision> {
    const stored = (await this.ctx.storage.get<number[]>(HITS_KEY)) ?? [];
    const windowStart = now - rule.windowMs;
    const recent = stored.filter((t) => t > windowStart);

    if (recent.length >= rule.limit) {
      const oldest = recent[0] ?? now;
      if (recent.length !== stored.length) await this.ctx.storage.put(HITS_KEY, recent);
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(0, oldest + rule.windowMs - now),
      };
    }

    recent.push(now);
    await this.ctx.storage.put(HITS_KEY, recent);
    await this.ctx.storage.setAlarm(now + rule.windowMs);
    return { allowed: true, remaining: rule.limit - recent.length, retryAfterMs: 0 };
  }

  override async alarm(): Promise<void> {
    // La última marca + su ventana ya pasó (la alarma se reprograma en cada hit).
    await this.ctx.storage.deleteAll();
  }

  async ping(): Promise<'pong'> {
    return 'pong';
  }
}
