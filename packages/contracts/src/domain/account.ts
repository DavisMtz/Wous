import { z } from 'zod';

/** Estados de cuenta (§6). Solo ACTIVE entra al mundo. */
export const AccountStatus = z.enum(['PENDING_EMAIL', 'ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED']);
export type AccountStatus = z.infer<typeof AccountStatus>;

/** Estado de entregabilidad del correo, alimentado por el webhook de Brevo. */
export const EmailDeliverability = z.enum(['UNKNOWN', 'OK', 'SOFT_BOUNCE', 'UNDELIVERABLE']);
export type EmailDeliverability = z.infer<typeof EmailDeliverability>;

/**
 * Roles de quien atiende la caseta (ADR-0012). Viven en la tabla `staff` y
 * solo los da el script de moderación: nunca llegan del navegador.
 */
export const StaffRole = z.enum(['ADMIN']);
export type StaffRole = z.infer<typeof StaffRole>;
