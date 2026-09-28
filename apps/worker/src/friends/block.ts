import { SOCIAL } from '@wous/config';
import type { UseCaseContext } from '../auth/use-case.ts';
import { AppError } from '../http/errors.ts';
import { addBlock } from '../world/social.ts';
import { roomOf } from '../world/whereabouts.ts';
import type { Person } from './friends.ts';

/**
 * Bloquear desde la lista de amigos (`POST /users/:characterId/block`,
 * ADR-0011). Es el mismo bloqueo que en la ficha: termina la amistad del par
 * y, si quien bloquea está en una sala, aplica ahí en el acto. Desbloquear
 * desde la casa no avisa a la sala (ADR-0010: ahí el filtro sobra); bloquear
 * sí, porque un filtro que falta deja pasar lo que ya no quieres oír.
 */
export async function blockFromOutside(
  ctx: UseCaseContext,
  actor: Person,
  target: Person,
): Promise<void> {
  if (actor.accountId === target.accountId) {
    throw new AppError('FORBIDDEN', 403, 'No puedes bloquearte a ti.');
  }
  const result = await addBlock(
    ctx.env.DB,
    actor.accountId,
    target.accountId,
    ctx.deps.clock.now(),
  );
  if (result === 'limit') {
    throw new AppError(
      'LIMIT_REACHED',
      409,
      `Ya bloqueaste a ${SOCIAL.maxBlocksPerAccount} personas. Desbloquea a alguien primero.`,
    );
  }
  ctx.log.info('social.block', { accountId: actor.accountId, result });
  await applyInRoom(ctx, actor, target);
}

/**
 * La sala donde está quien bloquea, si está en alguna. Si algo falla, el
 * bloqueo ya quedó en D1 y aplica en cuanto vuelva a entrar.
 */
async function applyInRoom(ctx: UseCaseContext, blocker: Person, blocked: Person): Promise<void> {
  const { env, log } = ctx;
  try {
    const room = await roomOf(env, blocker.characterId);
    if (!room) return;
    await room.applyBlock(blocker.accountId, blocked.accountId, blocked.characterId);
  } catch (err) {
    log.error('social.block_room_failed', { accountId: blocker.accountId, error: String(err) });
  }
}
