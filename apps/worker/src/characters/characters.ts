import {
  type AppearanceInput,
  type CharacterView,
  type CreateCharacterRequest,
  resolveAppearance,
} from '@wous/contracts';
import { auditStatement } from '../accounts/audit.ts';
import { isReservedUsername } from '../accounts/normalize.ts';
import type { SessionContext } from '../auth/sessions.ts';
import type { UseCaseContext } from '../auth/use-case.ts';
import { AppError } from '../http/errors.ts';
import { errorFields } from '../lib/log.ts';

type CharacterRow = {
  id: string;
  display_name: string;
  created_at: number;
  body_id: string;
  skin_tone_id: string;
  hair_id: string;
  hair_color_id: string;
  top_id: string;
  bottom_id: string;
  shoes_id: string;
  accessory_id: string | null;
};

function toView(row: CharacterRow): CharacterView {
  return {
    id: row.id,
    displayName: row.display_name,
    createdAt: row.created_at,
    appearance: {
      body: row.body_id,
      skinTone: row.skin_tone_id,
      hair: row.hair_id,
      hairColor: row.hair_color_id,
      top: row.top_id,
      bottom: row.bottom_id,
      shoes: row.shoes_id,
      accessory: row.accessory_id,
    } as AppearanceInput,
  };
}

export async function findCharacterByAccount(
  db: D1Database,
  accountId: string,
): Promise<CharacterView | null> {
  const row = await db
    .prepare(
      `SELECT c.id, c.display_name, c.created_at, a.body_id, a.skin_tone_id, a.hair_id,
              a.hair_color_id, a.top_id, a.bottom_id, a.shoes_id, a.accessory_id
         FROM characters c JOIN character_appearance a ON a.character_id = c.id
        WHERE c.account_id = ?`,
    )
    .bind(accountId)
    .first<CharacterRow>();
  return row ? toView(row) : null;
}

export const CharacterErrors = {
  exists: () => new AppError('CHARACTER_EXISTS', 409, 'Ya tienes un personaje.'),
  required: () => new AppError('CHARACTER_REQUIRED', 403, 'Primero arma tu personaje.'),
  invalidAppearance: (fields: Record<string, string>) =>
    new AppError('INVALID_APPEARANCE', 400, 'Revisa las piezas de tu personaje.', { fields }),
  invalidDisplayName: (message: string) =>
    new AppError('INVALID_DISPLAY_NAME', 400, message, { fields: { displayName: message } }),
};

/** Sin acentos, sin espacios ni signos: para comparar contra nombres reservados. */
function displayNameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * CREATE_CHARACTER (§10). El cliente solo manda IDs del catálogo; el servidor
 * valida sesión ACTIVE (en la ruta), un personaje por cuenta, nombre, que
 * cada pieza exista y sea del set inicial, y que la combinación sea posible.
 */
export async function createCharacter(
  ctx: UseCaseContext,
  session: SessionContext,
  input: CreateCharacterRequest,
): Promise<CharacterView> {
  const { env, deps, log } = ctx;

  const key = displayNameKey(input.displayName);
  if (isReservedUsername(key) || /^(wous|admin|mod|staff|soporte|moderador)/.test(key)) {
    throw CharacterErrors.invalidDisplayName('Ese nombre está reservado. Elige otro.');
  }

  const resolved = resolveAppearance(input.appearance, { starterOnly: true });
  if (!resolved.ok) {
    throw CharacterErrors.invalidAppearance(
      Object.fromEntries(resolved.problems.map((p) => [`appearance.${p.field}`, p.message])),
    );
  }

  if (await findCharacterByAccount(env.DB, session.account.id)) throw CharacterErrors.exists();

  const now = deps.clock.now();
  const characterId = deps.ids.next('character');
  const a = input.appearance;
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO characters (id, account_id, display_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).bind(characterId, session.account.id, input.displayName, now, now),
      env.DB.prepare(
        `INSERT INTO character_appearance (character_id, body_id, skin_tone_id, hair_id,
           hair_color_id, top_id, bottom_id, shoes_id, accessory_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        characterId,
        a.body,
        a.skinTone,
        a.hair,
        a.hairColor,
        a.top,
        a.bottom,
        a.shoes,
        a.accessory,
        now,
      ),
      auditStatement(env.DB, deps, {
        actorAccountId: session.account.id,
        action: 'CHARACTER_CREATED',
        targetType: 'character',
        targetId: characterId,
      }),
    ]);
  } catch (err) {
    // Dos pestañas creando a la vez: el UNIQUE de account_id decide.
    if (/account_id/.test(String(errorFields(err).errorMessage))) throw CharacterErrors.exists();
    throw err;
  }

  log.info('character.created', { accountId: session.account.id, characterId });
  return {
    id: characterId,
    displayName: input.displayName,
    createdAt: now,
    appearance: input.appearance,
  };
}
