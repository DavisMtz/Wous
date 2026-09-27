import { CharacterId } from '@wous/contracts';
import { Hono } from 'hono';
import { accountOfCharacter, listBlocks, removeBlock } from '../../world/social.ts';
import { Errors } from '../errors.ts';
import { loadSession, requireActiveAccount } from '../middleware/session.ts';
import { ok } from '../respond.ts';
import type { AppHono } from '../types.ts';

/**
 * Personas que bloqueaste (ADR-0010). Bloquear pasa en la sala, donde se
 * aplica en el acto; aquí se consulta la lista y se desbloquea desde la casa.
 * Desbloquear no avisa a ninguna sala: si seguías conectado en otra pestaña,
 * el bloqueo deja de aplicar al volver a entrar (sobra filtro, nunca falta).
 */
export const socialRoutes = new Hono<AppHono>()
  .use('*', loadSession)

  .get('/', async (c) => {
    const session = requireActiveAccount(c);
    const blocked = await listBlocks(c.env.DB, session.account.id);
    return ok(c, { blocked });
  })

  .delete('/:characterId', async (c) => {
    const session = requireActiveAccount(c);
    const characterId = CharacterId.safeParse(c.req.param('characterId'));
    if (!characterId.success) throw Errors.invalidRequest();
    const target = await accountOfCharacter(c.env.DB, characterId.data);
    if (!target) throw Errors.notFound();
    const unblocked = await removeBlock(c.env.DB, session.account.id, target);
    if (unblocked) c.get('log').info('social.unblock', { accountId: session.account.id });
    return ok(c, { unblocked });
  });
