import { z } from 'zod';
import type { AppConfig } from '../config.ts';
import { Errors } from '../http/errors.ts';
import { errorFields, type Logger } from '../lib/log.ts';

/** Acciones declaradas en el widget; el servidor exige que coincidan. */
export type TurnstileAction = 'register' | 'login' | 'resend' | 'forgot';

export interface TurnstileVerifier {
  verify(
    token: string,
    options: { action: TurnstileAction; remoteIp: string | null },
  ): Promise<boolean>;
}

/** Llaves y token de prueba documentados por Cloudflare. */
const TEST_SECRET_PASS = '1x0000000000000000000000000000000AA';
const TEST_SECRET_FAIL = '2x0000000000000000000000000000000AA';
const TEST_DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

const SiteverifyResponse = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  action: z.string().optional(),
  'error-codes': z.array(z.string()).optional(),
});

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verificación de Turnstile SIEMPRE en servidor (§22): que el cliente traiga
 * un token no prueba nada. Se comprueba además el hostname y la acción, para
 * que un token emitido en otro sitio o para otro formulario no sirva aquí.
 */
export function createTurnstileVerifier(
  env: Env,
  config: AppConfig,
  log: Logger,
  fetchFn: typeof fetch = fetch,
): TurnstileVerifier {
  const secret = env.TURNSTILE_SECRET_KEY;
  const expectedHostname = new URL(config.origin).hostname;

  return {
    async verify(token, { action, remoteIp }) {
      // En local, las llaves de prueba se resuelven sin red (desarrollo y E2E offline).
      if (config.env === 'local' && secret === TEST_SECRET_PASS) return token === TEST_DUMMY_TOKEN;
      if (config.env === 'local' && secret === TEST_SECRET_FAIL) return false;

      const form = new FormData();
      form.set('secret', secret);
      form.set('response', token);
      if (remoteIp) form.set('remoteip', remoteIp);
      form.set('idempotency_key', crypto.randomUUID());

      let raw: unknown;
      try {
        const res = await fetchFn(SITEVERIFY_URL, { method: 'POST', body: form });
        raw = await res.json();
      } catch (err) {
        log.error('turnstile.unreachable', errorFields(err));
        throw Errors.unavailable();
      }

      const parsed = SiteverifyResponse.safeParse(raw);
      if (!parsed.success) {
        log.error('turnstile.bad_response');
        throw Errors.unavailable();
      }
      const result = parsed.data;
      if (!result.success) {
        log.warn('turnstile.rejected', { codes: result['error-codes'] ?? [] });
        return false;
      }
      if (result.hostname !== expectedHostname && config.env !== 'local') {
        log.warn('turnstile.hostname_mismatch', { hostname: result.hostname ?? null });
        return false;
      }
      if (result.action !== undefined && result.action !== action) {
        log.warn('turnstile.action_mismatch', { expected: action, got: result.action });
        return false;
      }
      return true;
    },
  };
}
