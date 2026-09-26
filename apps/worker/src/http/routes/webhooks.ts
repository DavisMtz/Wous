import { HTTP_LIMITS } from '@wous/config';
import { Hono } from 'hono';
import {
  BrevoWebhookPayload,
  isAuthorizedWebhook,
  recordBrevoEvent,
} from '../../email/brevo-webhook.ts';
import { AppError } from '../errors.ts';
import { readJson } from '../json.ts';
import type { AppHono } from '../types.ts';

export const webhookRoutes = new Hono<AppHono>().post('/brevo', async (c) => {
  if (!isAuthorizedWebhook(c.req.raw, c.env.BREVO_WEBHOOK_SECRET)) {
    c.get('log').warn('webhook.brevo_unauthorized');
    throw new AppError('WEBHOOK_UNAUTHORIZED', 401, 'No autorizado.');
  }
  const payload = await readJson(c, BrevoWebhookPayload, HTTP_LIMITS.maxWebhookBytes);
  const events = Array.isArray(payload) ? payload : [payload];
  const deps = c.get('deps');
  const counts = { recorded: 0, duplicate: 0, ignored: 0 };
  for (const event of events) {
    counts[await recordBrevoEvent(c.env, deps, c.get('log'), event)] += 1;
  }
  c.get('log').info('webhook.brevo_processed', counts);
  return c.body(null, 204);
});
