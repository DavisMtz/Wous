import { maskEmail } from '../accounts/normalize.ts';
import type { AppConfig } from '../config.ts';
import type { Clock } from '../lib/clock.ts';
import type { Logger } from '../lib/log.ts';
import type { EmailProvider, OutgoingEmail } from './provider.ts';

/**
 * Prefijo del buzón de desarrollo en R2 (solo entorno local). R2 lista en
 * orden lexicográfico y por páginas: la clave lleva el tiempo INVERTIDO para
 * que lo más nuevo salga primero. (La v1 usaba el tiempo tal cual: pasados
 * 200 correos, los nuevos ya no cabían en la primera página y el E2E no los
 * encontraba.)
 */
export const DEV_MAILBOX_PREFIX = 'dev/mailbox-v2/';
const MAX_TIME = 9_999_999_999_999;

export function devMailboxKey(sentAt: number, outboxId: string): string {
  return `${DEV_MAILBOX_PREFIX}${String(MAX_TIME - sentAt).padStart(13, '0')}-${outboxId}.json`;
}

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
        await env.ASSETS_BUCKET.put(
          devMailboxKey(entry.sentAt, email.outboxId),
          JSON.stringify(entry),
          {
            httpMetadata: { contentType: 'application/json' },
          },
        );
      }
      return { providerMessageId: `log:${email.outboxId}` };
    },
  };
}
