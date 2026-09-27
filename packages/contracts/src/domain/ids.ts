import { z } from 'zod';

/**
 * IDs públicos: `<prefijo>_<ULID>`. No secuenciales, ordenables por tiempo
 * (bueno para los índices de D1) y con el tipo de entidad legible a simple vista.
 */
export const ID_PREFIXES = {
  account: 'acc',
  session: 'ses',
  character: 'chr',
  verificationToken: 'vrt',
  passwordResetToken: 'prt',
  /** Mensajes del protocolo WebSocket (`"id": "evt_…"`, §12). */
  event: 'evt',
  outbox: 'obx',
  deliveryEvent: 'dle',
  audit: 'aud',
  request: 'req',
  friendship: 'frn',
  message: 'msg',
  report: 'rpt',
} as const;

export type IdKind = keyof typeof ID_PREFIXES;
export type IdPrefix = (typeof ID_PREFIXES)[IdKind];

/** Alfabeto Crockford base32 de ULID (sin I, L, O, U). */
export const ULID_PATTERN = '[0-9A-HJKMNP-TV-Z]{26}';

export function idSchema<K extends IdKind>(kind: K) {
  const prefix = ID_PREFIXES[kind];
  return z
    .string()
    .regex(new RegExp(`^${prefix}_${ULID_PATTERN}$`), { message: `ID de ${kind} inválido` });
}

export const AccountId = idSchema('account');
export const CharacterId = idSchema('character');
export const FriendshipId = idSchema('friendship');
export const RequestId = idSchema('request');
export const MessageId = idSchema('message');
export const ReportId = idSchema('report');
