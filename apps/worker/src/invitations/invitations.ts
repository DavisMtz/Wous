import { INVITATIONS, TIME } from '@wous/config';
import {
  type AdminInvitation,
  type CreateInvitationRequest,
  formatInvitationCode,
  type InvitationStatus,
} from '@wous/contracts';
import { auditStatement, auditStatementIf } from '../accounts/audit.ts';
import type { Clock } from '../lib/clock.ts';
import { decryptString, encryptString, hmacSha256 } from '../lib/crypto.ts';
import type { IdGenerator } from '../lib/ids.ts';
import { errorFields } from '../lib/log.ts';

/**
 * Invitaciones de la alpha cerrada (ADR-0012). El código nunca se guarda en
 * claro: `code_hash` (HMAC con TOKEN_PEPPER) sirve para encontrarlo al
 * registrarse y `code_enc` (AES-GCM, llave derivada del mismo pepper) para que
 * la caseta lo vuelva a mostrar. Sin el pepper, una copia de la base no sirve
 * para registrarse.
 */

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LABEL = 'wous/invitation-code/v1';

type Deps = { clock: Clock; ids: IdGenerator };

/** Código nuevo: caracteres Crockford al azar (256 es múltiplo de 32: sin sesgo). */
export function generateInvitationCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(INVITATIONS.codeLength));
  let code = '';
  for (const byte of bytes) code += CROCKFORD.charAt(byte & 31);
  return code;
}

/** Huella con la que se busca un código (ya normalizado). */
export function invitationCodeHash(env: Env, code: string): Promise<string> {
  return hmacSha256(env.TOKEN_PEPPER, `invitation:${code}`);
}

/**
 * Gasta un cupo, si la invitación todavía sirve, en UNA sentencia: dos
 * registros a la vez con el último cupo no pasan los dos. Devuelve su ID.
 */
export async function consumeInvitation(
  db: D1Database,
  codeHash: string,
  now: number,
): Promise<string | null> {
  const row = await db
    .prepare(
      `UPDATE invitations SET uses = uses + 1
        WHERE code_hash = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)
          AND uses < max_uses
        RETURNING id`,
    )
    .bind(codeHash, now)
    .first<{ id: string }>();
  return row?.id ?? null;
}

/** Devuelve el cupo cuando el alta de la cuenta no llegó a hacerse. */
export async function releaseInvitation(db: D1Database, id: string): Promise<void> {
  await db
    .prepare('UPDATE invitations SET uses = uses - 1 WHERE id = ? AND uses > 0')
    .bind(id)
    .run();
}

// ─── Caseta ──────────────────────────────────────────────────────────────

type InvitationRow = {
  id: string;
  code_enc: string;
  label: string;
  max_uses: number;
  uses: number;
  expires_at: number | null;
  revoked_at: number | null;
  created_at: number;
  created_by_username: string | null;
  accounts: number;
};

const SELECT_INVITATIONS = `SELECT i.id, i.code_enc, i.label, i.max_uses, i.uses, i.expires_at,
    i.revoked_at, i.created_at, a.username AS created_by_username,
    (SELECT COUNT(*) FROM accounts x WHERE x.invitation_id = i.id) AS accounts
  FROM invitations i LEFT JOIN accounts a ON a.id = i.created_by`;

export function invitationStatus(
  row: Pick<InvitationRow, 'uses' | 'max_uses' | 'expires_at' | 'revoked_at'>,
  now: number,
): InvitationStatus {
  if (row.revoked_at !== null) return 'REVOKED';
  if (row.uses >= row.max_uses) return 'USED_UP';
  if (row.expires_at !== null && row.expires_at <= now) return 'EXPIRED';
  return 'ACTIVE';
}

async function toAdminInvitation(env: Env, row: InvitationRow, now: number) {
  let code: string | null = null;
  try {
    code = formatInvitationCode(await decryptString(env.TOKEN_PEPPER, CODE_LABEL, row.code_enc));
  } catch {
    // Cambió el pepper del entorno: el código ya no se puede mostrar ni usar.
  }
  const invitation: AdminInvitation = {
    id: row.id,
    code,
    label: row.label,
    maxUses: row.max_uses,
    uses: row.uses,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    createdBy: row.created_by_username ? `@${row.created_by_username}` : null,
    status: invitationStatus(row, now),
    accounts: row.accounts,
  };
  return invitation;
}

/** Las invitaciones, lo más reciente primero. */
export async function listInvitations(env: Env, now: number): Promise<AdminInvitation[]> {
  const { results } = await env.DB.prepare(
    `${SELECT_INVITATIONS} ORDER BY i.created_at DESC LIMIT ?`,
  )
    .bind(INVITATIONS.listLimit)
    .all<InvitationRow>();
  return Promise.all(results.map((row) => toAdminInvitation(env, row, now)));
}

export async function findInvitation(
  env: Env,
  id: string,
  now: number,
): Promise<AdminInvitation | null> {
  const row = await env.DB.prepare(`${SELECT_INVITATIONS} WHERE i.id = ?`)
    .bind(id)
    .first<InvitationRow>();
  return row ? toAdminInvitation(env, row, now) : null;
}

/** Una invitación nueva, con su fila de auditoría en el mismo batch. */
export async function createInvitation(
  env: Env,
  deps: Deps,
  actorAccountId: string,
  input: CreateInvitationRequest,
): Promise<AdminInvitation> {
  const now = deps.clock.now();
  const id = deps.ids.next('invitation');
  const expiresAt = now + input.expiresInDays * TIME.DAY;
  // Dos códigos al azar de 50 bits casi nunca chocan; si pasa, el UNIQUE lo
  // detiene y se prueba con otro.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateInvitationCode();
    try {
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO invitations (id, code_hash, code_enc, label, max_uses, expires_at,
             created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          id,
          await invitationCodeHash(env, code),
          await encryptString(env.TOKEN_PEPPER, CODE_LABEL, code),
          input.label,
          input.maxUses,
          expiresAt,
          actorAccountId,
          now,
        ),
        auditStatement(env.DB, deps, {
          actorAccountId,
          action: 'INVITATION_CREATED',
          targetType: 'invitation',
          targetId: id,
          reason: input.label,
          metadata: { via: 'caseta', maxUses: input.maxUses, expiresInDays: input.expiresInDays },
        }),
      ]);
      const created = await findInvitation(env, id, now);
      if (!created) throw new Error('Invitación recién creada no encontrada');
      return created;
    } catch (err) {
      if (!/code_hash/.test(String(errorFields(err).errorMessage))) throw err;
    }
  }
  throw new Error('No se pudo generar un código de invitación único');
}

/**
 * Revocar: la invitación deja de servir para siempre (lo ya registrado se
 * queda). Repetirlo no cambia nada. `null` si no existe.
 */
export async function revokeInvitation(
  env: Env,
  deps: Deps,
  actorAccountId: string,
  id: string,
  reason: string,
): Promise<{ invitation: AdminInvitation; changed: boolean } | null> {
  const now = deps.clock.now();
  const [, update] = await env.DB.batch([
    auditStatementIf(
      env.DB,
      deps,
      {
        actorAccountId,
        action: 'INVITATION_REVOKED',
        targetType: 'invitation',
        targetId: id,
        reason,
        metadata: { via: 'caseta' },
      },
      {
        sql: 'EXISTS (SELECT 1 FROM invitations WHERE id = ? AND revoked_at IS NULL)',
        binds: [id],
      },
    ),
    env.DB.prepare(
      'UPDATE invitations SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL',
    ).bind(now, id),
  ]);
  const invitation = await findInvitation(env, id, now);
  if (!invitation) return null;
  return { invitation, changed: update?.meta.changes === 1 };
}
