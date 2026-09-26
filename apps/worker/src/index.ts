import { createApp } from './app.ts';
import { readConfig } from './config.ts';
import { CRON_PURGE, CRON_SWEEP_OUTBOX } from './cron.ts';
import { createEmailQueueHandler } from './email/queue-consumer.ts';
import { systemClock } from './lib/clock.ts';
import { createLogger } from './lib/log.ts';
import { purgeExpired, sweepOutbox } from './notifications/sweeper.ts';

export { RateLimitDO } from './durable-objects/RateLimitDO.ts';
export { RoomDirectoryDO } from './durable-objects/RoomDirectoryDO.ts';
export { RoomDO } from './durable-objects/RoomDO.ts';

const app = createApp();

export default {
  fetch: app.fetch,
  queue: createEmailQueueHandler(),
  async scheduled(controller, env, ctx) {
    const log = createLogger({ environment: readConfig(env).env, cron: controller.cron });
    if (controller.cron === CRON_SWEEP_OUTBOX) {
      ctx.waitUntil(sweepOutbox(env, systemClock, log));
    } else if (controller.cron === CRON_PURGE) {
      ctx.waitUntil(purgeExpired(env, systemClock, log));
    }
  },
} satisfies ExportedHandler<Env, unknown>;
