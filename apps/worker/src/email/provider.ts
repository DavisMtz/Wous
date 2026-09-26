import type { OutboxType, TemplateParams } from './catalog.ts';

export type OutgoingEmail = {
  outboxId: string;
  type: OutboxType;
  to: { email: string; name: string };
  templateId: number;
  params: TemplateParams;
};

/**
 * Error de envío. `permanent` = reintentar no lo arreglará (petición inválida);
 * si no, la cola reintenta con espera creciente y al final va a la DLQ.
 */
export class EmailSendError extends Error {
  constructor(
    message: string,
    readonly permanent: boolean,
  ) {
    super(message);
    this.name = 'EmailSendError';
  }
}

/** Adaptador de proveedor (§31): el dominio nunca importa el SDK de Brevo. */
export interface EmailProvider {
  readonly name: string;
  send(email: OutgoingEmail): Promise<{ providerMessageId: string }>;
}
