import { env } from 'cloudflare:workers';
import {
  type AdminAccountDetail,
  type AdminAccountSearchResponse,
  type AdminReportDetail,
  type AdminReportListResponse,
  type AdminSummary,
  type SanctionResponse,
  type SessionResponse,
  WS_CLOSE,
} from '@wous/contracts';
import { describe, expect, it } from 'vitest';
import { liftExpiredSuspensions } from '../src/accounts/suspensions.ts';
import { systemClock } from '../src/lib/clock.ts';
import { createIdGenerator } from '../src/lib/ids.ts';
import { createLogger } from '../src/lib/log.ts';
import {
  adminGet,
  adminPost,
  auditRows,
  data,
  errorCode,
  insertReport,
  login,
  makeStaff,
} from './admin-support.ts';
import { call, postJson } from './helpers.ts';
import { createVerifiedUser, currentSession } from './support.ts';
import { connect, playerWithCharacter } from './world-support.ts';

/** Varias cuentas con Argon2 real: en un equipo cargado tarda más que el tope de 5 s. */
const PESADA = 40_000;

async function staffMember(name: string) {
  const person = await playerWithCharacter(name);
  await makeStaff(person.accountId);
  return person;
}

const chat = (text: string) => ({ v: 1, type: 'CHAT_SEND', payload: { text } });

let reportCounter = 0;
function reportId(): string {
  reportCounter += 1;
  return `rpt_01J8ZQ4Y7V3M2N6P8R0S1T${String(reportCounter).padStart(4, '0')}`;
}

describe('la caseta', () => {
  it(
    'no existe para nadie más: 404 sin sesión, con sesión de jugador o con un ID mal formado',
    async () => {
      const jugador = await playerWithCharacter('Nadia Jugadora');
      const admin = await staffMember('Ana Caseta');

      const anonima = await call('/api/v1/admin/summary');
      expect(anonima.status).toBe(404);
      expect(await errorCode(anonima)).toBe('NOT_FOUND');

      const deJugador = await adminGet('/summary', jugador.cookie);
      expect(deJugador.status).toBe(404);
      const sancionDeJugador = await adminPost(
        `/accounts/${admin.accountId}/sanction`,
        jugador.cookie,
        { action: 'BAN', reason: 'intento de subir privilegios' },
      );
      expect(sancionDeJugador.status).toBe(404);

      expect((await adminGet('/summary', admin.cookie)).status).toBe(200);
      expect((await adminGet('/accounts/acc_no-es-un-id', admin.cookie)).status).toBe(404);
      expect((await adminGet('/ruta-que-no-existe', admin.cookie)).status).toBe(404);
    },
    PESADA,
  );

  it(
    '/auth/session dice quién atiende la caseta (y nadie puede dárselo desde la web)',
    async () => {
      const jugador = await createVerifiedUser();
      const admin = await createVerifiedUser();
      await makeStaff(admin.accountId);
      expect((await currentSession(jugador.cookie)).body.data?.staffRole).toBeNull();
      expect((await currentSession(admin.cookie)).body.data?.staffRole).toBe('ADMIN');

      // El login también lo trae.
      const res = await login(admin.email);
      expect(res.status).toBe(200);
      expect((await data<SessionResponse>(res)).staffRole).toBe('ADMIN');
    },
    PESADA,
  );

  it(
    'el tablero cuenta cuentas, moderación y a la gente conectada',
    async () => {
      const admin = await staffMember('Bea Tablero');
      const paseante = await playerWithCharacter('Pepe Paseante');
      const socket = (await connect(paseante.cookie)).socket;
      if (!socket) throw new Error('no entró');
      await socket.next('ROOM_SNAPSHOT');

      const summary = await data<AdminSummary>(await adminGet('/summary', admin.cookie));
      expect(summary.environment).toBe('local');
      expect(summary.registration).toBe('open');
      expect(summary.accounts.total).toBeGreaterThanOrEqual(2);
      expect(summary.accounts.active).toBeGreaterThanOrEqual(2);
      expect(summary.accounts.newLast24h).toBeGreaterThanOrEqual(2);
      expect(summary.activity.sessionsActive).toBeGreaterThanOrEqual(2);
      expect(summary.population.total).toBeGreaterThanOrEqual(1);
      expect(summary.population.rooms.some((r) => r.mapId === 'plaza' && r.count > 0)).toBe(true);
      expect(summary.population.rooms[0]?.name).toBe('La Plaza');
      socket.close();
    },
    PESADA,
  );

  it(
    'busca por @usuario, nombre del personaje, correo e IDs',
    async () => {
      const admin = await staffMember('Caro Buscadora');
      const buscada = await playerWithCharacter('Zulema Única');

      const buscar = async (q: string) =>
        (
          await data<AdminAccountSearchResponse>(
            await adminGet(`/accounts?q=${encodeURIComponent(q)}`, admin.cookie),
          )
        ).results.map((p) => p.accountId);

      expect(await buscar(`@${buscada.username.slice(0, 12)}`)).toContain(buscada.accountId);
      expect(await buscar('zulema')).toContain(buscada.accountId);
      expect(await buscar(buscada.email.toUpperCase())).toEqual([buscada.accountId]);
      expect(await buscar(buscada.characterId)).toEqual([buscada.accountId]);
      expect(await buscar(buscada.accountId)).toEqual([buscada.accountId]);
      // Muy corto o comodines de LIKE: nada.
      expect(await buscar('z')).toEqual([]);
      expect(await buscar('%%')).toEqual([]);
    },
    PESADA,
  );
});

describe('buscar en la caseta', () => {
  it(
    'un texto largo o con comodines no truena (D1 no acepta LIKE de más de 50 bytes)',
    async () => {
      const admin = await staffMember('Sol Busca');
      const persona = await playerWithCharacter('Tadeo Porciento');
      const largo = `pegué una oración completa en la búsqueda ${'y sigue '.repeat(6)}`;
      const res = await adminGet(`/accounts?q=${encodeURIComponent(largo)}`, admin.cookie);
      expect(res.status).toBe(200);
      expect((await data<AdminAccountSearchResponse>(res)).results).toEqual([]);
      const comodin = await data<AdminAccountSearchResponse>(
        await adminGet(`/accounts?q=${encodeURIComponent('%_')}`, admin.cookie),
      );
      expect(comodin.results).toEqual([]);
      const parte = await data<AdminAccountSearchResponse>(
        await adminGet(`/accounts?q=${encodeURIComponent('porCIEN')}`, admin.cookie),
      );
      expect(parte.results.map((r) => r.accountId)).toContain(persona.accountId);
    },
    PESADA,
  );
});

describe('reportes en la caseta', () => {
  it(
    'lista, muestra la evidencia de la sala y se descarta con motivo (una sola vez en la bitácora)',
    async () => {
      const admin = await staffMember('Dora Revisa');
      const reporta = await playerWithCharacter('Eli Reporta');
      const reportado = await playerWithCharacter('Fede Grosero');
      const id = reportId();
      await insertReport({
        id,
        reporterAccountId: reporta.accountId,
        reporterCharacterId: reporta.characterId,
        targetAccountId: reportado.accountId,
        targetCharacterId: reportado.characterId,
        targetName: reportado.displayName,
        text: 'eres un tonto',
      });

      const abiertos = await data<AdminReportListResponse>(
        await adminGet('/reports', admin.cookie),
      );
      const fila = abiertos.reports.find((r) => r.id === id);
      expect(fila).toMatchObject({
        status: 'OPEN',
        reason: 'HARASSMENT',
        messageText: 'eres un tonto',
        openAgainstTarget: 1,
        target: { accountId: reportado.accountId, displayName: 'Fede Grosero' },
        reporter: { accountId: reporta.accountId, displayName: 'Eli Reporta' },
      });
      expect(fila?.target.appearance?.body).toBe('a');

      const detalle = await data<AdminReportDetail>(await adminGet(`/reports/${id}`, admin.cookie));
      expect(detalle.evidence.message?.text).toBe('eres un tonto');
      expect(detalle.evidence.context.map((l) => l.text)).toEqual(['hola a todos']);
      expect(detalle.evidence.messageExpired).toBe(false);

      const sinMotivo = await adminPost(`/reports/${id}/dismiss`, admin.cookie, { reason: ' ' });
      expect(sinMotivo.status).toBe(400);

      const descartado = await data<AdminReportDetail>(
        await adminPost(`/reports/${id}/dismiss`, admin.cookie, { reason: 'Fue una broma' }),
      );
      expect(descartado.status).toBe('DISMISSED');
      expect(descartado.resolution).toBe(`Descartado · @${admin.username}`);
      // Repetirlo responde igual y no deja otra fila.
      expect(
        (await adminPost(`/reports/${id}/dismiss`, admin.cookie, { reason: 'Otra vez' })).status,
      ).toBe(200);
      const bitacora = await auditRows(id, 'REPORT_DISMISSED');
      expect(bitacora).toHaveLength(1);
      expect(bitacora[0]).toMatchObject({
        actor_account_id: admin.accountId,
        reason: 'Fue una broma',
      });

      const soloAbiertos = await data<AdminReportListResponse>(
        await adminGet('/reports?status=open', admin.cookie),
      );
      expect(soloAbiertos.reports.some((r) => r.id === id)).toBe(false);
      const todos = await data<AdminReportListResponse>(
        await adminGet('/reports?status=all', admin.cookie),
      );
      expect(todos.reports.some((r) => r.id === id)).toBe(true);
      expect((await adminGet('/reports?status=raro', admin.cookie)).status).toBe(400);
    },
    PESADA,
  );
});

describe('sanciones desde la caseta', () => {
  it(
    'silenciar aplica en la sala en el acto y queda en la bitácora con quien lo hizo',
    async () => {
      const admin = await staffMember('Gil Silencia');
      const ruidoso = await playerWithCharacter('Hugo Ruidoso');
      const socket = (await connect(ruidoso.cookie)).socket;
      if (!socket) throw new Error('no entró');
      await socket.next('ROOM_SNAPSHOT');
      socket.send(chat('antes'));
      await socket.next('CHAT_MESSAGE');

      const res = await adminPost(`/accounts/${ruidoso.accountId}/sanction`, admin.cookie, {
        action: 'MUTE',
        hours: 2,
        reason: 'Flood en la plaza',
      });
      expect(res.status).toBe(200);
      const { account, changed } = await data<SanctionResponse>(res);
      expect(changed).toBe(true);
      expect(account.chatMutedUntil).toBeGreaterThan(Date.now() + 119 * 60_000);
      expect(account.audit[0]).toMatchObject({
        action: 'CHAT_MUTED',
        reason: 'Flood en la plaza',
        actor: `@${admin.username}`,
      });

      // Sin esperar la revisión del minuto: la sala ya lo sabe.
      socket.send(chat('después'));
      const error = await socket.next('ERROR');
      expect(error.payload.code).toBe('CHAT_MUTED');

      const quitar = await data<SanctionResponse>(
        await adminPost(`/accounts/${ruidoso.accountId}/sanction`, admin.cookie, {
          action: 'UNMUTE',
          reason: 'Ya se calmó',
        }),
      );
      expect(quitar.changed).toBe(true);
      expect(quitar.account.chatMutedUntil).toBeNull();
      socket.send(chat('ya puedo'));
      await socket.next('CHAT_MESSAGE', (m) => m.payload.message.text === 'ya puedo');
      // Quitar un silencio que no hay no cambia nada.
      const otraVez = await data<SanctionResponse>(
        await adminPost(`/accounts/${ruidoso.accountId}/sanction`, admin.cookie, {
          action: 'UNMUTE',
          reason: 'por si acaso',
        }),
      );
      expect(otraVez.changed).toBe(false);
      expect(await auditRows(ruidoso.accountId, 'CHAT_UNMUTED')).toHaveLength(1);
      socket.close();
    },
    PESADA,
  );

  it(
    'silenciar nunca acorta un silencio más largo; atender reportes deja una fila por reporte',
    async () => {
      const admin = await staffMember('Ulises Largo');
      const persona = await playerWithCharacter('Vero Reincide');
      const reporta = await playerWithCharacter('Wendy Avisa');
      const semana = await data<SanctionResponse>(
        await adminPost(`/accounts/${persona.accountId}/sanction`, admin.cookie, {
          action: 'MUTE',
          hours: 168,
          reason: 'Insultos',
        }),
      );
      const hasta = semana.account.chatMutedUntil ?? 0;
      expect(hasta).toBeGreaterThan(Date.now() + 167 * 3600_000);

      const reportes = [reportId(), reportId(), reportId()];
      for (const id of reportes) {
        await insertReport({
          id,
          reporterAccountId: reporta.accountId,
          reporterCharacterId: reporta.characterId,
          targetAccountId: persona.accountId,
          targetCharacterId: persona.characterId,
          targetName: persona.displayName,
          text: 'otra vez',
        });
      }
      const detalle = await data<AdminReportDetail>(
        await adminGet(`/reports/${reportes[0]}`, admin.cookie),
      );
      expect(detalle.targetMutedUntil).toBe(hasta);

      // Un día sobre una semana: no cambia el silencio, pero los reportes sí se atienden.
      const dia = await data<SanctionResponse>(
        await adminPost(`/accounts/${persona.accountId}/sanction`, admin.cookie, {
          action: 'MUTE',
          hours: 24,
          reason: 'Reincide',
          reportId: reportes[0],
          closeOpenReports: true,
        }),
      );
      expect(dia.changed).toBe(false);
      expect(dia.account.chatMutedUntil).toBe(hasta);
      expect(await auditRows(persona.accountId, 'CHAT_MUTED')).toHaveLength(1);
      for (const id of reportes) {
        const fila = await auditRows(id, 'REPORT_ACTIONED');
        expect(fila).toHaveLength(1);
        expect(fila[0]).toMatchObject({ actor_account_id: admin.accountId, reason: 'Reincide' });
        const estado = await env.DB.prepare('SELECT status FROM reports WHERE id = ?')
          .bind(id)
          .first<{ status: string }>();
        expect(estado?.status).toBe('ACTIONED');
      }
    },
    PESADA,
  );

  it(
    'suspender con fin saca de la sala en el acto; el login dice cuánto falta; al vencer se levanta sola',
    async () => {
      const admin = await staffMember('Iris Suspende');
      const infractor = await playerWithCharacter('Juan Infractor');
      const socket = (await connect(infractor.cookie)).socket;
      if (!socket) throw new Error('no entró');
      await socket.next('ROOM_SNAPSHOT');

      const res = await adminPost(`/accounts/${infractor.accountId}/sanction`, admin.cookie, {
        action: 'SUSPEND',
        hours: 24,
        reason: 'Acoso repetido',
      });
      const { account } = await data<SanctionResponse>(res);
      expect(account.person.status).toBe('SUSPENDED');
      expect(account.suspendedUntil).toBeGreaterThan(Date.now() + 23 * 3600_000);
      expect(account.sessions.active).toBe(0);

      expect((await socket.next('ERROR')).payload.code).toBe('ACCOUNT_NOT_ACTIVE');
      expect((await socket.closed).code).toBe(WS_CLOSE.SESSION_ENDED);
      expect((await currentSession(infractor.cookie)).status).toBe(401);

      const bloqueado = await login(infractor.email);
      expect(bloqueado.status).toBe(403);
      const body = (await bloqueado.json()) as {
        error: { code: string; retryAfterSeconds?: number };
      };
      expect(body.error.code).toBe('ACCOUNT_SUSPENDED');
      expect(body.error.retryAfterSeconds).toBeGreaterThan(23 * 3600);
      expect(body.error.retryAfterSeconds).toBeLessThanOrEqual(24 * 3600);

      // Pasó el tiempo (el cron todavía no): el login la levanta y deja constancia.
      await env.DB.prepare('UPDATE accounts SET suspended_until = ? WHERE id = ?')
        .bind(Date.now() - 1000, infractor.accountId)
        .run();
      const deVuelta = await login(infractor.email);
      expect(deVuelta.status).toBe(200);
      expect((await data<SessionResponse>(deVuelta)).account.status).toBe('ACTIVE');
      const levantada = await auditRows(infractor.accountId, 'ACCOUNT_REINSTATED');
      expect(levantada).toHaveLength(1);
      expect(JSON.parse(levantada[0]?.metadata_json ?? '{}')).toEqual({ auto: true, via: 'login' });
    },
    PESADA,
  );

  it(
    'el cron levanta solo las suspensiones que ya vencieron, una vez',
    async () => {
      const vencida = await createVerifiedUser();
      const vigente = await createVerifiedUser();
      const indefinida = await createVerifiedUser();
      const now = Date.now();
      const suspender = (id: string, until: number | null) =>
        env.DB.prepare(`UPDATE accounts SET status = 'SUSPENDED', suspended_until = ? WHERE id = ?`)
          .bind(until, id)
          .run();
      await suspender(vencida.accountId, now - 60_000);
      await suspender(vigente.accountId, now + 3600_000);
      await suspender(indefinida.accountId, null);

      const deps = { clock: systemClock, ids: createIdGenerator(systemClock) };
      const log = createLogger({ prueba: true });
      expect(await liftExpiredSuspensions(env, deps, log)).toBe(1);
      expect(await liftExpiredSuspensions(env, deps, log)).toBe(0);

      const estado = async (id: string) =>
        (
          await env.DB.prepare('SELECT status, suspended_until FROM accounts WHERE id = ?')
            .bind(id)
            .first<{ status: string; suspended_until: number | null }>()
        )?.status;
      expect(await estado(vencida.accountId)).toBe('ACTIVE');
      expect(await estado(vigente.accountId)).toBe('SUSPENDED');
      expect(await estado(indefinida.accountId)).toBe('SUSPENDED');
      expect(await auditRows(vencida.accountId, 'ACCOUNT_REINSTATED')).toHaveLength(1);

      // Sin correo confirmado no se levanta sola (ni el cron ni el login): no
      // puede volver a ACTIVE saltándose la verificación.
      const sinCorreo = await createVerifiedUser();
      await env.DB.prepare(
        `UPDATE accounts SET status = 'SUSPENDED', suspended_until = ?, email_verified_at = NULL
          WHERE id = ?`,
      )
        .bind(now - 60_000, sinCorreo.accountId)
        .run();
      expect(await liftExpiredSuspensions(env, deps, log)).toBe(0);
      const intento = await login(sinCorreo.email);
      expect(await errorCode(intento)).toBe('ACCOUNT_SUSPENDED');
      expect(await estado(sinCorreo.accountId)).toBe('SUSPENDED');
    },
    PESADA,
  );

  it(
    'cerrar la cuenta atiende sus reportes; no se reabre desde la caseta y repetir no cambia nada',
    async () => {
      const admin = await staffMember('Kari Cierra');
      const reporta = await playerWithCharacter('Lupe Testigo');
      const troll = await playerWithCharacter('Mario Troll');
      const [uno, dos] = [reportId(), reportId()];
      for (const id of [uno, dos]) {
        await insertReport({
          id,
          reporterAccountId: reporta.accountId,
          reporterCharacterId: reporta.characterId,
          targetAccountId: troll.accountId,
          targetCharacterId: troll.characterId,
          targetName: troll.displayName,
          text: 'spam spam',
        });
      }

      const res = await adminPost(`/accounts/${troll.accountId}/sanction`, admin.cookie, {
        action: 'BAN',
        reason: 'Spam y acoso',
        reportId: uno,
        closeOpenReports: true,
      });
      const cerrada = await data<SanctionResponse>(res);
      expect(cerrada.changed).toBe(true);
      expect(cerrada.account.person.status).toBe('BANNED');
      expect(cerrada.account.reports.openAgainst).toBe(0);
      for (const id of [uno, dos]) {
        const detalle = await data<AdminReportDetail>(
          await adminGet(`/reports/${id}`, admin.cookie),
        );
        expect(detalle.status).toBe('ACTIONED');
        expect(detalle.resolution).toBe(`Cuenta cerrada · @${admin.username}`);
      }

      const reabrir = await adminPost(`/accounts/${troll.accountId}/sanction`, admin.cookie, {
        action: 'REINSTATE',
        reason: 'error',
      });
      expect(reabrir.status).toBe(409);
      expect(await errorCode(reabrir)).toBe('INVALID_STATE');
      const suspenderCerrada = await adminPost(
        `/accounts/${troll.accountId}/sanction`,
        admin.cookie,
        { action: 'SUSPEND', reason: 'error' },
      );
      expect(suspenderCerrada.status).toBe(409);

      const otraVez = await data<SanctionResponse>(
        await adminPost(`/accounts/${troll.accountId}/sanction`, admin.cookie, {
          action: 'BAN',
          reason: 'por si acaso',
        }),
      );
      expect(otraVez.changed).toBe(false);
      expect(await auditRows(troll.accountId, 'ACCOUNT_BANNED')).toHaveLength(1);
      expect((await login(troll.email)).status).toBe(403);

      // Un reporte de otra persona no cierra nada: se rechaza.
      const ajeno = await adminPost(`/accounts/${reporta.accountId}/sanction`, admin.cookie, {
        action: 'MUTE',
        hours: 1,
        reason: 'prueba',
        reportId: uno,
      });
      expect(ajeno.status).toBe(400);
    },
    PESADA,
  );

  it(
    'reactivar una suspensión indefinida y cerrar las sesiones de alguien',
    async () => {
      const admin = await staffMember('Nora Reactiva');
      const persona = await playerWithCharacter('Omar Vuelve');
      await adminPost(`/accounts/${persona.accountId}/sanction`, admin.cookie, {
        action: 'SUSPEND',
        reason: 'Mientras se aclara',
      });
      const suspendida = await data<AdminAccountDetail>(
        await adminGet(`/accounts/${persona.accountId}`, admin.cookie),
      );
      expect(suspendida.person.status).toBe('SUSPENDED');
      expect(suspendida.suspendedUntil).toBeNull();
      const noDice = (await (await login(persona.email)).json()) as {
        error: { code: string; retryAfterSeconds?: number };
      };
      expect(noDice.error).toMatchObject({ code: 'ACCOUNT_SUSPENDED' });
      expect(noDice.error.retryAfterSeconds).toBeUndefined();

      const reactivada = await data<SanctionResponse>(
        await adminPost(`/accounts/${persona.accountId}/sanction`, admin.cookie, {
          action: 'REINSTATE',
          reason: 'Se aclaró',
        }),
      );
      expect(reactivada.account.person.status).toBe('ACTIVE');
      const nueva = await login(persona.email);
      expect(nueva.status).toBe(200);

      const cerrar = await data<SanctionResponse>(
        await adminPost(`/accounts/${persona.accountId}/sanction`, admin.cookie, {
          action: 'END_SESSIONS',
          reason: 'Dice que le robaron la contraseña',
        }),
      );
      expect(cerrar.changed).toBe(true);
      expect(cerrar.account.sessions.active).toBe(0);
      const sinSesiones = await data<SanctionResponse>(
        await adminPost(`/accounts/${persona.accountId}/sanction`, admin.cookie, {
          action: 'END_SESSIONS',
          reason: 'otra vez',
        }),
      );
      expect(sinSesiones.changed).toBe(false);
    },
    PESADA,
  );

  it(
    'no se sanciona a sí mismo ni a otro staff; motivo y horas se validan; exige Origin',
    async () => {
      const admin = await staffMember('Paco Límites');
      const colega = await staffMember('Quique Colega');
      const persona = await playerWithCharacter('Rita Normal');

      const mismo = await adminPost(`/accounts/${admin.accountId}/sanction`, admin.cookie, {
        action: 'BAN',
        reason: 'me equivoqué',
      });
      expect(mismo.status).toBe(403);
      const otroStaff = await adminPost(`/accounts/${colega.accountId}/sanction`, admin.cookie, {
        action: 'MUTE',
        hours: 1,
        reason: 'pleito interno',
      });
      expect(otroStaff.status).toBe(403);

      const sinHoras = await adminPost(`/accounts/${persona.accountId}/sanction`, admin.cookie, {
        action: 'MUTE',
        reason: 'flood',
      });
      expect(sinHoras.status).toBe(400);
      expect(
        ((await sinHoras.json()) as { error: { fields: object } }).error.fields,
      ).toHaveProperty('hours');
      const horasDeMas = await adminPost(`/accounts/${persona.accountId}/sanction`, admin.cookie, {
        action: 'BAN',
        hours: 3,
        reason: 'x y z',
      });
      expect(horasDeMas.status).toBe(400);
      const sinMotivo = await adminPost(`/accounts/${persona.accountId}/sanction`, admin.cookie, {
        action: 'BAN',
      });
      expect(sinMotivo.status).toBe(400);
      const campoColado = await adminPost(`/accounts/${persona.accountId}/sanction`, admin.cookie, {
        action: 'BAN',
        reason: 'motivo',
        actorAccountId: persona.accountId,
      });
      expect(campoColado.status).toBe(400);

      const ajeno = await postJson(
        `/api/v1/admin/accounts/${persona.accountId}/sanction`,
        { action: 'BAN', reason: 'desde otro sitio' },
        { headers: { Cookie: admin.cookie, Origin: 'https://evil.example' } },
      );
      expect(ajeno.status).toBe(403);
      const intacta = await data<AdminAccountDetail>(
        await adminGet(`/accounts/${persona.accountId}`, admin.cookie),
      );
      expect(intacta.person.status).toBe('ACTIVE');
      expect(intacta.audit.some((a) => a.action === 'ACCOUNT_BANNED')).toBe(false);
    },
    PESADA,
  );
});
