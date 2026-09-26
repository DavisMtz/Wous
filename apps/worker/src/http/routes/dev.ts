import { Hono } from 'hono';
import { DEV_MAILBOX_PREFIX, type DevMailboxEntry } from '../../email/log-provider.ts';
import { Errors } from '../errors.ts';
import { ok } from '../respond.ts';
import type { AppHono } from '../types.ts';

/**
 * Buzón de desarrollo: SOLO en APP_ENV=local (en cualquier otro entorno
 * responde 404 como si no existiera). Permite completar verificación y reset
 * en desarrollo y en E2E sin enviar correo real (§25: «verificación controlada»).
 */
export const devRoutes = new Hono<AppHono>()
  .use('*', async (c, next) => {
    if (c.get('config').env !== 'local') throw Errors.notFound();
    await next();
  })
  .get('/mailbox', async (c) => {
    const to = c.req.query('to')?.toLowerCase();
    // Las claves van en tiempo invertido: la primera página trae lo más nuevo.
    const listing = await c.env.ASSETS_BUCKET.list({ prefix: DEV_MAILBOX_PREFIX, limit: 200 });
    const keys = listing.objects.map((o) => o.key).sort();
    const messages: DevMailboxEntry[] = [];
    for (const key of keys) {
      const object = await c.env.ASSETS_BUCKET.get(key);
      if (!object) continue;
      const entry = (await object.json()) as DevMailboxEntry;
      if (!to || entry.to.email.toLowerCase() === to) messages.push(entry);
      if (messages.length >= 20) break;
    }
    return ok(c, { messages });
  });
