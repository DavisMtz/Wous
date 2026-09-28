import { RATE_LIMITS } from '@wous/config';
import {
  AccountId,
  type AdminAccountSearchResponse,
  type AdminInvitationListResponse,
  type AdminInvitationResponse,
  AdminReportFilter,
  type AdminReportListResponse,
  CreateInvitationRequest,
  DismissReportRequest,
  InvitationId,
  ReportId,
  RevokeInvitationRequest,
  SanctionRequest,
  type SanctionResponse,
} from '@wous/contracts';
import type { Context } from 'hono';
import { Hono } from 'hono';
import type { z } from 'zod';
import { type Actor, accountDetail, sanction, searchAccounts } from '../../admin/accounts.ts';
import { dismissReport, listReports, reportDetail } from '../../admin/reports.ts';
import { adminSummary } from '../../admin/summary.ts';
import { useCaseContext } from '../../auth/use-case.ts';
import {
  createInvitation,
  listInvitations,
  revokeInvitation,
} from '../../invitations/invitations.ts';
import { enforceRateLimit, identityRateKey } from '../../security/rate-limit.ts';
import { Errors } from '../errors.ts';
import { readJson } from '../json.ts';
import { loadSession, requireStaff } from '../middleware/session.ts';
import { ok } from '../respond.ts';
import type { AppHono } from '../types.ts';

/**
 * La caseta (Fase 9, ADR-0012). Todo exige rol en `staff`; para cualquier otra
 * persona estas rutas no existen (404). Lo que cambia algo lleva motivo,
 * límite por persona y fila en la bitácora.
 */

function actorOf(c: Context<AppHono>): Actor {
  const session = requireStaff(c);
  return { accountId: session.account.id, username: session.account.username };
}

async function limitAction(c: Context<AppHono>, actor: Actor): Promise<void> {
  await enforceRateLimit(
    c.get('deps').rateLimiter,
    await identityRateKey(c.env, 'admin', actor.accountId),
    RATE_LIMITS.adminActionsPerAccount,
  );
}

/** Un ID de la ruta. Mal formado es lo mismo que inexistente. */
function idParam<T>(c: Context<AppHono>, name: string, schema: z.ZodType<T>): T {
  const parsed = schema.safeParse(c.req.param(name));
  if (!parsed.success) throw Errors.notFound();
  return parsed.data;
}

export const adminRoutes = new Hono<AppHono>()
  .use('*', loadSession)
  .use('*', async (c, next) => {
    requireStaff(c);
    await next();
  })

  .get('/summary', async (c) =>
    ok(c, await adminSummary(c.env, c.get('config'), c.get('deps').clock.now(), c.get('log'))),
  )

  .get('/reports', async (c) => {
    const filter = AdminReportFilter.safeParse(c.req.query('status') ?? 'open');
    if (!filter.success) throw Errors.invalidRequest({ status: 'Usa open o all.' });
    const body: AdminReportListResponse = { reports: await listReports(c.env.DB, filter.data) };
    return ok(c, body);
  })

  .get('/reports/:reportId', async (c) => {
    const detail = await reportDetail(c.env.DB, idParam(c, 'reportId', ReportId));
    if (!detail) throw Errors.notFound();
    return ok(c, detail);
  })

  .post('/reports/:reportId/dismiss', async (c) => {
    const actor = actorOf(c);
    const id = idParam(c, 'reportId', ReportId);
    const { reason } = await readJson(c, DismissReportRequest);
    await limitAction(c, actor);
    const dismissed = await dismissReport(c.env, c.get('deps'), actor, id, reason);
    const detail = await reportDetail(c.env.DB, id);
    if (!detail) throw Errors.notFound();
    if (dismissed) {
      c.get('log').info('admin.report_dismissed', { actorId: actor.accountId, reportId: id });
    }
    return ok(c, detail);
  })

  .get('/accounts', async (c) => {
    const body: AdminAccountSearchResponse = {
      results: await searchAccounts(c.env.DB, c.req.query('q') ?? ''),
    };
    return ok(c, body);
  })

  .get('/accounts/:accountId', async (c) => {
    const detail = await accountDetail(
      c.env.DB,
      idParam(c, 'accountId', AccountId),
      c.get('deps').clock.now(),
    );
    if (!detail) throw Errors.notFound();
    return ok(c, detail);
  })

  .post('/accounts/:accountId/sanction', async (c) => {
    const actor = actorOf(c);
    const accountId = idParam(c, 'accountId', AccountId);
    const input = await readJson(c, SanctionRequest);
    await limitAction(c, actor);
    const result = await sanction(useCaseContext(c), actor, accountId, input);
    if (!result) throw Errors.notFound();
    const account = await accountDetail(c.env.DB, accountId, c.get('deps').clock.now());
    if (!account) throw Errors.notFound();
    const body: SanctionResponse = { account, changed: result.changed };
    return ok(c, body);
  })

  .get('/invitations', async (c) => {
    const body: AdminInvitationListResponse = {
      invitations: await listInvitations(c.env, c.get('deps').clock.now()),
    };
    return ok(c, body);
  })

  .post('/invitations', async (c) => {
    const actor = actorOf(c);
    const input = await readJson(c, CreateInvitationRequest);
    await limitAction(c, actor);
    const invitation = await createInvitation(c.env, c.get('deps'), actor.accountId, input);
    c.get('log').info('admin.invitation_created', {
      actorId: actor.accountId,
      invitationId: invitation.id,
      maxUses: invitation.maxUses,
    });
    const body: AdminInvitationResponse = { invitation };
    return ok(c, body, 201);
  })

  .post('/invitations/:invitationId/revoke', async (c) => {
    const actor = actorOf(c);
    const id = idParam(c, 'invitationId', InvitationId);
    const { reason } = await readJson(c, RevokeInvitationRequest);
    await limitAction(c, actor);
    const result = await revokeInvitation(c.env, c.get('deps'), actor.accountId, id, reason);
    if (!result) throw Errors.notFound();
    if (result.changed) {
      c.get('log').info('admin.invitation_revoked', { actorId: actor.accountId, invitationId: id });
    }
    const body: AdminInvitationResponse = { invitation: result.invitation };
    return ok(c, body);
  });
