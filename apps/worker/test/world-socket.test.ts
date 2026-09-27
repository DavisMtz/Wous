import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { MOVEMENT, NETWORK } from '@wous/config';
import { WS_CLOSE, WS_PING_TEXT } from '@wous/contracts';
import { describe, expect, it } from 'vitest';
import type { RoomDO } from '../src/durable-objects/RoomDO.ts';
import { call } from './helpers.ts';
import { createVerifiedUser } from './support.ts';
import { connect, hold, joinRoomDirectly, playerWithCharacter, sleep } from './world-support.ts';

describe('handshake de /ws/world', () => {
  it('rechaza sin upgrade, con otro origen, sin sesión o sin personaje', async () => {
    const user = await createVerifiedUser();
    expect((await call('/ws/world', { headers: { Cookie: user.cookie } })).status).toBe(426);

    const otroOrigen = await connect(user.cookie, { Origin: 'https://evil.example' });
    expect(otroOrigen.res.status).toBe(403);

    const sinSesion = await call('/ws/world', { headers: { Upgrade: 'websocket' } });
    expect(sinSesion.status).toBe(401);

    const sinPersonaje = await connect(user.cookie);
    expect(sinPersonaje.res.status).toBe(409);
  });
});

describe('la sala en tiempo real', () => {
  it('dos personas se ven: snapshot, llegada, movimiento y salida', async () => {
    const ana = await playerWithCharacter('Ana');
    const beto = await playerWithCharacter('Beto');

    const a = (await connect(ana.cookie)).socket;
    if (!a) throw new Error('Ana no entró');
    const snapA = await a.next('ROOM_SNAPSHOT');
    expect(snapA.payload.selfId).toBe(ana.characterId);
    expect(snapA.payload.room.mapId).toBe('plaza');
    const yo = snapA.payload.players.find((p) => p.id === ana.characterId);
    expect(yo?.displayName).toBe('Ana');
    // Lo que otros ven no trae cuenta, correo ni sesión.
    expect(JSON.stringify(snapA)).not.toContain(ana.accountId);
    expect(JSON.stringify(snapA)).not.toContain(ana.email);

    const b = (await connect(beto.cookie)).socket;
    if (!b) throw new Error('Beto no entró');
    const snapB = await b.next('ROOM_SNAPSHOT');
    expect(snapB.payload.players.map((p) => p.id)).toContain(ana.characterId);
    await a.next('PLAYER_JOINED', (m) => m.payload.player.id === beto.characterId);

    // Ana camina hacia arriba a 12 Hz; Beto recibe su estado autoritativo.
    const inicio = yo ?? { x: 0, y: 0 };
    await hold(a, 1, 0, -1, 400);
    const visto = await b.next('PLAYER_STATE', (m) =>
      m.payload.states.some((s) => s.id === ana.characterId && s.moveY === 0),
    );
    const estado = visto.payload.states.find((s) => s.id === ana.characterId);
    expect(estado?.y).toBeLessThan(inicio.y - 0.8);
    expect(estado?.x).toBeCloseTo(inicio.x, 3);
    expect(estado?.facing).toBe('up');

    b.close();
    await a.next('PLAYER_LEFT', (m) => m.payload.id === beto.characterId);
    a.close();
  });

  it('enviar más rápido no mueve más rápido y las coordenadas no se aceptan', async () => {
    const { socket, identity } = await joinRoomDirectly('rapido');
    const snap = await socket.next('ROOM_SNAPSHOT');
    const inicio = snap.payload.players.find((p) => p.id === identity.characterId);
    if (!inicio) throw new Error('sin estado inicial');

    // Un cliente modificado manda coordenadas: el mensaje entero es inválido.
    socket.send({
      v: 1,
      type: 'PLAYER_INPUT',
      seq: 1,
      payload: { moveX: 0, moveY: 0, x: 3, y: 4 },
    });
    const error = await socket.next('ERROR');
    expect(error.payload.code).toBe('INVALID_MESSAGE');

    // Ráfaga de 30 inputs en el mismo instante: el servidor usa SU tiempo.
    const t0 = Date.now();
    for (let seq = 2; seq < 32; seq++) {
      socket.send({ v: 1, type: 'PLAYER_INPUT', seq, payload: { moveX: 1, moveY: 0 } });
    }
    socket.send({ v: 1, type: 'PLAYER_INPUT', seq: 40, payload: { moveX: 0, moveY: 0 } });
    const state = await socket.next('PLAYER_STATE', (m) =>
      m.payload.states.some((s) => s.id === identity.characterId && s.seq === 40),
    );
    const elapsed = Date.now() - t0;
    const final = state.payload.states.find((s) => s.id === identity.characterId);
    const max = (MOVEMENT.speedTilesPerSecond * (elapsed + MOVEMENT.maxStepMs)) / 1000;
    expect((final?.x ?? 0) - inicio.x).toBeLessThanOrEqual(max);

    // Secuencias viejas se ignoran.
    socket.send({ v: 1, type: 'PLAYER_INPUT', seq: 5, payload: { moveX: -1, moveY: 0 } });
    await sleep(200);
    socket.send({ v: 1, type: 'PLAYER_INPUT', seq: 41, payload: { moveX: 0, moveY: 0 } });
    const despues = await socket.next('PLAYER_STATE', (m) =>
      m.payload.states.some((s) => s.seq === 41),
    );
    expect(despues.payload.states[0]?.x).toBeCloseTo(final?.x ?? 0, 3);
    socket.close();
  });

  it('las paredes del mapa detienen al servidor', async () => {
    // Frente a la puerta del Café: arriba está la fachada (filas 0–2).
    const { socket } = await joinRoomDirectly('colision', { spawn: 'desde-cafe' });
    const snap = await socket.next('ROOM_SNAPSHOT');
    expect(snap.payload.players[0]?.y).toBeCloseTo(4.6, 3);
    const seq = await hold(socket, 1, 0, -1, 900);
    const estado = await socket.next('PLAYER_STATE', (m) =>
      m.payload.states.some((s) => s.seq === seq),
    );
    const y = estado.payload.states[0]?.y ?? 0;
    expect(y).toBeGreaterThanOrEqual(3 + MOVEMENT.footprint.halfHeight - 0.01);
    expect(y).toBeLessThan(3.4);
    socket.close();
  });

  it('otra pestaña reemplaza a la anterior sin que los demás vean una salida', async () => {
    const ana = await playerWithCharacter('Ana Dos');
    const beto = await playerWithCharacter('Beto Dos');
    const a1 = (await connect(ana.cookie)).socket;
    const b = (await connect(beto.cookie)).socket;
    if (!a1 || !b) throw new Error('no entraron');
    await a1.next('ROOM_SNAPSHOT');
    await b.next('ROOM_SNAPSHOT');

    const a2 = (await connect(ana.cookie)).socket;
    if (!a2) throw new Error('la segunda pestaña no entró');
    const snap = await a2.next('ROOM_SNAPSHOT');
    expect(snap.payload.selfId).toBe(ana.characterId);

    const aviso = await a1.next('ERROR');
    expect(aviso.payload.code).toBe('CONNECTION_REPLACED');
    expect((await a1.closed).code).toBe(WS_CLOSE.REPLACED);

    await b.next('PLAYER_JOINED', (m) => m.payload.player.id === ana.characterId);
    await sleep(150);
    expect(
      b.received.some((m) => m.type === 'PLAYER_LEFT' && m.payload.id === ana.characterId),
    ).toBe(false);
    a2.close();
    b.close();
  });

  it('una instancia llena rechaza con ROOM_FULL', async () => {
    const uno = await joinRoomDirectly('llena', { hardLimit: 1 });
    await uno.socket.next('ROOM_SNAPSHOT');
    const dos = await joinRoomDirectly('llena', { hardLimit: 1 });
    const error = await dos.socket.next('ERROR');
    expect(error.payload.code).toBe('ROOM_FULL');
    expect((await dos.socket.closed).code).toBe(WS_CLOSE.ROOM_FULL);
    uno.socket.close();
  });

  it('mensajes basura suman faltas y al pasarse se cierra el socket', async () => {
    const { socket } = await joinRoomDirectly('basura');
    await socket.next('ROOM_SNAPSHOT');
    for (let i = 0; i <= NETWORK.maxStrikes; i++) socket.send('esto no es json');
    expect((await socket.closed).code).toBe(WS_CLOSE.POLICY);
  });

  it('100 inputs en menos de un segundo no cortan: se ignoran los de más y avisa una vez', async () => {
    // Un joystick en iPad (27/09/2026) mandaba 60–120 por segundo y la sala lo corría.
    const { socket } = await joinRoomDirectly('joystick');
    await socket.next('ROOM_SNAPSHOT');
    for (let seq = 1; seq <= 100; seq++) {
      socket.send({ v: 1, type: 'PLAYER_INPUT', seq, payload: { moveX: 0.5, moveY: 0.5 } });
    }
    // Sigue viva. El ping no sirve de testigo (lo contesta el runtime sin pasar por la
    // sala); un chat sí: la sala procesa en orden, así que su eco llega después de todo.
    socket.send({ v: 1, type: 'CHAT_SEND', payload: { text: 'sigo aquí' } });
    await socket.next('CHAT_MESSAGE');
    const avisos = socket.received.filter(
      (m) => m.type === 'ERROR' && m.payload.about === 'PLAYER_INPUT',
    );
    expect(avisos).toHaveLength(1);
    socket.close();
    const cierre = await socket.closed;
    expect(cierre.code).not.toBe(WS_CLOSE.POLICY);
  });

  it('el ping con el texto exacto recibe PONG', async () => {
    const { socket } = await joinRoomDirectly('ping');
    await socket.next('ROOM_SNAPSHOT');
    socket.send(WS_PING_TEXT);
    await socket.next('PONG');
    socket.close();
  });

  it('la presencia vence sin señales de vida y la sala vacía no deja alarma', async () => {
    const quieto = await joinRoomDirectly('vence');
    const vivo = await joinRoomDirectly('vence');
    await quieto.socket.next('ROOM_SNAPSHOT');
    await vivo.socket.next('ROOM_SNAPSHOT');
    const alarma = await runInDurableObject(quieto.stub, (_, state) => state.storage.getAlarm());
    expect(alarma).not.toBeNull();

    // Simula que pasó la ventana: la limpieza oportunista cierra a los dos,
    // y quien siga (vivo) vería la salida del otro.
    await runInDurableObject(quieto.stub, (room: RoomDO) => {
      (room as unknown as { reapStale(now: number): void }).reapStale(
        Date.now() + NETWORK.staleAfterMs + 1000,
      );
    });
    expect((await quieto.socket.closed).code).toBe(WS_CLOSE.STALE);
    expect((await vivo.socket.closed).code).toBe(WS_CLOSE.STALE);

    await sleep(50);
    const despues = await runInDurableObject(quieto.stub, (_, state) => state.storage.getAlarm());
    expect(despues).toBeNull();
  });
});

describe('directorio de instancias', () => {
  it('llena la primera hasta el límite suave y abre otra; quien ya está, vuelve a la suya', async () => {
    const dir = env.ROOM_DIRECTORY.get(env.ROOM_DIRECTORY.idFromName('directory:prueba'));
    const limits = { softLimit: 2, hardLimit: 3 };
    const now = Date.now();
    const a = await dir.assign('chr_A', limits);
    await dir.report(a.instance, 1, { joined: 'chr_A' }, now);
    const b = await dir.assign('chr_B', limits);
    await dir.report(b.instance, 2, { joined: 'chr_B' }, now);
    const c = await dir.assign('chr_C', limits);
    expect(a.instance).toBe('01');
    expect(b.instance).toBe('01');
    expect(c.instance).toBe('02');
    // Reconexión de A: vuelve a la 01 aunque esté en el límite suave.
    expect((await dir.assign('chr_A', limits)).instance).toBe('01');
    await dir.report('01', 1, { left: 'chr_A' }, now);
    expect((await dir.assign('chr_D', limits)).instance).toBe('01');
  });
});
