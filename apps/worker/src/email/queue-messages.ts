import { z } from 'zod';

/**
 * Mensajes de EMAIL_QUEUE. Solo viaja el ID del outbox: el contenido vive en
 * D1 y el consumidor lo relee, así un mensaje duplicado no manda otro correo
 * si el outbox ya está SENT (§7).
 */
export const EmailQueueMessage = z.discriminatedUnion('kind', [
  z.object({ v: z.literal(1), kind: z.literal('outbox'), outboxId: z.string().max(40) }),
  /** Sonda para comprobar la cola en un entorno controlado (DoD de la Fase 1). */
  z.object({ v: z.literal(1), kind: z.literal('probe'), sentAt: z.number().int() }),
]);
export type EmailQueueMessage = z.infer<typeof EmailQueueMessage>;

export function isDeadLetterQueue(queueName: string): boolean {
  return queueName.includes('-dlq');
}
