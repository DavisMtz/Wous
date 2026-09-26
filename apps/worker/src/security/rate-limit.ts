import type { RateLimitRule } from '@wous/config';
import type { RateLimitDecision } from '../durable-objects/RateLimitDO.ts';
import { Errors } from '../http/errors.ts';
import type { Clock } from '../lib/clock.ts';
import { hmacSha256 } from '../lib/crypto.ts';

export interface RateLimiter {
  hit(key: string, rule: RateLimitRule): Promise<RateLimitDecision>;
}

export function durableObjectRateLimiter(env: Env, clock: Clock): RateLimiter {
  return {
    hit: (key, rule) => env.RATE_LIMIT.get(env.RATE_LIMIT.idFromName(key)).hit(rule, clock.now()),
  };
}

/** Lanza RATE_LIMITED con Retry-After si la clave se pasó del límite. */
export async function enforceRateLimit(
  limiter: RateLimiter,
  key: string,
  rule: RateLimitRule,
): Promise<void> {
  const decision = await limiter.hit(key, rule);
  if (!decision.allowed)
    throw Errors.rateLimited(Math.max(1, Math.ceil(decision.retryAfterMs / 1000)));
}

/**
 * Clave de límite por IP sin guardar la IP (§23): HMAC con un secreto del
 * Worker, recortado. Rotar TOKEN_PEPPER rota también estas claves.
 */
export async function ipRateKey(env: Env, request: Request, scope: string): Promise<string> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
  const digest = await hmacSha256(env.TOKEN_PEPPER, `ip:${ip}`);
  return `${scope}:ip:${digest.slice(0, 24)}`;
}

/** Clave de límite por identidad (correo o usuario ya normalizados), también con HMAC. */
export async function identityRateKey(env: Env, scope: string, identity: string): Promise<string> {
  const digest = await hmacSha256(env.TOKEN_PEPPER, `id:${identity}`);
  return `${scope}:id:${digest.slice(0, 24)}`;
}
