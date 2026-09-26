import { z } from 'zod';

/**
 * Versión del protocolo WebSocket (§12). Todo mensaje lleva `v`. Un cambio
 * incompatible sube este número y el servidor rechaza versiones que no conoce.
 */
export const WS_PROTOCOL_VERSION = 1;

/** Códigos de error del mundo en tiempo real: la lógica usa el código, no el texto. */
export const WsErrorCode = z.enum([
  'AUTH_REQUIRED',
  'ACCOUNT_NOT_ACTIVE',
  'CHARACTER_REQUIRED',
  'INVALID_MESSAGE',
  'UNSUPPORTED_VERSION',
  'INVALID_STATE',
  'RATE_LIMITED',
  'ROOM_FULL',
  'INVALID_MOVEMENT',
  'PORTAL_NOT_FOUND',
  'PORTAL_NOT_REACHABLE',
  'CHAT_REJECTED',
  'FORBIDDEN',
  'CONNECTION_REPLACED',
]);
export type WsErrorCode = z.infer<typeof WsErrorCode>;

/** Sobre común a todos los mensajes, en ambos sentidos. */
export function wsEnvelope<T extends string, P extends z.ZodType>(type: T, payload: P) {
  return z.object({
    v: z.literal(WS_PROTOCOL_VERSION),
    type: z.literal(type),
    id: z.string().max(40).optional(),
    seq: z.number().int().nonnegative().optional(),
    payload,
  });
}

/** Forma mínima para leer `v` y `type` antes de validar el mensaje concreto. */
export const WsEnvelopeHeader = z.object({
  v: z.number().int(),
  type: z.string().max(40),
});
