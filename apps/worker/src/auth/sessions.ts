import { AUTH } from '@wous/config';
import type { AccountStatus, StaffRole } from '@wous/contracts';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppHono } from '../http/types.ts';
import type { Clock } from '../lib/clock.ts';
import { hmacSha256, randomToken } from '../lib/crypto.ts';
import type { IdGenerator } from '../lib/ids.ts';

/**
 * Sesiones por cookie HttpOnly (§6). `__Host-` obliga a Secure, Path=/ y sin
 * Domain: la cookie no se comparte con subdominios. En D1 solo va el HMAC.
 */
export const SESSION_COOKIE = '__Host-wous_session';

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

export type SessionAccount = {
  id: string;
  email: string;
  username: string;
  status: AccountStatus;
  createdAt: number;
  /** Rol en la caseta (ADR-0012): sale de `staff` en cada petición, nunca del cliente. */
  staffRole: StaffRole | null;
};

export type SessionContext = {
  sessionId: string;
  account: SessionAccount;
};

export function hashSessionToken(env: Env, token: string): Promise<string> {
  return hmacSha256(env.SESSION_PEPPER, `session:${token}`);
}

/** Resume el User-Agent (familia de navegador y SO), sin guardarlo entero. */
export function summarizeUserAgent(userAgent: string | undefined): string | null {
  if (!userAgent) return null;
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Chrome\//.test(userAgent)
      ? 'Chrome'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : 'Otro';
  const os = /Android/.test(userAgent)
    ? 'Android'
    : /iPhone|iPad/.test(userAgent)
      ? 'iOS'
      : /Windows/.test(userAgent)
        ? 'Windows'
        : /Mac OS X/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : 'Otro';
  return `${browser} · ${os}`;
}

export type NewSession = {
  token: string;
  sessionId: string;
  expiresAt: number;
  statement: D1PreparedStatement;
};

/** Prepara una sesión nueva; la sentencia va en el batch del caso de uso. */
export async function prepareSession(
  env: Env,
  deps: { clock: Clock; ids: IdGenerator },
  accountId: string,
  userAgent: string | undefined,
): Promise<NewSession> {
  const token = randomToken(AUTH.tokenBytes);
  const now = deps.clock.now();
  const sessionId = deps.ids.next('session');
  const expiresAt = now + AUTH.sessionTtlMs;
  const statement = env.DB.prepare(
    `INSERT INTO sessions (id, account_id, token_hash, created_at, last_seen_at, expires_at,
       user_agent_summary) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    sessionId,
    accountId,
    await hashSessionToken(env, token),
    now,
    now,
    expiresAt,
    summarizeUserAgent(userAgent),
  );
  return { token, sessionId, expiresAt, statement };
}

type SessionRow = {
  session_id: string;
  last_seen_at: number;
  expires_at: number;
  revoked_at: number | null;
  account_id: string;
  email: string;
  username: string;
  status: AccountStatus;
  created_at: number;
  staff_role: StaffRole | null;
};

/**
 * Resuelve la sesión de una cookie. `last_seen_at` se escribe como máximo
 * cada 15 min (§6), fuera del camino de la respuesta.
 */
export async function resolveSession(
  env: Env,
  clock: Clock,
  token: string | undefined,
  waitUntil: (p: Promise<unknown>) => void,
): Promise<SessionContext | null> {
  if (!token || !TOKEN_FORMAT.test(token)) return null;
  const row = await env.DB.prepare(
    `SELECT s.id AS session_id, s.last_seen_at, s.expires_at, s.revoked_at,
            a.id AS account_id, a.email, a.username, a.status, a.created_at,
            st.role AS staff_role
       FROM sessions s JOIN accounts a ON a.id = s.account_id
       LEFT JOIN staff st ON st.account_id = a.id
      WHERE s.token_hash = ?`,
  )
    .bind(await hashSessionToken(env, token))
    .first<SessionRow>();

  const now = clock.now();
  if (!row || row.revoked_at !== null || row.expires_at <= now || row.status === 'DELETED') {
    return null;
  }

  if (now - row.last_seen_at >= AUTH.sessionTouchIntervalMs) {
    waitUntil(
      env.DB.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?')
        .bind(now, row.session_id)
        .run(),
    );
  }

  return {
    sessionId: row.session_id,
    account: {
      id: row.account_id,
      email: row.email,
      username: row.username,
      status: row.status,
      createdAt: row.created_at,
      staffRole: row.staff_role,
    },
  };
}

/** El rol de una cuenta en la caseta, o null (para las respuestas de login y verificación). */
export async function staffRoleOf(db: D1Database, accountId: string): Promise<StaffRole | null> {
  const row = await db
    .prepare('SELECT role FROM staff WHERE account_id = ?')
    .bind(accountId)
    .first<{ role: StaffRole }>();
  return row?.role ?? null;
}

export function readSessionCookie(c: Context<AppHono>): string | undefined {
  return getCookie(c, SESSION_COOKIE);
}

export function setSessionCookie(c: Context<AppHono>, token: string, expiresAt: number) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: Math.floor((expiresAt - c.get('deps').clock.now()) / 1000),
  });
}

export function clearSessionCookie(c: Context<AppHono>) {
  deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true });
}

export function revokeSessionStatement(db: D1Database, sessionId: string, now: number) {
  return db
    .prepare('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL')
    .bind(now, sessionId);
}

export function revokeAllSessionsStatement(db: D1Database, accountId: string, now: number) {
  return db
    .prepare('UPDATE sessions SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL')
    .bind(now, accountId);
}
