import type { AppConfig } from '../config.ts';
import type { Clock } from '../lib/clock.ts';
import type { IdGenerator } from '../lib/ids.ts';
import type { Logger } from '../lib/log.ts';

/** Dependencias inyectables: en pruebas se sustituyen reloj, IDs, etc. */
export type Deps = {
  clock: Clock;
  ids: IdGenerator;
};

export type AppVariables = {
  requestId: string;
  log: Logger;
  config: AppConfig;
  deps: Deps;
};

export type AppHono = { Bindings: Env; Variables: AppVariables };
