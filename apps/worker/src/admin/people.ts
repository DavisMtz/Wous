import type { AccountStatus, AdminPerson, AppearanceInput } from '@wous/contracts';

/**
 * Una persona como la ve la caseta (ADR-0012): su cuenta y, si ya lo armó,
 * su personaje con su apariencia (para el retrato).
 */

export type PersonRow = {
  account_id: string;
  username: string;
  status: AccountStatus;
  character_id: string | null;
  display_name: string | null;
  body_id: string | null;
  skin_tone_id: string | null;
  hair_id: string | null;
  hair_color_id: string | null;
  top_id: string | null;
  bottom_id: string | null;
  shoes_id: string | null;
  accessory_id: string | null;
};

export const PERSON_COLUMNS = `a.id AS account_id, a.username, a.status, c.id AS character_id,
  c.display_name, ap.body_id, ap.skin_tone_id, ap.hair_id, ap.hair_color_id, ap.top_id,
  ap.bottom_id, ap.shoes_id, ap.accessory_id`;

export const PERSON_FROM = `FROM accounts a
  LEFT JOIN characters c ON c.account_id = a.id
  LEFT JOIN character_appearance ap ON ap.character_id = c.id`;

export function toAdminPerson(row: PersonRow): AdminPerson {
  const appearance =
    row.character_id &&
    row.body_id &&
    row.skin_tone_id &&
    row.hair_id &&
    row.hair_color_id &&
    row.top_id &&
    row.bottom_id &&
    row.shoes_id
      ? ({
          body: row.body_id,
          skinTone: row.skin_tone_id,
          hair: row.hair_id,
          hairColor: row.hair_color_id,
          top: row.top_id,
          bottom: row.bottom_id,
          shoes: row.shoes_id,
          accessory: row.accessory_id,
        } as AppearanceInput)
      : null;
  return {
    accountId: row.account_id,
    username: row.username,
    status: row.status,
    characterId: row.character_id,
    displayName: row.display_name,
    appearance,
  };
}

/** Varias personas de una vez, por cuenta. */
export async function peopleByAccount(
  db: D1Database,
  accountIds: readonly string[],
): Promise<Map<string, AdminPerson>> {
  const unique = [...new Set(accountIds)];
  if (unique.length === 0) return new Map();
  const { results } = await db
    .prepare(
      `SELECT ${PERSON_COLUMNS} ${PERSON_FROM}
        WHERE a.id IN (SELECT value FROM json_each(?))`,
    )
    .bind(JSON.stringify(unique))
    .all<PersonRow>();
  return new Map(results.map((row) => [row.account_id, toAdminPerson(row)]));
}
