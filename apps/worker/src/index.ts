import { liftExpiredSuspensions } from './accounts/suspensions.ts';
import { createApp } from './app.ts';
import { readConfig } from './config.ts';
import { CRON_PURGE, CRON_SWEEP_OUTBOX } from './cron.ts';
import { createEmailQueueHandler } from './email/queue-consumer.ts';
import { systemClock } from './lib/clock.ts';
import { createIdGenerator } from './lib/ids.ts';
import { createLogger, errorFields } from './lib/log.ts';
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
      // Suspensiones con fin que ya terminaron (ADR-0012).
      ctx.waitUntil(
        liftExpiredSuspensions(
          env,
          { clock: systemClock, ids: createIdGenerator(systemClock) },
          log,
        ).catch((err: unknown) => log.error('moderation.lift_failed', errorFields(err))),
      );
    } else if (controller.cron === CRON_PURGE) {
      ctx.waitUntil(purgeExpired(env, systemClock, log));
    }
  },
} satisfies ExportedHandler<Env, unknown>;
