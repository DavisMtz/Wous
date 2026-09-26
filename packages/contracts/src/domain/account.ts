import { z } from 'zod';

/** Estados de cuenta (§6). Solo ACTIVE entra al mundo. */
export const AccountStatus = z.enum(['PENDING_EMAIL', 'ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED']);
export type AccountStatus = z.infer<typeof AccountStatus>;

/** Estado de entregabilidad del correo, alimentado por el webhook de Brevo. */
export const EmailDeliverability = z.enum(['UNKNOWN', 'OK', 'SOFT_BOUNCE', 'UNDELIVERABLE']);
export type EmailDeliverability = z.infer<typeof EmailDeliverability>;
