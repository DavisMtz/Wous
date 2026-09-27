import { DurableObject } from 'cloudflare:workers';
import { NETWORK, PORTALS } from '@wous/config';
import {
  ClientMessage,
  type EnterPortalMessage,
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
import type { CollisionGrid, Facing, Vec } from '@wous/game-core';
import {
  canReachPortal,
  collisionGrid,
  getMap,
  type MapDef,
  type MapId,
  spawnOf,
} from '@wous/world-data';
import { createLogger, type Logger } from '../lib/log.ts';
import { moveCharacter } from '../world/location.ts';
import {
  applyInput,
  chooseSpawn,
  directoryObjectName,
  type GoneReason,
  IDENTITY_HEADER,
  type PlayerAttachment,
  positionAt,
  type RoomIdentity,
  roomRef,
  round3,
  toPlayerView,
  toStateView,
} from '../world/players.ts';

type RoomMeta = { mapId: MapId; instance: string };
const META_KEY = 'meta';

/**
 * El lugar de alguien a quien se le cayó la conexión (§17). Vive en storage
 * porque tiene que sobrevivir a la hibernación: si la sala se duerme con un
 * lugar guardado en memoria, nadie avisaría nunca que esa persona se fue.
 */
type Ghost = { att: PlayerAttachment; until: number };
const GHOST_PREFIX = 'ghost:';

/**
 * Cierres con despedida: «Salir» (1000), cerrar o dejar la pestaña (1001) y
 * cierre sin código (1005). Todo lo demás (1006, 1011…) es una caída y se le
 * guarda el lugar.
 */
const GOODBYE_CODES: ReadonlySet<number> = new Set([1000, 1001, 1005]);

/**
 * Una instancia de sala (§13) con la WebSocket Hibernation API.
 *
 * - El estado de cada jugador vive en el attachment de su socket; la sala no
 *   guarda posiciones en storage ni en D1 (§14). Solo los lugares guardados
 *   por una caída van a storage, y se borran al volver o al vencer.
 * - No hay bucle: el movimiento se calcula al llegar cada input, y los
 *   estados se mandan en lotes con un temporizador que solo existe mientras
 *   hay cambios pendientes. El ping lo contesta el runtime sin despertarla.
 * - Una alarma limpia presencias muertas y lugares vencidos, y solo existe
 *   mientras hay alguien (conectado o con lugar guardado).
 * - Los portales se validan aquí (§16) y el cambio de sala se confirma en D1
 *   con el turno de presencia del socket (ADR-0009).
 */
export class RoomDO extends DurableObject<Env> {
  private meta: RoomMeta | null = null;
  private map: MapDef | null = null;
  private grid: CollisionGrid | null = null;
  private readonly ghosts = new Map<string, Ghost>();
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
      const ghosts = await ctx.storage.list<Ghost>({ prefix: GHOST_PREFIX });
      for (const [key, ghost] of ghosts) this.ghosts.set(key.slice(GHOST_PREFIX.length), ghost);
    });
  }

  async ping(): Promise<'pong'> {
    return 'pong';
  }

  /** Jugadores presentes (sockets vivos que representan a alguien). */
  private live(): { ws: WebSocket; att: PlayerAttachment }[] {
    const out: { ws: WebSocket; att: PlayerAttachment }[] = [];
    for (const ws of this.ctx.getWebSockets()) {
      const att = attachmentOf(ws);
      if (att && !att.gone) out.push({ ws, att });
    }
    return out;
  }

  /** Cuántos lugares ocupados hay: conectados más lugares guardados. */
  private occupants(): number {
    return this.live().length + this.ghosts.size;
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
    await this.reapGhosts(now);

    // Una conexión con turno más viejo que la que ya está no gana (ADR-0009):
    // llegó tarde, y la persona ya entró desde otro lado.
    const ghost = this.ghosts.get(identity.characterId);
    const newer =
      this.live().some(({ att }) => att.id === identity.characterId && att.ep > identity.epoch) ||
      (ghost !== undefined && ghost.att.ep > identity.epoch);
    if (newer) {
      return this.reject('CONNECTION_REPLACED', WS_CLOSE.REPLACED, 'Entraste desde otro lado.');
    }

    // La misma persona en otra pestaña: la conexión nueva gana y hereda el lugar.
    let heredado: { x: number; y: number; f: Facing } | null = null;
    let from: 'socket' | 'ghost' | null = null;
    for (const old of this.ctx.getWebSockets(identity.characterId)) {
      const att = attachmentOf(old);
      if (!att || att.gone) continue;
      heredado = { ...positionAt(att, now, grid), f: att.f };
      from = 'socket';
      this.retire(old, att, 'replaced', WS_CLOSE.REPLACED, 'CONNECTION_REPLACED');
    }
    // Volvió dentro de la ventana de gracia: su lugar lo esperaba (§17).
    if (ghost) {
      heredado ??= { x: ghost.att.x, y: ghost.att.y, f: ghost.att.f };
      from ??= 'ghost';
      await this.forgetGhost(identity.characterId);
    }

    const present = this.live();
    if (!heredado && present.length + this.ghosts.size >= identity.hardLimit) {
      return this.reject('ROOM_FULL', WS_CLOSE.ROOM_FULL, 'La sala está llena.');
    }

    const base = spawnOf(map, identity.spawn);
    const occupied: Vec[] = [
      ...present.map(({ att }) => ({ x: att.x, y: att.y })),
      ...[...this.ghosts.values()].map((g) => ({ x: g.att.x, y: g.att.y })),
    ];
    const at = heredado
      ? { x: round3(heredado.x), y: round3(heredado.y) }
      : chooseSpawn(base, occupied, grid);
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
      ep: identity.epoch,
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
        players: [
          toPlayerView(att),
          ...others.map((p) => toPlayerView(p.att)),
          ...[...this.ghosts.values()].map((g) => toPlayerView(g.att, true)),
        ],
        serverTime: now,
      },
    });
    // También a quien vuelve: así los demás le quitan la marca de «se le cayó».
    this.broadcast(
      { v: WS_PROTOCOL_VERSION, type: 'PLAYER_JOINED', payload: { player: toPlayerView(att) } },
      server,
    );
    this.log.info('room.joined', {
      room: identity.instance,
      map: map.id,
      characterId: att.id,
      players: others.length + 1,
      inherited: from,
      arrival: identity.spawn ?? null,
    });

    await this.scheduleAlarm(now);
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
    const att = attachmentOf(ws);
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
      case 'ENTER_PORTAL':
        return this.onPortal(ws, att, parsed.data, now);
    }
  }

  private onInput(
    ws: WebSocket,
    att: PlayerAttachment,
    msg: PlayerInputMessage,
    now: number,
  ): void {
    // Cruzando un portal ya no se camina: lo que llegue en camino se ignora sin falta.
    if (att.tr) {
      ws.serializeAttachment(att);
      return;
    }
    if (now - att.win >= 1000) {
      att.win = now;
      att.n = 0;
    }
    att.n += 1;
    if (att.n > NETWORK.maxInputsPerSecond) {
      this.strike(ws, att, 'RATE_LIMITED');
      return;
    }
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

  /**
   * Cruzar un portal (§16): existe, lo alcanzas desde donde el servidor te
   * tiene AHORA, no vas ya en camino y tu turno sigue vigente. El destino
   * sale del mapa, nunca del mensaje. Se confirma en D1 y hasta entonces se
   * avisa y se cierra: el cliente vuelve a entrar y el Worker lo lleva.
   */
  private async onPortal(
    ws: WebSocket,
    att: PlayerAttachment,
    msg: EnterPortalMessage,
    now: number,
  ): Promise<void> {
    if (att.tr) {
      ws.serializeAttachment(att);
      this.sendError(ws, 'INVALID_STATE', 'Ya vas en camino.');
      return;
    }
    if (att.pt !== undefined && now - att.pt < PORTALS.minIntervalMs) {
      this.strike(ws, att, 'RATE_LIMITED');
      return;
    }
    att.pt = now;
    const map = this.map as MapDef;
    const grid = this.grid as CollisionGrid;
    const portal = map.portals.find((p) => p.id === msg.payload.portalId);
    const destination = portal ? getMap(portal.to.map) : undefined;
    if (!portal || !destination) {
      ws.serializeAttachment(att);
      this.sendError(ws, 'PORTAL_NOT_FOUND', 'Aquí no hay esa puerta.');
      return;
    }
    const here = positionAt(att, now, grid);
    if (!canReachPortal(here, portal)) {
      ws.serializeAttachment(att);
      this.sendError(ws, 'PORTAL_NOT_REACHABLE', 'Acércate más a la puerta.');
      return;
    }

    // En camino ANTES de cualquier espera: D1 y el directorio no pasan por la
    // compuerta de entrada del objeto, así que otros mensajes pueden colarse.
    const crossing: PlayerAttachment = {
      ...att,
      x: round3(here.x),
      y: round3(here.y),
      mx: 0,
      my: 0,
      at: now,
      tr: 1,
    };
    ws.serializeAttachment(crossing);
    this.dirty.add(crossing.id);
    this.scheduleFlush();

    let moved: boolean;
    try {
      moved = await moveCharacter(this.env.DB, att.id, att.ep, destination.id);
    } catch (err) {
      this.log.error('room.portal_failed', { characterId: att.id, error: String(err) });
      const latest = attachmentOf(ws);
      if (latest && !latest.gone) {
        delete latest.tr;
        ws.serializeAttachment(latest);
        this.sendError(ws, 'INVALID_STATE', 'No se pudo cruzar. Intenta otra vez.');
      }
      return;
    }
    if (!moved) {
      // Otra conexión de la misma persona tomó turno después: este socket ya
      // no la representa. Se avisa la salida por si esa conexión nunca llega.
      this.log.info('room.portal_superseded', { characterId: att.id, epoch: att.ep });
      const latest = attachmentOf(ws);
      if (latest && !latest.gone) {
        this.retire(ws, latest, 'replaced', WS_CLOSE.REPLACED, 'CONNECTION_REPLACED', true);
      }
      return;
    }

    // El destino ya es oficial. La sala de destino anota dónde aparece.
    try {
      await this.directoryFor(destination.id).expectArrival(
        att.id,
        portal.to.spawn,
        Date.now() + PORTALS.arrivalTtlMs,
      );
    } catch (err) {
      // Sin la llegada anotada aparece en el punto por defecto: no impide cruzar.
      this.log.warn('room.arrival_failed', { characterId: att.id, error: String(err) });
    }

    const latest = attachmentOf(ws);
    if (!latest || latest.gone) {
      // Se le cayó la conexión a medio cruce: ya pertenece a la otra sala y
      // aquí no se le guarda lugar.
      if (this.ghosts.has(att.id)) await this.expireGhost(att.id, 'portal');
      return;
    }
    this.send(ws, {
      v: WS_PROTOCOL_VERSION,
      type: 'ROOM_TRANSFER',
      payload: { portalId: portal.id, to: { mapId: destination.id, name: destination.name } },
    });
    this.log.info('room.portal', { characterId: att.id, portal: portal.id, to: destination.id });
    this.retire(ws, latest, 'portal', WS_CLOSE.TRANSFER);
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
        const att = attachmentOf(ws);
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
    await this.onGone(ws, code);
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.onGone(ws, 1011);
  }

  /**
   * El socket se cerró. Con despedida, la persona se va ya; si se cayó, la
   * sala le guarda el lugar `graceAfterDropMs` (§17): los demás la ven quieta
   * y marcada, y si vuelve a tiempo sigue donde estaba.
   */
  private async onGone(ws: WebSocket, code: number): Promise<void> {
    const att = attachmentOf(ws);
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code, 'adiós');
    } catch {
      // Ya estaba cerrado.
    }
    if (!att || att.gone) return;
    const now = Date.now();
    const otherSocket = this.live().some((p) => p.ws !== ws && p.att.id === att.id);
    if (GOODBYE_CODES.has(code) || otherSocket || !this.grid) {
      att.gone = 'left';
      ws.serializeAttachment(att);
      this.announceLeave(att.id, 'left');
      return;
    }

    att.gone = 'stale';
    ws.serializeAttachment(att);
    this.dirty.delete(att.id);
    const here = positionAt(att, now, this.grid);
    const kept: PlayerAttachment = {
      ...att,
      x: round3(here.x),
      y: round3(here.y),
      mx: 0,
      my: 0,
      at: now,
      seen: now,
    };
    delete kept.gone;
    const ghost: Ghost = { att: kept, until: now + NETWORK.graceAfterDropMs };
    this.ghosts.set(att.id, ghost);
    await this.ctx.storage.put(GHOST_PREFIX + att.id, ghost);
    this.broadcast({
      v: WS_PROTOCOL_VERSION,
      type: 'PLAYER_STATE',
      payload: { states: [toStateView(kept, true)], serverTime: now },
    });
    this.log.info('room.dropped', { characterId: att.id, code, graceMs: NETWORK.graceAfterDropMs });
    await this.scheduleAlarm(now);
  }

  /**
   * Saca a alguien de la sala: lo marca, avisa a los demás (si no sigue en
   * otro socket) y cierra con código. El cierre posterior del cliente ya no
   * vuelve a anunciar nada. Un reemplazo normal no se anuncia: la conexión
   * nueva ya está entrando a esta misma sala.
   */
  private retire(
    ws: WebSocket,
    att: PlayerAttachment,
    why: Exclude<GoneReason, 'left'>,
    closeCode: WsCloseCode,
    errorCode?: WsErrorCode,
    announce = why !== 'replaced',
  ): void {
    att.gone = why;
    ws.serializeAttachment(att);
    if (errorCode) this.sendError(ws, errorCode, 'Entraste desde otro lado.');
    try {
      ws.close(closeCode, why);
    } catch {
      // Ya estaba cerrado.
    }
    if (announce) this.announceLeave(att.id, why);
  }

  private announceLeave(id: string, reason: GoneReason): void {
    this.dirty.delete(id);
    if (this.ghosts.has(id) || this.live().some((p) => p.att.id === id)) return;
    this.broadcast({ v: WS_PROTOCOL_VERSION, type: 'PLAYER_LEFT', payload: { id, reason } });
    const remaining = this.occupants();
    this.log.info('room.left', { characterId: id, reason, players: remaining });
    this.reportOccupancy({ left: id });
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

  /** Lugares guardados que vencieron: esa persona ya no volvió. */
  private async reapGhosts(now: number): Promise<void> {
    for (const [id, ghost] of this.ghosts) {
      if (ghost.until <= now) await this.expireGhost(id, 'stale');
    }
  }

  private async forgetGhost(id: string): Promise<void> {
    this.ghosts.delete(id);
    await this.ctx.storage.delete(GHOST_PREFIX + id);
  }

  private async expireGhost(id: string, reason: 'stale' | 'portal'): Promise<void> {
    await this.forgetGhost(id);
    this.announceLeave(id, reason);
  }

  // ─── Alarma solo con gente ──────────────────────────────────────────────

  /** La próxima revisión: la mitad de la ventana de presencia o el lugar guardado que vence antes. */
  private async scheduleAlarm(now: number): Promise<void> {
    let next = now + NETWORK.staleAfterMs / 2;
    for (const ghost of this.ghosts.values()) next = Math.min(next, ghost.until);
    const current = await this.ctx.storage.getAlarm();
    if (current === null || current > next) await this.ctx.storage.setAlarm(next);
  }

  override async alarm(): Promise<void> {
    const now = Date.now();
    this.reapStale(now);
    await this.reapGhosts(now);
    if (this.occupants() > 0) await this.scheduleAlarm(now);
  }

  // ─── Directorio ─────────────────────────────────────────────────────────

  private directoryFor(mapId: MapId) {
    return this.env.ROOM_DIRECTORY.get(
      this.env.ROOM_DIRECTORY.idFromName(directoryObjectName(mapId)),
    );
  }

  private reportOccupancy(change: { joined?: string; left?: string }): void {
    const meta = this.meta;
    if (!meta) return;
    const count = this.occupants();
    this.ctx.waitUntil(
      this.directoryFor(meta.mapId)
        .report(meta.instance, count, change, Date.now())
        .catch((err: unknown) => {
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

function attachmentOf(ws: WebSocket): PlayerAttachment | null {
  return ws.deserializeAttachment() as PlayerAttachment | null;
}
