import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import type { AdminInvitation, AdminInvitationResponse } from '@wous/contracts';
import { expect } from 'vitest';
import { createApp } from '../src/app.ts';
import { call, ORIGIN, postJson } from './helpers.ts';
import { freshIp, PASSWORD, TURNSTILE_OK, withIp } from './support.ts';

/** Da el rol de la caseta como lo haría el script de moderación: directo en D1. */
export async function makeStaff(accountId: string): Promise<void> {
  await env.DB.prepare(`INSERT INTO staff (account_id, role, granted_at) VALUES (?, 'ADMIN', ?)`)
    .bind(accountId, Date.now())
    .run();
}

export function adminGet(path: string, cookie: string): Promise<Response> {
  return call(`/api/v1/admin${path}`, { headers: { Cookie: cookie } });
}

export function adminPost(path: string, cookie: string, body: unknown): Promise<Response> {
  return postJson(`/api/v1/admin${path}`, body, { headers: { Cookie: cookie } });
}

export async function data<T>(res: Response): Promise<T> {
  return ((await res.json()) as { data: T }).data;
}

export async function errorCode(res: Response): Promise<string> {
  return ((await res.json()) as { error: { code: string } }).error.code;
}

export function login(loginId: string, password = PASSWORD, ip = freshIp()): Promise<Response> {
  return postJson(
    '/api/v1/auth/login',
    { login: loginId, password, turnstileToken: TURNSTILE_OK },
    withIp(ip),
  );
}

/** Una invitación nueva desde la caseta; devuelve su vista (con el código). */
export async function newInvitation(
  cookie: string,
  input: { label?: string; maxUses?: number; expiresInDays?: number } = {},
): Promise<AdminInvitation> {
  const res = await adminPost('/invitations', cookie, {
    label: input.label ?? 'Pruebas',
    maxUses: input.maxUses ?? 1,
    expiresInDays: input.expiresInDays ?? 7,
  });
  expect(res.status).toBe(201);
  return (await data<AdminInvitationResponse>(res)).invitation;
}

let userCounter = 0;
export function inviteIdentity() {
  userCounter += 1;
  const tag = `${Date.now().toString(36)}i${userCounter}`;
  return { email: `invitada.${tag}@example.com`, username: `inv_${tag}`.slice(0, 20) };
}

/**
 * Registro contra un Worker en modo alpha cerrada (`REGISTRATION_MODE=invite`,
 * como staging y producción). Mismas D1 y Durable Objects que el resto.
 */
export async function registerWithInvite(
  body: Record<string, unknown>,
  ip = freshIp(),
): Promise<Response> {
  const identity = inviteIdentity();
  const ctx = createExecutionContext();
  const res = await createApp().fetch(
    new Request('http://localhost/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'CF-Connecting-IP': ip },
      body: JSON.stringify({
        email: identity.email,
        username: identity.username,
        password: PASSWORD,
        turnstileToken: TURNSTILE_OK,
        termsVersion: '2026-01',
        ...body,
      }),
    }),
    { ...env, REGISTRATION_MODE: 'invite' },
    ctx,
  );
  await waitOnExecutionContext(ctx);
  return res;
}

/** Un reporte como lo deja la sala al reportar (ADR-0010), con su evidencia. */
export async function insertReport(report: {
  id: string;
  reporterAccountId: string;
  reporterCharacterId: string;
  targetAccountId: string;
  targetCharacterId: string;
  targetName: string;
  text: string;
  createdAt?: number;
}): Promise<void> {
  const at = report.createdAt ?? Date.now();
  const message = {
    id: 'msg_01J8ZQ4Y7V3M2N6P8R0S1T2V3W',
    from: report.targetCharacterId,
    name: report.targetName,
    text: report.text,
    at: at - 1000,
  };
  const evidence = {
    v: 1,
    capturedAt: at,
    target: {
      characterId: report.targetCharacterId,
      displayName: report.targetName,
      appearance: null,
    },
    message,
    targetMessages: [],
    context: [
      { ...message, id: 'msg_01J8ZQ4Y7V3M2N6P8R0S1T2V3X', text: 'hola a todos', at: at - 5000 },
    ],
  };
  await env.DB.prepare(
    `INSERT INTO reports (id, reporter_account_id, reporter_character_id, target_account_id,
       target_character_id, reason, note, message_id, room, evidence_json, created_at)
     VALUES (?, ?, ?, ?, ?, 'HARASSMENT', NULL, ?, 'plaza:01', ?, ?)`,
  )
    .bind(
      report.id,
      report.reporterAccountId,
      report.reporterCharacterId,
      report.targetAccountId,
      report.targetCharacterId,
      message.id,
      JSON.stringify(evidence),
      at,
    )
    .run();
}

export async function auditRows(targetId: string, action: string) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM audit_log WHERE target_id = ? AND action = ? ORDER BY created_at',
  )
    .bind(targetId, action)
    .all<{
      actor_account_id: string | null;
      reason: string | null;
      metadata_json: string | null;
    }>();
  return results;
}
