import { z } from 'zod';

/** Tipos de correo del outbox. Coinciden con las plantillas de Brevo (§7). */
export const OutboxType = z.enum([
  'EMAIL_VERIFY',
  'WELCOME_EMAIL',
  'PASSWORD_RESET',
  'PASSWORD_CHANGED',
  'FRIEND_REQUEST',
  'FRIEND_ACCEPTED',
]);
export type OutboxType = z.infer<typeof OutboxType>;

/** Parámetros NO secretos que se guardan en `payload_json`. */
export const OutboxPayloads = {
  EMAIL_VERIFY: z.object({ displayName: z.string(), expiresMinutes: z.number().int() }),
  WELCOME_EMAIL: z.object({ displayName: z.string() }),
  PASSWORD_RESET: z.object({ displayName: z.string(), expiresMinutes: z.number().int() }),
  PASSWORD_CHANGED: z.object({ displayName: z.string() }),
  FRIEND_REQUEST: z.object({ displayName: z.string(), actorDisplayName: z.string() }),
  FRIEND_ACCEPTED: z.object({ displayName: z.string(), actorDisplayName: z.string() }),
} as const satisfies Record<OutboxType, z.ZodType>;

export type OutboxPayload<T extends OutboxType> = z.infer<(typeof OutboxPayloads)[T]>;

/** Seguridad/operación: salen siempre. Sociales: obedecen preferencias (§7). */
export const SOCIAL_TYPES: ReadonlySet<OutboxType> = new Set(['FRIEND_REQUEST', 'FRIEND_ACCEPTED']);

/** Tipos que necesitan un token de un solo uso (cifrado en `secret_enc`). */
export const TYPES_WITH_SECRET: ReadonlySet<OutboxType> = new Set([
  'EMAIL_VERIFY',
  'PASSWORD_RESET',
]);

function appUrl(origin: string, path: string, params: Record<string, string> = {}): string {
  const url = new URL(path, `${origin}/`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

export type TemplateParams = Record<string, string | number>;

/**
 * Parámetros finales de la plantilla. Los enlaces se construyen aquí, al
 * enviar, a partir del origen configurado: nunca vienen del cliente.
 */
export function buildTemplateParams(
  type: OutboxType,
  rawPayload: unknown,
  secret: string | null,
  origin: string,
): TemplateParams {
  switch (type) {
    case 'EMAIL_VERIFY': {
      const p = OutboxPayloads.EMAIL_VERIFY.parse(rawPayload);
      if (!secret) throw new Error('EMAIL_VERIFY sin token');
      return {
        displayName: p.displayName,
        expiresMinutes: p.expiresMinutes,
        verificationUrl: appUrl(origin, '/verify-email', { token: secret }),
      };
    }
    case 'WELCOME_EMAIL': {
      const p = OutboxPayloads.WELCOME_EMAIL.parse(rawPayload);
      return { displayName: p.displayName, appUrl: appUrl(origin, '/') };
    }
    case 'PASSWORD_RESET': {
      const p = OutboxPayloads.PASSWORD_RESET.parse(rawPayload);
      if (!secret) throw new Error('PASSWORD_RESET sin token');
      return {
        displayName: p.displayName,
        expiresMinutes: p.expiresMinutes,
        resetUrl: appUrl(origin, '/reset-password', { token: secret }),
      };
    }
    case 'PASSWORD_CHANGED': {
      const p = OutboxPayloads.PASSWORD_CHANGED.parse(rawPayload);
      return { displayName: p.displayName, securityUrl: appUrl(origin, '/forgot-password') };
    }
    case 'FRIEND_REQUEST':
    case 'FRIEND_ACCEPTED': {
      const p = OutboxPayloads[type].parse(rawPayload);
      return {
        displayName: p.displayName,
        actorDisplayName: p.actorDisplayName,
        friendsUrl: appUrl(origin, '/friends'),
      };
    }
  }
}
