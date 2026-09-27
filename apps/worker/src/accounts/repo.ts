import type { AccountStatus, EmailDeliverability } from '@wous/contracts';

export type AccountRow = {
  id: string;
  email: string;
  email_normalized: string;
  username: string;
  username_normalized: string;
  password_hash: string;
  status: AccountStatus;
  email_verified_at: number | null;
  email_deliverability: EmailDeliverability;
  terms_version: string;
  terms_accepted_at: number;
  created_at: number;
  updated_at: number;
  /** Fin de la suspensión (epoch ms); null con SUSPENDED = indefinida (ADR-0012). */
  suspended_until: number | null;
};

const COLUMNS = `id, email, email_normalized, username, username_normalized, password_hash, status,
  email_verified_at, email_deliverability, terms_version, terms_accepted_at, created_at, updated_at,
  suspended_until`;

export function findAccountByEmail(db: D1Database, emailNormalized: string) {
  return db
    .prepare(`SELECT ${COLUMNS} FROM accounts WHERE email_normalized = ?`)
    .bind(emailNormalized)
    .first<AccountRow>();
}

export function findAccountByUsername(db: D1Database, usernameNormalized: string) {
  return db
    .prepare(`SELECT ${COLUMNS} FROM accounts WHERE username_normalized = ?`)
    .bind(usernameNormalized)
    .first<AccountRow>();
}

export function findAccountById(db: D1Database, id: string) {
  return db.prepare(`SELECT ${COLUMNS} FROM accounts WHERE id = ?`).bind(id).first<AccountRow>();
}

export async function usernameExists(db: D1Database, usernameNormalized: string) {
  const row = await db
    .prepare('SELECT 1 AS x FROM accounts WHERE username_normalized = ?')
    .bind(usernameNormalized)
    .first();
  return row !== null;
}
