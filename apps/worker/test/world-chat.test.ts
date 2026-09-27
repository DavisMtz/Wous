import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { CHAT, EMOTE } from '@wous/config';
import { type ServerMessage, WS_CLOSE } from '@wous/contracts';
import { describe, expect, it } from 'vitest';
import { RoomDO } from '../src/durable-objects/RoomDO.ts';
import type { ChatRecord } from '../src/world/chat.ts';
import { call } from './helpers.ts';
import {
  connect,
  directory,
  joinRoomDirectly,
  playerWithCharacter,
  sleep,
  type TestSocket,
} from './world-support.ts';

/** Tres cuentas con Argon2 real: en un equipo cargado tarda más que el tope de 5 s. */
const PESADA = 30_000;

const chat = (text: string) => ({ v: 1, type: 'CHAT_SEND', payload: { text } });
const emote = (e: string) => ({ v: 1, type: 'EMOTE_PLAY', payload: { emote: e } });
const block = (characterId: string) => ({
  v: 1,
  type: 'BLOCK_PLAYER',
  payload: { characterId },
});
const unblock = (characterId: string) => ({
  v: 1,
  type: 'UNBLOCK_PLAYER',
  payload: { characterId },
});
const report = (payload: Record<string, unknown>) => ({ v: 1, type: 'REPORT_PLAYER', payload });

type Player = Awaited<ReturnType<typeof playerWithCharacter>>;

/** Entra directo a una sala de prueba con la identidad REAL de una cuenta (D1 la conoce). */
async function joinAs(room: string, p: Player) {
  const joined = await joinRoomDirectly(room, {
    characterId: p.characterId,
    accountId: p.accountId,
    displayName: p.displayName,
    hardLimit: 8,
  });
  await joined.socket.next('ROOM_SNAPSHOT');
  return joined;
}

/** ¿Le llegó un mensaje de chat con ese ID? (se revisa después de que le llegó a un testigo). */
function heardChat(socket: TestSocket, id: string): boolean {
  return socket.received.some((m) => m.type === 'CHAT_MESSAGE' && m.payload.message.id === id);
}

function heard(socket: TestSocket, type: ServerMessage['type']): boolean {
  return socket.received.some((m) => m.type === type);
}

async function roomOf(characterId: string) {
  const state = await directory('plaza').occupancy();
  const instance = state.presence[characterId];
  if (!instance) throw new Error('sin instancia');
  return env.ROOM.get(env.ROOM.idFromName(`room:plaza:${instance}`));
}

describe('chat de sala (§18)', () => {
  it(
    'se reparte saneado a todos con el nombre de quien habla; el HTML viaja como texto',
    async () => {
      const ana = await playerWithCharacter('Ana Chat');
      const beto = await playerWithCharacter('Beto Chat');
      const a = (await connect(ana.cookie)).socket;
      const b = (await connect(beto.cookie)).socket;
      if (!a || !b) throw new Error('no entraron');
      await a.next('ROOM_SNAPSHOT');
      await b.next('ROOM_SNAPSHOT');

      a.send(chat('  hola‮   <img src=x onerror=alert(1)><script>alert(2)</script>  '));
      const oido = await b.next('CHAT_MESSAGE');
      expect(oido.payload.message).toMatchObject({
        from: ana.characterId,
        name: 'Ana Chat',
        text: 'hola <img src=x onerror=alert(1)><script>alert(2)</script>',
      });
      expect(oido.payload.message.id).toMatch(/^msg_/);
      // Quien habla recibe su propio mensaje: es la confirmación.
      const eco = await a.next('CHAT_MESSAGE');
      expect(eco.payload.message.id).toBe(oido.payload.message.id);
      // Lo que viaja no trae la cuenta.
      expect(JSON.stringify(oido)).not.toContain(ana.accountId);
      a.close();
      b.close();
    },
    PESADA,
  );

  it('flood: el sexto mensaje en 10 s se rechaza con RATE_LIMITED y cuánto esperar', async () => {
    const { socket } = await joinRoomDirectly('flood');
    await socket.next('ROOM_SNAPSHOT');
    for (let i = 1; i <= CHAT.rate.limit; i++) {
      socket.send(chat(`mensaje número ${i}`));
      await socket.next('CHAT_MESSAGE');
    }
    socket.send(chat('uno de más'));
    const error = await socket.next('ERROR');
    expect(error.payload).toMatchObject({ code: 'RATE_LIMITED', about: 'CHAT_SEND' });
    expect(error.payload.retryAfterMs).toBeGreaterThan(0);
    expect(error.payload.retryAfterMs).toBeLessThanOrEqual(CHAT.rate.windowMs);
    expect(socket.received.filter((m) => m.type === 'CHAT_MESSAGE')).toHaveLength(CHAT.rate.limit);
    socket.close();
  });

  it('repetir lo mismo, mandar algo vacío o demasiado largo se rechaza sin repartirse', async () => {
    const { socket } = await joinRoomDirectly('rechazos');
    await socket.next('ROOM_SNAPSHOT');
    socket.send(chat('hola'));
    await socket.next('CHAT_MESSAGE');
    socket.send(chat('HOLA!!'));
    expect((await socket.next('ERROR')).payload).toMatchObject({
      code: 'CHAT_REJECTED',
      about: 'CHAT_SEND',
    });
    socket.send(chat('​​ㅤ'));
    expect((await socket.next('ERROR')).payload.code).toBe('CHAT_REJECTED');
    socket.send(chat('a'.repeat(CHAT.maxChars + 1)));
    expect((await socket.next('ERROR')).payload.code).toBe('CHAT_REJECTED');
    // Campos de más: el mensaje entero es inválido.
    socket.send({ v: 1, type: 'CHAT_SEND', payload: { text: 'x', name: 'Otra persona' } });
    expect((await socket.next('ERROR')).payload.code).toBe('INVALID_MESSAGE');
    expect(socket.received.filter((m) => m.type === 'CHAT_MESSAGE')).toHaveLength(1);
    socket.close();
  });

  it('la ventana reciente vive en el storage de la sala, sobrevive a dormirse y se borra al vaciarse', async () => {
    const uno = await joinRoomDirectly('ventana');
    await uno.socket.next('ROOM_SNAPSHOT');
    uno.socket.send(chat('esto se recuerda un rato'));
    await uno.socket.next('CHAT_MESSAGE');
    await sleep(30);

    const guardado = await runInDurableObject(uno.stub, async (_, state) => {
      const chatKeys = await state.storage.list<ChatRecord>({ prefix: 'chat:' });
      // Otra instancia sobre el mismo storage: lo que vería la sala al despertar.
      const despierta = new RoomDO(state, env);
      await state.blockConcurrencyWhile(async () => {});
      return {
        enStorage: [...chatKeys.values()].map((r) => r.text),
        alDespertar: (despierta as unknown as { recent: ChatRecord[] }).recent.map((r) => r.text),
      };
    });
    expect(guardado.enStorage).toEqual(['esto se recuerda un rato']);
    expect(guardado.alDespertar).toEqual(['esto se recuerda un rato']);
    // Nada de chat en D1.
    const tablas = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '%chat%'",
    ).all();
    expect(tablas.results).toHaveLength(0);

    uno.socket.close();
    await sleep(80);
    const despues = await runInDurableObject(uno.stub, (_, state) =>
      state.storage.list({ prefix: 'chat:' }),
    );
    expect(despues.size).toBe(0);
  });
});

describe('gestos (§19)', () => {
  it('solo del catálogo y con enfriamiento; los ven todos', async () => {
    const uno = await joinRoomDirectly('gestos', { hardLimit: 5 });
    const dos = await joinRoomDirectly('gestos', { hardLimit: 5 });
    await uno.socket.next('ROOM_SNAPSHOT');
    await dos.socket.next('ROOM_SNAPSHOT');

    uno.socket.send(emote('wave'));
    const visto = await dos.socket.next('EMOTE_PLAYED');
    expect(visto.payload).toEqual({ id: uno.identity.characterId, emote: 'wave' });
    await uno.socket.next('EMOTE_PLAYED');

    uno.socket.send(emote('heart'));
    const muyPronto = await uno.socket.next('ERROR');
    expect(muyPronto.payload).toMatchObject({ code: 'RATE_LIMITED', about: 'EMOTE_PLAY' });
    expect(muyPronto.payload.retryAfterMs).toBeLessThanOrEqual(EMOTE.cooldownMs);

    uno.socket.send(emote('dab'));
    expect((await uno.socket.next('ERROR')).payload.code).toBe('INVALID_MESSAGE');

    await sleep(EMOTE.cooldownMs + 50);
    uno.socket.send(emote('thumbs_up'));
    expect((await dos.socket.next('EMOTE_PLAYED')).payload.emote).toBe('thumbs_up');
    uno.socket.close();
    dos.socket.close();
  });
});

describe('bloqueos (ADR-0010)', () => {
  it(
    'quien bloquea deja de oír y de ser oído; los demás oyen a los dos; sobrevive a reconectar y se deshace',
    async () => {
      const ana = await playerWithCharacter('Ana Bloquea');
      const beto = await playerWithCharacter('Beto Molesta');
      const caro = await playerWithCharacter('Caro Testigo');
      const a = await joinAs('bloqueos', ana);
      const b = await joinAs('bloqueos', beto);
      const c = await joinAs('bloqueos', caro);

      a.socket.send(block(beto.characterId));
      const confirmado = await a.socket.next('PLAYER_BLOCKED');
      expect(confirmado.payload).toEqual({ characterId: beto.characterId, blocked: true });
      const fila = await env.DB.prepare(
        'SELECT 1 AS x FROM blocks WHERE blocker_account_id = ? AND blocked_account_id = ?',
      )
        .bind(ana.accountId, beto.accountId)
        .first();
      expect(fila).not.toBeNull();

      // Beto habla: Caro lo oye, él recibe su eco, Ana no.
      b.socket.send(chat('ey ana'));
      const deBeto = await c.socket.next('CHAT_MESSAGE');
      await b.socket.next('CHAT_MESSAGE');
      // Ana habla: Caro la oye, Beto no.
      a.socket.send(chat('hola caro'));
      const deAna = await c.socket.next('CHAT_MESSAGE');
      await a.socket.next('CHAT_MESSAGE');
      // Los gestos tampoco cruzan.
      b.socket.send(emote('laugh'));
      await c.socket.next('EMOTE_PLAYED');
      await sleep(60);
      const idBeto = deBeto.payload.message.id;
      const idAna = deAna.payload.message.id;
      expect(heardChat(a.socket, idBeto)).toBe(false);
      expect(heardChat(b.socket, idAna)).toBe(false);
      expect(heard(a.socket, 'EMOTE_PLAYED')).toBe(false);
      // Beto nunca se entera de que lo bloquearon.
      expect(heard(b.socket, 'PLAYER_BLOCKED')).toBe(false);

      // Ana vuelve a entrar: el bloqueo viene de D1 y el snapshot se lo recuerda.
      a.socket.close();
      const a2 = await joinRoomDirectly('bloqueos', {
        characterId: ana.characterId,
        accountId: ana.accountId,
        displayName: ana.displayName,
        hardLimit: 8,
      });
      const snap = await a2.socket.next('ROOM_SNAPSHOT');
      expect(snap.payload.blocked).toEqual([beto.characterId]);
      b.socket.send(chat('sigo aquí'));
      const otraVez = await c.socket.next('CHAT_MESSAGE');
      await sleep(60);
      expect(heardChat(a2.socket, otraVez.payload.message.id)).toBe(false);

      // Beto sale y vuelve: a Ana se le avisa que llegó alguien que bloqueó.
      b.socket.close();
      await a2.socket.next('PLAYER_LEFT', (m) => m.payload.id === beto.characterId);
      const b2 = await joinAs('bloqueos', beto);
      await a2.socket.next('PLAYER_JOINED', (m) => m.payload.player.id === beto.characterId);
      const aviso = await a2.socket.next('PLAYER_BLOCKED');
      expect(aviso.payload).toEqual({ characterId: beto.characterId, blocked: true });

      // Desbloquear: se vuelven a oír.
      a2.socket.send(unblock(beto.characterId));
      expect((await a2.socket.next('PLAYER_BLOCKED')).payload.blocked).toBe(false);
      b2.socket.send(chat('ya nos oímos'));
      const ahora = await a2.socket.next('CHAT_MESSAGE');
      expect(ahora.payload.message.text).toBe('ya nos oímos');

      a2.socket.close();
      b2.socket.close();
      c.socket.close();
    },
    PESADA,
  );

  it(
    'no puedes bloquearte ni bloquear a quien no está; la casa lista y desbloquea',
    async () => {
      const dani = await playerWithCharacter('Dani Casa');
      const eli = await playerWithCharacter('Eli Casa');
      const d = await joinAs('casa', dani);
      d.socket.send(block(dani.characterId));
      expect((await d.socket.next('ERROR')).payload).toMatchObject({
        code: 'FORBIDDEN',
        about: 'BLOCK_PLAYER',
      });
      d.socket.send(block(eli.characterId));
      expect((await d.socket.next('ERROR')).payload.code).toBe('PLAYER_NOT_FOUND');

      // Eli entra, dice algo y se va: se le puede bloquear por lo que dijo.
      const e = await joinAs('casa', eli);
      e.socket.send(chat('adiós, me voy'));
      await d.socket.next('CHAT_MESSAGE');
      e.socket.close();
      await d.socket.next('PLAYER_LEFT', (m) => m.payload.id === eli.characterId);
      d.socket.send(block(eli.characterId));
      expect((await d.socket.next('PLAYER_BLOCKED')).payload.blocked).toBe(true);
      d.socket.close();

      const lista = await call('/api/v1/blocks', { headers: { Cookie: dani.cookie } });
      expect(lista.status).toBe(200);
      const { data } = (await lista.json()) as {
        data: { blocked: { characterId: string; displayName: string }[] };
      };
      expect(data.blocked).toMatchObject([
        { characterId: eli.characterId, displayName: 'Eli Casa' },
      ]);

      const quitar = await call(`/api/v1/blocks/${eli.characterId}`, {
        method: 'DELETE',
        headers: { Cookie: dani.cookie },
      });
      expect(quitar.status).toBe(200);
      expect(((await quitar.json()) as { data: { unblocked: boolean } }).data.unblocked).toBe(true);
      const vacia = await call('/api/v1/blocks', { headers: { Cookie: dani.cookie } });
      expect(((await vacia.json()) as { data: { blocked: unknown[] } }).data.blocked).toEqual([]);

      // Sin sesión, nada.
      expect((await call('/api/v1/blocks')).status).toBe(401);
    },
    PESADA,
  );
});

describe('reportes (§18)', () => {
  type ReportRow = {
    target_account_id: string;
    message_id: string | null;
    reason: string;
    note: string | null;
    status: string;
    room: string;
    evidence_json: string;
  };

  it(
    'guardan la evidencia que la sala repartió, nunca la que dice el cliente',
    async () => {
      const fer = await playerWithCharacter('Fer Reporta');
      const gil = await playerWithCharacter('Gil Grosero');
      const hugo = await playerWithCharacter('Hugo Charla');
      const f = await joinAs('reportes', fer);
      const g = await joinAs('reportes', gil);
      const h = await joinAs('reportes', hugo);

      h.socket.send(chat('buenas tardes'));
      const deHugo = await f.socket.next('CHAT_MESSAGE');
      g.socket.send(chat('eres lo peor'));
      const grosero = await f.socket.next('CHAT_MESSAGE');

      // Mandar el texto invalida el mensaje entero.
      f.socket.send(
        report({ characterId: gil.characterId, reason: 'HARASSMENT', text: 'dijo otra cosa' }),
      );
      expect((await f.socket.next('ERROR')).payload.code).toBe('INVALID_MESSAGE');
      // Un mensaje de otra persona no sirve de evidencia contra Gil.
      f.socket.send(
        report({
          characterId: gil.characterId,
          reason: 'HARASSMENT',
          messageId: deHugo.payload.message.id,
        }),
      );
      expect((await f.socket.next('ERROR')).payload).toMatchObject({
        code: 'FORBIDDEN',
        about: 'REPORT_PLAYER',
      });

      f.socket.send(
        report({
          characterId: gil.characterId,
          reason: 'HARASSMENT',
          messageId: grosero.payload.message.id,
          note: '  me   insulta‮  ',
        }),
      );
      expect((await f.socket.next('REPORT_ACCEPTED')).payload.characterId).toBe(gil.characterId);
      // Otra vez al rato: misma respuesta, sin duplicar.
      f.socket.send(report({ characterId: gil.characterId, reason: 'SPAM' }));
      await f.socket.next('REPORT_ACCEPTED');

      const { results } = await env.DB.prepare('SELECT * FROM reports WHERE target_account_id = ?')
        .bind(gil.accountId)
        .all<ReportRow>();
      expect(results).toHaveLength(1);
      const fila = results[0] as ReportRow;
      expect(fila).toMatchObject({
        message_id: grosero.payload.message.id,
        reason: 'HARASSMENT',
        note: 'me insulta',
        status: 'OPEN',
        room: 'plaza:reportes',
      });
      const evidencia = JSON.parse(fila.evidence_json);
      expect(evidencia.message).toMatchObject({ text: 'eres lo peor', from: gil.characterId });
      expect(evidencia.context.map((l: { text: string }) => l.text)).toEqual(['buenas tardes']);
      expect(evidencia.target).toMatchObject({
        characterId: gil.characterId,
        displayName: 'Gil Grosero',
      });
      // La evidencia no expone cuentas: solo personajes.
      expect(fila.evidence_json).not.toContain(gil.accountId);

      f.socket.close();
      g.socket.close();
      h.socket.close();
    },
    PESADA,
  );

  it(
    'sin mensaje elegido guarda lo último que dijo la persona reportada',
    async () => {
      const ivan = await playerWithCharacter('Ivan Reporta');
      const juan = await playerWithCharacter('Juan Spam');
      const i = await joinAs('reporte-sin-mensaje', ivan);
      const j = await joinAs('reporte-sin-mensaje', juan);
      for (const texto of ['compra ya', 'oferta única', 'visita mi perfil']) {
        j.socket.send(chat(texto));
        await i.socket.next('CHAT_MESSAGE');
      }
      i.socket.send(report({ characterId: juan.characterId, reason: 'SPAM' }));
      await i.socket.next('REPORT_ACCEPTED');
      const fila = await env.DB.prepare(
        'SELECT evidence_json FROM reports WHERE target_account_id = ?',
      )
        .bind(juan.accountId)
        .first<{ evidence_json: string }>();
      const evidencia = JSON.parse(fila?.evidence_json ?? '{}');
      expect(evidencia.message).toBeNull();
      expect(evidencia.targetMessages.map((l: { text: string }) => l.text)).toEqual([
        'compra ya',
        'oferta única',
        'visita mi perfil',
      ]);
      i.socket.close();
      j.socket.close();
    },
    PESADA,
  );
});

describe('moderación básica', () => {
  it(
    'un silencio de moderación impide escribir, pero no los gestos',
    async () => {
      const kim = await playerWithCharacter('Kim Silencio');
      const hasta = Date.now() + 60 * 60_000;
      await env.DB.prepare('UPDATE accounts SET chat_muted_until = ? WHERE id = ?')
        .bind(hasta, kim.accountId)
        .run();
      const k = (await connect(kim.cookie)).socket;
      if (!k) throw new Error('no entró');
      await k.next('ROOM_SNAPSHOT');
      k.send(chat('hola'));
      const error = await k.next('ERROR');
      expect(error.payload).toMatchObject({ code: 'CHAT_MUTED', about: 'CHAT_SEND' });
      expect(error.payload.retryAfterMs).toBeGreaterThan(59 * 60_000);
      k.send(emote('wave'));
      await k.next('EMOTE_PLAYED');
      k.close();
    },
    PESADA,
  );

  it(
    'la revisión periódica aplica un silencio nuevo y saca a quien suspendieron o cerró sesión en todos lados',
    async () => {
      const lalo = await playerWithCharacter('Lalo Revisión');
      const memo = await playerWithCharacter('Memo Revisión');
      const l = (await connect(lalo.cookie)).socket;
      const m = (await connect(memo.cookie)).socket;
      if (!l || !m) throw new Error('no entraron');
      await l.next('ROOM_SNAPSHOT');
      await m.next('ROOM_SNAPSHOT');
      // Con el límite suave de prueba (2) pueden quedar en instancias distintas.
      const revisar = async (characterId: string) =>
        runInDurableObject(await roomOf(characterId), async (room: RoomDO) => {
          await (room as unknown as { review(now: number): Promise<void> }).review(Date.now());
        });

      // Silencio puesto con Lalo conectado: aplica tras la revisión.
      l.send(chat('antes del silencio'));
      await l.next('CHAT_MESSAGE');
      await env.DB.prepare('UPDATE accounts SET chat_muted_until = ? WHERE id = ?')
        .bind(Date.now() + 10 * 60_000, lalo.accountId)
        .run();
      await revisar(lalo.characterId);
      l.send(chat('después del silencio'));
      expect((await l.next('ERROR')).payload.code).toBe('CHAT_MUTED');

      // Suspensión: sale con SESSION_ENDED y los demás ven que se fue.
      await env.DB.prepare("UPDATE accounts SET status = 'SUSPENDED' WHERE id = ?")
        .bind(lalo.accountId)
        .run();
      const salaDeMemo = (await directory('plaza').occupancy()).presence[memo.characterId];
      const juntos =
        salaDeMemo === (await directory('plaza').occupancy()).presence[lalo.characterId];
      await revisar(lalo.characterId);
      expect((await l.next('ERROR')).payload.code).toBe('ACCOUNT_NOT_ACTIVE');
      expect((await l.closed).code).toBe(WS_CLOSE.SESSION_ENDED);
      if (juntos) await m.next('PLAYER_LEFT', (x) => x.payload.id === lalo.characterId);

      // «Cerrar sesión en todos lados» también saca a quien seguía conectado.
      const salir = await call('/api/v1/auth/logout-all', {
        method: 'POST',
        headers: { Cookie: memo.cookie },
      });
      expect(salir.status).toBe(204);
      await revisar(memo.characterId);
      expect((await m.closed).code).toBe(WS_CLOSE.SESSION_ENDED);
    },
    PESADA,
  );
});
