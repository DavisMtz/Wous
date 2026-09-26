import { z } from 'zod';
import { type EmailProvider, EmailSendError } from './provider.ts';

const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';

const BrevoSendResponse = z.object({ messageId: z.string() });

/**
 * Brevo Transactional API (§7). Solo entrega correo: no decide nada del
 * dominio. La llave vive únicamente en el secreto BREVO_API_KEY.
 */
export function createBrevoProvider(options: {
  apiKey: string;
  sender: { name: string; email: string };
  fetchFn?: typeof fetch;
}): EmailProvider {
  const fetchFn = options.fetchFn ?? fetch;
  return {
    name: 'brevo',
    async send(email) {
      if (!email.templateId) {
        throw new EmailSendError(`Sin plantilla de Brevo para ${email.type}`, false);
      }

      let res: Response;
      try {
        res = await fetchFn(BREVO_SEND_URL, {
          method: 'POST',
          headers: {
            'api-key': options.apiKey,
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({
            sender: options.sender,
            to: [{ email: email.to.email, name: email.to.name }],
            templateId: email.templateId,
            params: email.params,
            tags: [email.type],
            headers: { 'X-Wous-Outbox': email.outboxId },
          }),
        });
      } catch (err) {
        throw new EmailSendError(`Brevo inaccesible: ${String(err)}`, false);
      }

      if (res.ok) {
        const parsed = BrevoSendResponse.safeParse(await res.json().catch(() => null));
        if (!parsed.success) throw new EmailSendError('Respuesta de Brevo sin messageId', false);
        return { providerMessageId: parsed.data.messageId };
      }

      // 400/404: la petición es inválida y reintentar no la arregla.
      // 401/403 (llave caducada), 429 y 5xx: transitorios; la cola reintenta.
      const permanent = res.status === 400 || res.status === 404;
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      throw new EmailSendError(`Brevo ${res.status}: ${detail}`, permanent);
    },
  };
}
