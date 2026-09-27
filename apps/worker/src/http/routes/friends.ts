import { RATE_LIMITS, type RateLimitRule } from '@wous/config';
import {
  type BlockResponse,
  CharacterId,
  FriendRequestBody,
  FriendshipId,
  UpdateNotificationPreferences,
} from '@wous/contracts';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { useCaseContext } from '../../auth/use-case.ts';
import { CharacterErrors, findCharacterByAccount } from '../../characters/characters.ts';
import { blockFromOutside } from '../../friends/block.ts';
import {
  acceptFriendship,
  endFriendship,
  findPerson,
  getPreferences,
  listFriends,
  type Person,
  requestFriendship,
  updatePreferences,
} from '../../friends/friends.ts';
import { enforceRateLimit, identityRateKey } from '../../security/rate-limit.ts';
import { Errors } from '../errors.ts';
import { readJson } from '../json.ts';
import { loadSession, requireActiveAccount } from '../middleware/session.ts';
import { ok } from '../respond.ts';
import type { AppHono } from '../types.ts';

/**
 * Amistades (§20, ADR-0011), bloquear desde la lista y los avisos por correo.
 * Todo exige cuenta ACTIVE; lo de amistades, además, personaje: a la gente se
 * la conoce por su personaje.
 */

/** Quien pide, como lo ven los demás. */
async function actorOf(c: Context<AppHono>): Promise<Person> {
  const session = requireActiveAccount(c);
  const character = await findCharacterByAccount(c.env.DB, session.account.id);
  if (!character) throw CharacterErrors.required();
  return {
    accountId: session.account.id,
    characterId: character.id,
    displayName: character.displayName,
    appearance: character.appearance,
    status: session.account.status,
  };
}

async function limitActor(
  c: Context<AppHono>,
  accountId: string,
  scope: string,
  rule: RateLimitRule,
): Promise<void> {
  await enforceRateLimit(
    c.get('deps').rateLimiter,
    await identityRateKey(c.env, scope, accountId),
    rule,
  );
}

function friendshipParam(c: Context<AppHono>): string {
  const id = FriendshipId.safeParse(c.req.param('friendshipId'));
  if (!id.success) throw Errors.invalidRequest();
  return id.data;
}

export const friendRoutes = new Hono<AppHono>()
  .use('*', loadSession)

  .get('/', async (c) => {
    const actor = await actorOf(c);
    return ok(c, await listFriends(c.env.DB, actor.accountId));
  })

  .post('/request', async (c) => {
    const actor = await actorOf(c);
    const body = await readJson(c, FriendRequestBody);
    await limitActor(c, actor.accountId, 'friend-request', RATE_LIMITS.friendRequestsPerAccount);
    const target = await findPerson(c.env.DB, body.characterId);
    if (!target) throw Errors.notFound();
    return ok(c, await requestFriendship(useCaseContext(c), actor, target));
  })

  .post('/:friendshipId/accept', async (c) => {
    const actor = await actorOf(c);
    const friendshipId = friendshipParam(c);
    await limitActor(c, actor.accountId, 'social', RATE_LIMITS.socialActionsPerAccount);
    return ok(c, await acceptFriendship(useCaseContext(c), actor, friendshipId));
  })

  .post('/:friendshipId/reject', async (c) => {
    const actor = await actorOf(c);
    const friendshipId = friendshipParam(c);
    await limitActor(c, actor.accountId, 'social', RATE_LIMITS.socialActionsPerAccount);
    return ok(c, await endFriendship(useCaseContext(c), actor, friendshipId, 'reject'));
  })

  .post('/:friendshipId/remove', async (c) => {
    const actor = await actorOf(c);
    const friendshipId = friendshipParam(c);
    await limitActor(c, actor.accountId, 'social', RATE_LIMITS.socialActionsPerAccount);
    return ok(c, await endFriendship(useCaseContext(c), actor, friendshipId, 'remove'));
  });

/** `POST /users/:characterId/block`: el `:id` del §20 es el personaje (ADR-0011). */
export const userRoutes = new Hono<AppHono>()
  .use('*', loadSession)

  .post('/:characterId/block', async (c) => {
    const actor = await actorOf(c);
    const characterId = CharacterId.safeParse(c.req.param('characterId'));
    if (!characterId.success) throw Errors.invalidRequest();
    await limitActor(c, actor.accountId, 'social', RATE_LIMITS.socialActionsPerAccount);
    const target = await findPerson(c.env.DB, characterId.data);
    if (!target) throw Errors.notFound();
    await blockFromOutside(useCaseContext(c), actor, target);
    return ok(c, { blocked: true } satisfies BlockResponse);
  });

/** Avisos por correo que se pueden apagar (§7): solo los sociales. */
export const preferenceRoutes = new Hono<AppHono>()
  .use('*', loadSession)

  .get('/', async (c) => {
    const session = requireActiveAccount(c);
    return ok(c, await getPreferences(c.env.DB, session.account.id));
  })

  .post('/', async (c) => {
    const session = requireActiveAccount(c);
    const patch = await readJson(c, UpdateNotificationPreferences);
    await limitActor(c, session.account.id, 'social', RATE_LIMITS.socialActionsPerAccount);
    const prefs = await updatePreferences(
      c.env.DB,
      session.account.id,
      patch,
      c.get('deps').clock.now(),
    );
    c.get('log').info('preferences.updated', { accountId: session.account.id, ...prefs });
    return ok(c, prefs);
  });
