import { createExecutionContext, createMessageBatch, getQueueResult } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import type { EmailQueueMessage } from '../src/email/queue-messages.ts';
import worker from '../src/index.ts';

describe('EMAIL_QUEUE', () => {
  it('acepta un mensaje de prueba del productor', async () => {
    const probe: EmailQueueMessage = { v: 1, kind: 'probe', sentAt: Date.now() };
    // Si la cola no acepta el mensaje, send() lanza.
    await env.EMAIL_QUEUE.send(probe);
  });

  it('el consumidor confirma la sonda y descarta lo malformado sin reintentar', async () => {
    const batch = createMessageBatch<unknown>('wous-email-local', [
      { id: 'm1', timestamp: new Date(), attempts: 1, body: { v: 1, kind: 'probe', sentAt: 1 } },
      { id: 'm2', timestamp: new Date(), attempts: 1, body: { basura: true } },
    ]);
    const ctx = createExecutionContext();
    await worker.queue(batch, env, ctx);
    const result = await getQueueResult(batch, ctx);
    expect([...result.explicitAcks].sort()).toEqual(['m1', 'm2']);
    expect(result.retryMessages).toEqual([]);
  });
});
