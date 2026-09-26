import type { PasswordHasher } from '../auth/password.ts';
import type { SessionContext } from '../auth/sessions.ts';
import type { AppConfig } from '../config.ts';
import type { Clock } from '../lib/clock.ts';
import type { IdGenerator } from '../lib/ids.ts';
import type { Logger } from '../lib/log.ts';
import type { RateLimiter } from '../security/rate-limit.ts';
import type { TurnstileVerifier } from '../security/turnstile.ts';

/**
 * Dependencias inyectables (§31: Clock, IdGenerator, PasswordHasher,
 * TurnstileVerifier…). En pruebas se sustituyen por dobles deterministas.
 */
export type Deps = {
  clock: Clock;
  ids: IdGenerator;
  hasher: PasswordHasher;
  turnstile: TurnstileVerifier;
  rateLimiter: RateLimiter;
};

export type AppVariables = {
  requestId: string;
  log: Logger;
  config: AppConfig;
  deps: Deps;
  session: SessionContext | null;
};

export type AppHono = { Bindings: Env; Variables: AppVariables };
