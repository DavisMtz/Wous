import { CreateCharacterRequest } from '@wous/contracts';
import { Hono } from 'hono';
import { useCaseContext } from '../../auth/use-case.ts';
import {
  CharacterErrors,
  createCharacter,
  findCharacterByAccount,
} from '../../characters/characters.ts';
import { readJson } from '../json.ts';
import { loadSession, requireActiveAccount } from '../middleware/session.ts';
import { ok } from '../respond.ts';
import type { AppHono } from '../types.ts';

export const characterRoutes = new Hono<AppHono>()
  .use('*', loadSession)

  .post('/', async (c) => {
    const session = requireActiveAccount(c);
    const input = await readJson(c, CreateCharacterRequest);
    const character = await createCharacter(useCaseContext(c), session, input);
    return ok(c, character, 201);
  })

  .get('/me', async (c) => {
    const session = requireActiveAccount(c);
    const character = await findCharacterByAccount(c.env.DB, session.account.id);
    if (!character) throw CharacterErrors.required();
    return ok(c, character);
  });
