import { maskEmail } from '../accounts/normalize.ts';
import type { AppConfig } from '../config.ts';
import type { Clock } from '../lib/clock.ts';
import type { Logger } from '../lib/log.ts';
import type { EmailProvider, OutgoingEmail } from './provider.ts';

/** Prefijo del buzón de desarrollo en R2 (solo entorno local). */
export const DEV_MAILBOX_PREFIX = 'dev/mailbox/';

export type DevMailboxEntry = OutgoingEmail & { sentAt: number };

/**
 * Modo `log`: no envía nada. Registra metadatos (nunca parámetros, que llevan
 * enlaces con token). En LOCAL, además, guarda el correo completo en un
 * buzón de R2 local para poder completar el flujo en desarrollo y en E2E.
 */
export function createLogProvider(
  env: Env,
  config: AppConfig,
  clock: Clock,
  log: Logger,
): EmailProvider {
  return {
    name: 'log',
    async send(email) {
      log.info('email.log_mode', {
        outboxId: email.outboxId,
        type: email.type,
        to: maskEmail(email.to.email),
      });
      if (config.env === 'local') {
        const entry: DevMailboxEntry = { ...email, sentAt: clock.now() };
        const key = `${DEV_MAILBOX_PREFIX}${String(entry.sentAt).padStart(15, '0')}-${email.outboxId}.json`;
        await env.ASSETS_BUCKET.put(key, JSON.stringify(entry), {
          httpMetadata: { contentType: 'application/json' },
        });
      }
      return { providerMessageId: `log:${email.outboxId}` };
    },
  };
}
