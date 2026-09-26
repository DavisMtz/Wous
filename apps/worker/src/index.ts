import { createApp } from './app.ts';
import { handleEmailQueue } from './email/queue-consumer.ts';

export { RateLimitDO } from './durable-objects/RateLimitDO.ts';
export { RoomDirectoryDO } from './durable-objects/RoomDirectoryDO.ts';
export { RoomDO } from './durable-objects/RoomDO.ts';

const app = createApp();

export default {
  fetch: app.fetch,
  queue: handleEmailQueue,
} satisfies ExportedHandler<Env, unknown>;
