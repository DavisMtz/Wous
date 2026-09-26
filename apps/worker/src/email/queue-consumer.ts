import { readConfig } from '../config.ts';
import { createLogger } from '../lib/log.ts';
import { EmailQueueMessage, isDeadLetterQueue } from './queue-messages.ts';

/**
 * Consumidor de EMAIL_QUEUE y de su DLQ. En la Fase 1 valida el contrato y
 * atiende la sonda; el envío real por Brevo llega con WOU-008.
 */
export async function handleEmailQueue(
  batch: MessageBatch<unknown>,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  const config = readConfig(env);
  const log = createLogger({ environment: config.env, queue: batch.queue });
  const deadLetter = isDeadLetterQueue(batch.queue);

  for (const message of batch.messages) {
    const parsed = EmailQueueMessage.safeParse(message.body);
    if (!parsed.success) {
      // Un mensaje malformado no mejora reintentando: se descarta y se registra.
      log.warn('email.queue.invalid_message', { messageId: message.id });
      message.ack();
      continue;
    }

    if (parsed.data.kind === 'probe') {
      log.info('email.queue.probe_received', {
        messageId: message.id,
        deadLetter,
        lagMs: Date.now() - parsed.data.sentAt,
      });
      message.ack();
      continue;
    }

    log.warn('email.queue.outbox_not_implemented', {
      outboxId: parsed.data.outboxId,
      deadLetter,
    });
    message.ack();
  }
}
