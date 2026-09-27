import { env } from 'cloudflare:workers';
import {
  type AdminInvitationListResponse,
  type AdminInvitationResponse,
  type ClientConfig,
  normalizeInvitationCode,
} from '@wous/contracts';
import { describe, expect, it } from 'vitest';
import {
  adminGet,
  adminPost,
  auditRows,
  data,
  errorCode,
  inviteIdentity,
  makeStaff,
  newInvitation,
  registerWithInvite,
} from './admin-support.ts';
import { call } from './helpers.ts';
import { createVerifiedUser, register } from './support.ts';

const PESADA = 40_000;

async function admin() {
  const user = await createVerifiedUser();
  await makeStaff(user.accountId);
  return user;
}

async function uses(invitationId: string): Promise<number> {
  const row = await env.DB.prepare('SELECT uses FROM invitations WHERE id = ?')
    .bind(invitationId)
    .first<{ uses: number }>();
  return row?.uses ?? -1;
}

describe('invitaciones en la caseta', () => {
  it(
    'se crean, se listan con su código y se revocan; en D1 el código nunca está en claro',
    async () => {
      const staff = await admin();
      const invitacion = await newInvitation(staff.cookie, {
        label: 'Primos del norte',
        maxUses: 3,
        expiresInDays: 10,
      });
      expect(invitacion).toMatchObject({
        label: 'Primos del norte',
        maxUses: 3,
        uses: 0,
        status: 'ACTIVE',
        accounts: 0,
        createdBy: `@${staff.username}`,
      });
      expect(invitacion.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/);
      expect(invitacion.expiresAt).toBeGreaterThan(Date.now() + 9 * 24 * 3600_000);

      const fila = await env.DB.prepare('SELECT * FROM invitations WHERE id = ?')
        .bind(invitacion.id)
        .first<Record<string, string>>();
      const canonico = normalizeInvitationCode(invitacion.code ?? '') ?? '';
      expect(JSON.stringify(fila)).not.toContain(canonico);

      const lista = await data<AdminInvitationListResponse>(
        await adminGet('/invitations', staff.cookie),
      );
      expect(lista.invitations.find((i) => i.id === invitacion.id)?.code).toBe(invitacion.code);

      const revocada = await data<AdminInvitationResponse>(
        await adminPost(`/invitations/${invitacion.id}/revoke`, staff.cookie, {
          reason: 'Se compartió en un grupo público',
        }),
      );
      expect(revocada.invitation.status).toBe('REVOKED');
      // Repetir no deja otra fila en la bitácora.
      await adminPost(`/invitations/${invitacion.id}/revoke`, staff.cookie, { reason: 'otra vez' });
      expect(await auditRows(invitacion.id, 'INVITATION_REVOKED')).toHaveLength(1);
      expect(await auditRows(invitacion.id, 'INVITATION_CREATED')).toHaveLength(1);
    },
    PESADA,
  );

  it(
    'valida nombre, usos y vencimiento',
    async () => {
      const staff = await admin();
      const crear = (body: unknown) => adminPost('/invitations', staff.cookie, body);
      expect((await crear({ label: 'x', maxUses: 1, expiresInDays: 7 })).status).toBe(400);
      expect((await crear({ label: 'Grupo', maxUses: 0, expiresInDays: 7 })).status).toBe(400);
      expect((await crear({ label: 'Grupo', maxUses: 51, expiresInDays: 7 })).status).toBe(400);
      expect((await crear({ label: 'Grupo', maxUses: 5, expiresInDays: 91 })).status).toBe(400);
      expect((await crear({ label: 'Grupo', maxUses: 5 })).status).toBe(400);
      expect((await crear({ label: 'Grupo', maxUses: 5, expiresInDays: 7 })).status).toBe(201);
    },
    PESADA,
  );
});

describe('registro en la alpha cerrada', () => {
  it('la configuración pública dice cómo se registra uno', async () => {
    const res = await call('/api/v1/config');
    expect((await data<ClientConfig>(res)).registration).toBe('open');
  });

  it(
    'sin invitación no hay cuenta; con una válida, sí, y queda anotada con cuál entró',
    async () => {
      const staff = await admin();
      const invitacion = await newInvitation(staff.cookie, { maxUses: 2 });

      const sinCodigo = await registerWithInvite({});
      expect(sinCodigo.status).toBe(400);
      expect(await errorCode(sinCodigo)).toBe('INVITATION_INVALID');

      const inventado = await registerWithInvite({ invitationCode: '00000-00000' });
      expect(await errorCode(inventado)).toBe('INVITATION_INVALID');
      const malFormado = await registerWithInvite({ invitationCode: 'hola' });
      expect(malFormado.status).toBe(400);
      expect(await errorCode(malFormado)).toBe('INVALID_REQUEST');

      const identidad = inviteIdentity();
      const ok = await registerWithInvite({ ...identidad, invitationCode: invitacion.code });
      expect(ok.status).toBe(202);
      const cuenta = await env.DB.prepare(
        'SELECT id, status, invitation_id FROM accounts WHERE email_normalized = ?',
      )
        .bind(identidad.email)
        .first<{ id: string; status: string; invitation_id: string }>();
      expect(cuenta).toMatchObject({ status: 'PENDING_EMAIL', invitation_id: invitacion.id });
      expect(await uses(invitacion.id)).toBe(1);

      const lista = await data<AdminInvitationListResponse>(
        await adminGet('/invitations', staff.cookie),
      );
      expect(lista.invitations.find((i) => i.id === invitacion.id)).toMatchObject({
        uses: 1,
        accounts: 1,
      });
    },
    PESADA,
  );

  it(
    'lee el código con tolerancia: minúsculas, espacios, sin guion y letras que se confunden',
    async () => {
      const staff = await admin();
      const invitacion = await newInvitation(staff.cookie, { maxUses: 1 });
      const code = normalizeInvitationCode(invitacion.code ?? '') ?? '';
      // «0» y «1» dictados como «o» e «i»; en minúsculas y con espacios.
      const dictado = `  ${code.slice(0, 5).toLowerCase().replace(/0/g, 'o').replace(/1/g, 'i')} ${code
        .slice(5)
        .toLowerCase()}  `;
      const res = await registerWithInvite({ invitationCode: dictado });
      expect(res.status).toBe(202);
      expect(await uses(invitacion.id)).toBe(1);
    },
    PESADA,
  );

  it(
    'agotada, vencida o revocada: el mismo error, sin decir cuál',
    async () => {
      const staff = await admin();
      const agotada = await newInvitation(staff.cookie, { maxUses: 1 });
      expect((await registerWithInvite({ invitationCode: agotada.code })).status).toBe(202);
      const vencida = await newInvitation(staff.cookie, { maxUses: 5 });
      await env.DB.prepare('UPDATE invitations SET expires_at = ? WHERE id = ?')
        .bind(Date.now() - 1000, vencida.id)
        .run();
      const revocada = await newInvitation(staff.cookie, { maxUses: 5 });
      await adminPost(`/invitations/${revocada.id}/revoke`, staff.cookie, { reason: 'ya no' });

      const mensajes = new Set<string>();
      for (const code of [agotada.code, vencida.code, revocada.code]) {
        const res = await registerWithInvite({ invitationCode: code });
        expect(res.status).toBe(400);
        const body = (await res.json()) as { error: { code: string; message: string } };
        expect(body.error.code).toBe('INVITATION_INVALID');
        mensajes.add(body.error.message);
      }
      expect(mensajes.size).toBe(1);
      expect(await uses(vencida.id)).toBe(0);
      expect(await uses(revocada.id)).toBe(0);
    },
    PESADA,
  );

  it(
    'un correo ya registrado gasta el cupo y responde igual: la invitación no delata cuentas',
    async () => {
      const staff = await admin();
      const existente = await createVerifiedUser();
      const invitacion = await newInvitation(staff.cookie, { maxUses: 1 });
      const res = await registerWithInvite({
        email: existente.email,
        invitationCode: invitacion.code,
      });
      expect(res.status).toBe(202);
      expect(await uses(invitacion.id)).toBe(1);
      const cuentas = await env.DB.prepare(
        'SELECT COUNT(*) AS n FROM accounts WHERE email_normalized = ?',
      )
        .bind(existente.email)
        .first<{ n: number }>();
      expect(cuentas?.n).toBe(1);
    },
    PESADA,
  );

  it(
    'dos registros con el último cupo: solo pasa uno',
    async () => {
      const staff = await admin();
      const invitacion = await newInvitation(staff.cookie, { maxUses: 1 });
      const [a, b] = await Promise.all([
        registerWithInvite({ invitationCode: invitacion.code }),
        registerWithInvite({ invitationCode: invitacion.code }),
      ]);
      expect([a.status, b.status].sort()).toEqual([202, 400]);
      expect(await uses(invitacion.id)).toBe(1);
    },
    PESADA,
  );

  it(
    'un nombre ocupado no gasta la invitación',
    async () => {
      const staff = await admin();
      const invitacion = await newInvitation(staff.cookie, { maxUses: 2 });
      const res = await registerWithInvite({
        username: staff.username,
        invitationCode: invitacion.code,
      });
      expect(res.status).toBe(409);
      expect(await errorCode(res)).toBe('USERNAME_TAKEN');
      expect(await uses(invitacion.id)).toBe(0);
    },
    PESADA,
  );

  it('con registro abierto (local) el código se ignora', async () => {
    const res = await register({ invitationCode: '00000-00000' } as never);
    expect(res.status).toBe(202);
  });
});
