import { Hono } from 'hono';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/v1/health', (c) =>
  c.json({
    data: {
      status: 'ok',
      service: 'wous',
      environment: c.env.APP_ENV,
      serverTime: Date.now(),
    },
  }),
);

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
