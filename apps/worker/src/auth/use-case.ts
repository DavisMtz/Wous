import type { Context } from 'hono';
import type { AppConfig } from '../config.ts';
import type { AppHono, Deps } from '../http/types.ts';
import type { Logger } from '../lib/log.ts';

/**
 * Lo que necesita un caso de uso, sin saber nada de Hono (ADR-0003): los casos
 * de uso reciben datos ya validados y dependencias inyectadas.
 */
export type UseCaseContext = {
  env: Env;
  config: AppConfig;
  deps: Deps;
  log: Logger;
  request: Request;
  userAgent: string | undefined;
  remoteIp: string | null;
  waitUntil(promise: Promise<unknown>): void;
};

export function useCaseContext(c: Context<AppHono>): UseCaseContext {
  return {
    env: c.env,
    config: c.get('config'),
    deps: c.get('deps'),
    log: c.get('log'),
    request: c.req.raw,
    userAgent: c.req.header('User-Agent'),
    remoteIp: c.req.header('CF-Connecting-IP') ?? null,
    waitUntil: (promise) => c.executionCtx.waitUntil(promise),
  };
}
