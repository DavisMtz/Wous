import { DurableObject } from 'cloudflare:workers';
import { NETWORK } from '@wous/config';
import {
  ClientMessage,
  type PlayerInputMessage,
  type ServerMessage,
  WS_CLOSE,
  WS_MAX_CLIENT_MESSAGE,
  WS_PING_TEXT,
  WS_PONG_TEXT,
  WS_PROTOCOL_VERSION,
  type WsCloseCode,
  WsEnvelopeHeader,
  type WsErrorCode,
} from '@wous/contracts';
import type { CollisionGrid } from '@wous/game-core';
import { collisionGrid, getMap, type MapDef, type MapId, spawnOf } from '@wous/world-data';
import { createLogger, type Logger } from '../lib/log.ts';
import {
  applyInput,
  chooseSpawn,
  directoryObjectName,
  IDENTITY_HEADER,
  type PlayerAttachment,
  type RoomIdentity,
  roomRef,
  toPlayerView,
  toStateView,
} from '../world/players.ts';

type RoomMeta = { mapId: MapId; instance: string };
const META_KEY = 'meta';

/**
 * Una instancia de sala (§13) con la WebSocket Hibernation API.
 *
 * - El estado de cada jugador vive en el attachment de su socket; la sala no
 *   guarda posiciones en storage ni en D1 (§14).
 * - No hay bucle: el movimiento se calcula al llegar cada input, y los
 *   estados se mandan en lotes con un temporizador que solo existe mientras
 *   hay cambios pendientes. El ping lo contesta el runtime sin despertarla.
 * - Una alarma limpia presencias muertas y solo existe mientras hay gente.
 */
export class RoomDO extends DurableObject<Env> {
  private meta: RoomMeta | null = null;
  private map: MapDef | null = null;
  private grid: CollisionGrid | null = null;
  private readonly dirty = new Set<string>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly log: Logger;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.log = createLogger({ environment: env.APP_ENV, component: 'room' });
    // Se reconstruye tras hibernar: el runtime contesta el ping por nosotros.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(WS_PING_TEXT, WS_PONG_TEXT));
    ctx.blockConcurrencyWhile(async () => {
      const meta = await ctx.storage.get<RoomMeta>(META_KEY);
      if (meta) this.useMap(meta);
    });
  }

  async ping(): Promise<'pong'> {
    return 'pong';
  }

  /** Jugadores presentes (sockets vivos que representan a alguien). */
  private live(): { ws: WebSocket; att: PlayerAttachment }[] {
    const out: { ws: WebSocket; att: PlayerAttachment }[] = [];
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as PlayerAttachment | null;
      if (att && !att.gone) out.push({ ws, att });
    }
    return out;
  }

  private useMap(meta: RoomMeta): void {
    const map = getMap(meta.mapId);
    if (!map) throw new Error(`Sala con mapa desconocido: ${meta.mapId}`);
    this.meta = meta;
    this.map = map;
    this.grid = collisionGrid(map);
  }

  // ─── Entrada ────────────────────────────────────────────────────────────

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Se esperaba WebSocket.', { status: 426 });
    }
    const raw = request.headers.get(IDENTITY_HEADER);
    if (!raw) return new Response('Sin identidad.', { status: 400 });
    const identity = JSON.parse(raw) as RoomIdentity;

    if (!this.meta) {
      const meta = { mapId: identity.mapId, instance: identity.instance };
      this.useMap(meta);
      await this.ctx.storage.put(META_KEY, meta);
    }
    const map = this.map as MapDef;
    const grid = this.grid as CollisionGrid;
    const now = Date.now();
    this.reapStale(now);

    // La misma persona en otra pestaña: la conexión nueva gana y hereda el lugar.
    let heredado: PlayerAttachment | null = null;
    for (const old of this.ctx.getWebSockets(identity.characterId)) {
      const att = old.deserializeAttachment() as PlayerAttachment | null;
      if (!att || att.gone) continue;
      heredado = att;
      this.retire(old, att, 'replaced', WS_CLOSE.REPLACED, 'CONNECTION_REPLACED');
    }

    const present = this.live();
    if (!heredado && present.length >= identity.hardLimit) {
      return this.reject('ROOM_FULL', WS_CLOSE.ROOM_FULL, 'La sala está llena.');
    }

    const base = spawnOf(map, identity.spawn);
    const at = heredado
      ? { x: heredado.x, y: heredado.y }
      : chooseSpawn(
          base,
          present.map(({ att }) => ({ x: att.x, y: att.y })),
          grid,
        );
    const att: PlayerAttachment = {
      id: identity.characterId,
      acc: identity.accountId,
      ses: identity.sessionId,
      name: identity.displayName,
      look: identity.appearance,
      x: at.x,
      y: at.y,
      f: heredado?.f ?? base.facing,
      mx: 0,
      my: 0,
      seq: 0,
      at: now,
      seen: now,
      win: now,
      n: 0,
      strikes: 0,
    };

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server, [identity.characterId]);
    server.serializeAttachment(att);

    const others = present.filter((p) => p.att.id !== att.id);
    this.send(server, {
      v: WS_PROTOCOL_VERSION,
      type: 'ROOM_SNAPSHOT',
      payload: {
        room: roomRef(map, identity.instance),
        selfId: att.id,
        players: [toPlayerView(att), ...others.map((p) => toPlayerView(p.att))],
        serverTime: now,
      },
    });
    this.broadcast(
      { v: WS_PROTOCOL_VERSION, type: 'PLAYER_JOINED', payload: { player: toPlayerView(att) } },
      server,
    );
    this.log.info('room.joined', {
      room: identity.instance,
      map: map.id,
      characterId: att.id,
      players: others.length + 1,
      inherited: Boolean(heredado),
    });

    await this.ensureAlarm(now);
    this.reportOccupancy({ joined: att.id });
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Rechazo con código: se acepta el socket solo para decir por qué y se cierra. */
  private reject(code: WsErrorCode, closeCode: WsCloseCode, message: string): Response {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    server.accept();
    server.send(
      JSON.stringify({ v: WS_PROTOCOL_VERSION, type: 'ERROR', payload: { code, message } }),
    );
    server.close(closeCode, code);
    return new Response(null, { status: 101, webSocket: client });
  }

  // ─── Mensajes ───────────────────────────────────────────────────────────

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const att = ws.deserializeAttachment() as PlayerAttachment | null;
    if (!att || att.gone) return;
    const now = Date.now();
    att.seen = now;

    if (typeof message !== 'string' || message.length > WS_MAX_CLIENT_MESSAGE) {
      return this.strike(ws, att, 'INVALID_MESSAGE');
    }
    let raw: unknown;
    try {
      raw = JSON.parse(message);
    } catch {
      return this.strike(ws, att, 'INVALID_MESSAGE');
    }
    const header = WsEnvelopeHeader.safeParse(raw);
    if (header.success && header.data.v !== WS_PROTOCOL_VERSION) {
      this.sendError(ws, 'UNSUPPORTED_VERSION', 'Actualiza la página: cambió la versión.');
      return this.retire(ws, att, 'stale', WS_CLOSE.POLICY);
    }
    const parsed = ClientMessage.safeParse(raw);
    if (!parsed.success) return this.strike(ws, att, 'INVALID_MESSAGE');

    switch (parsed.data.type) {
      case 'PING':
        // Solo llega aquí si no coincidió con la auto-respuesta (otro formato).
        ws.send(WS_PONG_TEXT);
        ws.serializeAttachment(att);
        return;
      case 'PLAYER_INPUT':
        return this.onInput(ws, att, parsed.data, now);
    }
  }

  private onInput(
    ws: WebSocket,
    att: PlayerAttachment,
    msg: PlayerInputMessage,
    now: number,
  ): void {
    if (now - att.win >= 1000) {
      att.win = now;
      att.n = 0;
    }
    att.n += 1;
    if (att.n > NETWORK.maxInputsPerSecond) return this.strike(ws, att, 'RATE_LIMITED');
    // Secuencias viejas o repetidas no cuentan (§14.1).
    if (msg.seq <= att.seq) {
      ws.serializeAttachment(att);
      return;
    }
    const next = applyInput(att, { ...msg.payload, seq: msg.seq }, now, this.grid as CollisionGrid);
    ws.serializeAttachment(next);
    this.dirty.add(next.id);
    this.scheduleFlush();
  }

  /** Falta: se avisa con código; demasiadas cierran el socket (§23). */
  private strike(ws: WebSocket, att: PlayerAttachment, code: WsErrorCode): void {
    att.strikes += 1;
    if (att.strikes > NETWORK.maxStrikes) {
      this.sendError(ws, code, 'Demasiados mensajes inválidos.');
      this.log.warn('room.policy_close', { characterId: att.id, code });
      this.retire(ws, att, 'stale', WS_CLOSE.POLICY);
      return;
    }
    ws.serializeAttachment(att);
    this.sendError(ws, code, code === 'RATE_LIMITED' ? 'Vas muy rápido.' : 'Mensaje no válido.');
  }

  // ─── Lotes de estado ────────────────────────────────────────────────────

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => this.flush(), NETWORK.stateFlushMs);
  }

  private flush(): void {
    this.flushTimer = null;
    if (this.dirty.size === 0) return;
    const states = [];
    for (const id of this.dirty) {
      for (const ws of this.ctx.getWebSockets(id)) {
        const att = ws.deserializeAttachment() as PlayerAttachment | null;
        if (att && !att.gone) states.push(toStateView(att));
      }
    }
    this.dirty.clear();
    if (states.length === 0) return;
    this.broadcast({
      v: WS_PROTOCOL_VERSION,
      type: 'PLAYER_STATE',
      payload: { states, serverTime: Date.now() },
    });
  }

  // ─── Salidas ────────────────────────────────────────────────────────────

  override async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    this.onGone(ws, code);
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    this.onGone(ws, 1011);
  }

  private onGone(ws: WebSocket, code: number): void {
    const att = ws.deserializeAttachment() as PlayerAttachment | null;
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code, 'adiós');
    } catch {
      // Ya estaba cerrado.
    }
    if (!att || att.gone) return;
    att.gone = 'stale';
    ws.serializeAttachment(att);
    this.announceLeave(att, 'left');
  }

  /**
   * Saca a alguien de la sala: lo marca, avisa a los demás (si no sigue en
   * otro socket) y cierra con código. El cierre posterior del cliente ya no
   * vuelve a anunciar nada.
   */
  private retire(
    ws: WebSocket,
    att: PlayerAttachment,
    why: 'replaced' | 'stale',
    closeCode: WsCloseCode,
    errorCode?: WsErrorCode,
  ): void {
    att.gone = why;
    ws.serializeAttachment(att);
    if (errorCode) this.sendError(ws, errorCode, 'Entraste desde otro lugar.');
    try {
      ws.close(closeCode, why);
    } catch {
      // Ya estaba cerrado.
    }
    if (why !== 'replaced') this.announceLeave(att, why);
  }

  private announceLeave(att: PlayerAttachment, reason: 'left' | 'stale'): void {
    this.dirty.delete(att.id);
    const stillHere = this.live().some((p) => p.att.id === att.id);
    if (stillHere) return;
    this.broadcast({
      v: WS_PROTOCOL_VERSION,
      type: 'PLAYER_LEFT',
      payload: { id: att.id, reason },
    });
    const remaining = this.live().length;
    this.log.info('room.left', { characterId: att.id, reason, players: remaining });
    this.reportOccupancy({ left: att.id });
    // Sala vacía: sin alarma pendiente, nada la vuelve a despertar.
    if (remaining === 0) this.ctx.waitUntil(this.ctx.storage.deleteAlarm());
  }

  /** Presencias sin ping ni mensajes dentro de la ventana: se van (§17). */
  private reapStale(now: number): void {
    for (const { ws, att } of this.live()) {
      const pinged = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? 0;
      const last = Math.max(att.seen, att.at, pinged);
      if (now - last > NETWORK.staleAfterMs) this.retire(ws, att, 'stale', WS_CLOSE.STALE);
    }
  }

  // ─── Alarma solo con gente ──────────────────────────────────────────────

  private async ensureAlarm(now: number): Promise<void> {
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(now + NETWORK.staleAfterMs / 2);
    }
  }

  override async alarm(): Promise<void> {
    const now = Date.now();
    this.reapStale(now);
    if (this.live().length > 0) await this.ctx.storage.setAlarm(now + NETWORK.staleAfterMs / 2);
  }

  // ─── Directorio ─────────────────────────────────────────────────────────

  private reportOccupancy(change: { joined?: string; left?: string }): void {
    const meta = this.meta;
    if (!meta) return;
    const directory = this.env.ROOM_DIRECTORY.get(
      this.env.ROOM_DIRECTORY.idFromName(directoryObjectName(meta.mapId)),
    );
    const count = this.live().length;
    this.ctx.waitUntil(
      directory.report(meta.instance, count, change, Date.now()).catch((err: unknown) => {
        this.log.warn('room.report_failed', { error: String(err) });
      }),
    );
  }

  // ─── Envío ──────────────────────────────────────────────────────────────

  private send(ws: WebSocket, message: ServerMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // El socket se está cerrando; su cierre ya se procesa aparte.
    }
  }

  private sendError(ws: WebSocket, code: WsErrorCode, message: string): void {
    this.send(ws, { v: WS_PROTOCOL_VERSION, type: 'ERROR', payload: { code, message } });
  }

  private broadcast(message: ServerMessage, except?: WebSocket): void {
    const text = JSON.stringify(message);
    for (const { ws } of this.live()) {
      if (ws === except) continue;
      try {
        ws.send(text);
      } catch {
        // Idem.
      }
    }
  }
}
