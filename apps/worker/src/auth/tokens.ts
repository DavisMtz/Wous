import { AUTH } from '@wous/config';
import type { Clock } from '../lib/clock.ts';
import { hmacSha256, randomToken } from '../lib/crypto.ts';
import type { IdGenerator } from '../lib/ids.ts';

export type OneTimeTokenKind = 'verify' | 'reset';

const TABLE: Record<OneTimeTokenKind, string> = {
  verify: 'email_verification_tokens',
  reset: 'password_reset_tokens',
};

const TTL: Record<OneTimeTokenKind, number> = {
  verify: AUTH.verificationTokenTtlMs,
  reset: AUTH.passwordResetTokenTtlMs,
};

/** HMAC con TOKEN_PEPPER y el tipo como dominio: un token de reset no vale como verificación. */
export function hashOneTimeToken(env: Env, kind: OneTimeTokenKind, token: string) {
  return hmacSha256(env.TOKEN_PEPPER, `${kind}:${token}`);
}

export type PreparedToken = {
  id: string;
  token: string;
  expiresAt: number;
  ttlMinutes: number;
  /** Deja sin efecto los tokens anteriores sin usar (solo vale el más reciente). */
  invalidatePrevious: D1PreparedStatement;
  insert: D1PreparedStatement;
};

export async function prepareOneTimeToken(
  env: Env,
  deps: { clock: Clock; ids: IdGenerator },
  kind: OneTimeTokenKind,
  accountId: string,
): Promise<PreparedToken> {
  const now = deps.clock.now();
  const token = randomToken(AUTH.tokenBytes);
  const id = deps.ids.next(kind === 'verify' ? 'verificationToken' : 'passwordResetToken');
  const expiresAt = now + TTL[kind];
  const table = TABLE[kind];
  return {
    id,
    token,
    expiresAt,
    ttlMinutes: Math.round(TTL[kind] / 60_000),
    invalidatePrevious: env.DB.prepare(
      `UPDATE ${table} SET used_at = ? WHERE account_id = ? AND used_at IS NULL`,
    ).bind(now, accountId),
    insert: env.DB.prepare(
      `INSERT INTO ${table} (id, account_id, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(id, accountId, await hashOneTimeToken(env, kind, token), expiresAt, now),
  };
}

/**
 * Consume un token en UNA sentencia condicional: solo una petición puede
 * ganarlo, aunque lleguen dos a la vez (single-use real, §6).
 */
export async function consumeOneTimeToken(
  env: Env,
  clock: Clock,
  kind: OneTimeTokenKind,
  token: string,
): Promise<{ tokenId: string; accountId: string } | null> {
  const now = clock.now();
  const row = await env.DB.prepare(
    `UPDATE ${TABLE[kind]} SET used_at = ?
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
      RETURNING id, account_id`,
  )
    .bind(now, await hashOneTimeToken(env, kind, token), now)
    .first<{ id: string; account_id: string }>();
  return row ? { tokenId: row.id, accountId: row.account_id } : null;
}

/** Busca un token vigente sin consumirlo (para validar antes de gastarlo). */
export async function peekOneTimeToken(
  env: Env,
  clock: Clock,
  kind: OneTimeTokenKind,
  token: string,
): Promise<{ tokenId: string; accountId: string } | null> {
  const row = await env.DB.prepare(
    `SELECT id, account_id FROM ${TABLE[kind]}
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`,
  )
    .bind(await hashOneTimeToken(env, kind, token), clock.now())
    .first<{ id: string; account_id: string }>();
  return row ? { tokenId: row.id, accountId: row.account_id } : null;
}
