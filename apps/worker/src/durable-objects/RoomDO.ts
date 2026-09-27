import { DurableObject } from 'cloudflare:workers';
import { CHAT, EMOTE, NETWORK, PORTALS, SEATS, SOCIAL, TIME } from '@wous/config';
import {
  type ChatSendMessage,
  ClientMessage,
  type EmotePlayMessage,
  type EnterPortalMessage,
  type PlayerInputMessage,
  type ReportPlayerMessage,
  type ServerMessage,
  type SitMessage,
  sanitizeChat,
  WS_CLOSE,
  WS_MAX_CLIENT_MESSAGE,
  WS_PING_TEXT,
  WS_PONG_TEXT,
  WS_PROTOCOL_VERSION,
  type WsCloseCode,
  WsEnvelopeHeader,
  type WsErrorCode,
} from '@wous/contracts';
import { type CollisionGrid, canStandAt, type Facing, type Vec } from '@wous/game-core';
import {
  canReachPortal,
  canReachSeat,
  collisionGrid,
  getMap,
  type MapDef,
  type MapId,
  seatOf,
  spawnOf,
} from '@wous/world-data';
import { systemClock } from '../lib/clock.ts';
import { createIdGenerator } from '../lib/ids.ts';
import { createLogger, type Logger } from '../lib/log.ts';
import {
  buildEvidence,
  CHAT_PREFIX,
  type ChatRecord,
  pruneRecent,
  type ReportTarget,
  slidingWindow,
  textPrint,
  toLine,
} from '../world/chat.ts';
import { moveCharacter } from '../world/location.ts';
import {
  addStrike,
  applyInput,
  chooseSpawn,
  decodeIdentity,
  directoryObjectName,
  type GoneReason,
  IDENTITY_HEADER,
  type PlayerAttachment,
  positionAt,
  type RoomIdentity,
  roomRef,
  round3,
  sitDown,
  standUp,
  toPlayerView,
  toStateView,
} from '../world/players.ts';
import {
  addBlock,
  type BlockEdge,
  blockEdge,
  insertReport,
  loadBlockEdges,
  removeBlock,
  reviewStanding,
} from '../world/social.ts';

type RoomMeta = { mapId: MapId; instance: string };
const META_KEY = 'meta';

/**
 * El lugar de alguien a quien se le cayó la conexión (§17). Vive en storage
 * porque tiene que sobrevivir a la hibernación: si la sala se duerme con un
 * lugar guardado en memoria, nadie avisaría nunca que esa persona se fue.
 */
type Ghost = { att: PlayerAttachment; until: number };
const GHOST_PREFIX = 'ghost:';

/** Bloqueos entre la gente presente (ADR-0010): sobreviven a la hibernación. */
const EDGES_KEY = 'blocks';

/**
 * Cierres con despedida: «Salir» (1000), cerrar o dejar la pestaña (1001) y
 * cierre sin código (1005). Todo lo demás (1006, 1011…) es una caída y se le
 * guarda el lugar.
 */
const GOODBYE_CODES: ReadonlySet<number> = new Set([1000, 1001, 1005]);

type ErrorExtra = { about?: string; retryAfterMs?: number };

/**
 * Una instancia de sala (§13) con la WebSocket Hibernation API.
 *
 * - El estado de cada jugador vive en el attachment de su socket; la sala no
 *   guarda posiciones en storage ni en D1 (§14). Solo los lugares guardados
 *   por una caída van a storage, y se borran al volver o al vencer.
 * - No hay bucle: el movimiento se calcula al llegar cada input, y los
 *   estados se mandan en lotes con un temporizador que solo existe mientras
 *   hay cambios pendientes. El ping lo contesta el runtime sin despertarla.
 * - Una alarma limpia presencias muertas y lugares vencidos, revisa en D1 que
 *   quien sigue conectado pueda seguir (ADR-0010) y solo existe mientras hay
 *   alguien (conectado o con lugar guardado).
 * - Los portales se validan aquí (§16) y el cambio de sala se confirma en D1
 *   con el turno de presencia del socket (ADR-0009).
 * - El chat (§18) se sanea aquí y se reparte por destinatario: nada cruza un
 *   bloqueo. La ventana reciente vive en storage unos minutos: de ahí, y solo
 *   de ahí, sale la evidencia de un reporte.
 */
export class RoomDO extends DurableObject<Env> {
  private meta: RoomMeta | null = null;
  private map: MapDef | null = null;
  private grid: CollisionGrid | null = null;
  private readonly ghosts = new Map<string, Ghost>();
  private readonly dirty = new Set<string>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  /** Mensajes recientes, del más viejo al más nuevo (espejo de `chat:*` en storage). */
  private readonly recent: ChatRecord[] = [];
  /** Bloqueos «cuenta>cuenta» entre gente presente (o entrando). */
  private readonly edges = new Set<BlockEdge>();
  /** Cuentas que están entrando (consultando sus bloqueos en D1). */
  private readonly joining = new Map<string, number>();
  private readonly ids = createIdGenerator(systemClock);
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
      const chat = await ctx.storage.list<ChatRecord>({ prefix: CHAT_PREFIX });
      this.recent.push(...[...chat.values()].sort((a, b) => a.at - b.at));
      for (const edge of (await ctx.storage.get<BlockEdge[]>(EDGES_KEY)) ?? [])
        this.edges.add(edge);
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
    const identity = decodeIdentity(raw);

    if (!this.meta) {
      const meta = { mapId: identity.mapId, instance: identity.instance };
      this.useMap(meta);
      await this.ctx.storage.put(META_KEY, meta);
    }
    const map = this.map as MapDef;
    const grid = this.grid as CollisionGrid;
    this.reapStale(Date.now());
    await this.reapGhosts(Date.now());

    // Una conexión con turno más viejo que la que ya está no gana (ADR-0009):
    // llegó tarde, y la persona ya entró desde otro lado.
    if (this.isOutdated(identity)) {
      return this.reject('CONNECTION_REPLACED', WS_CLOSE.REPLACED, 'Entraste desde otro lado.');
    }
    // Los bloqueos con quien ya está, ANTES de tocar nada: si D1 falla, la
    // sala queda como estaba y la persona reintenta (ADR-0010).
    const edges = await this.edgesFor(identity.accountId);
    // Mientras se consultaba D1 pudo llegar otra conexión suya, más nueva.
    if (this.isOutdated(identity)) {
      return this.reject('CONNECTION_REPLACED', WS_CLOSE.REPLACED, 'Entraste desde otro lado.');
    }
    const now = Date.now();

    // La misma persona en otra pestaña: la conexión nueva gana y hereda el lugar.
    // Con su asiento: quien estaba sentado sigue sentado.
    let heredado: { x: number; y: number; f: Facing; st?: string } | null = null;
    let from: 'socket' | 'ghost' | null = null;
    for (const old of this.ctx.getWebSockets(identity.characterId)) {
      const att = attachmentOf(old);
      if (!att || att.gone) continue;
      heredado = { ...positionAt(att, now, grid), f: att.f, ...seatPart(att) };
      from = 'socket';
      this.retire(old, att, 'replaced', WS_CLOSE.REPLACED, 'CONNECTION_REPLACED');
    }
    // Volvió dentro de la ventana de gracia: su lugar lo esperaba (§17).
    const ghost = this.ghosts.get(identity.characterId);
    if (ghost) {
      heredado ??= { x: ghost.att.x, y: ghost.att.y, f: ghost.att.f, ...seatPart(ghost.att) };
      from ??= 'ghost';
      await this.forgetGhost(identity.characterId);
    }
    // El lugar guardado pudo quedar de otra versión del mapa (un despliegue a
    // media ventana de gracia): si ya no cabe, entra como recién llegada.
    if (heredado && !lugarValido(map, grid, heredado)) heredado = null;

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
      ...(heredado?.st !== undefined ? { st: heredado.st } : {}),
      seen: now,
      win: now,
      n: 0,
      strikes: 0,
      ep: identity.epoch,
      ...(identity.mutedUntil !== undefined && identity.mutedUntil > now
        ? { mu: identity.mutedUntil }
        : {}),
    };

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server, [identity.characterId]);
    server.serializeAttachment(att);
    this.addEdges(edges);

    const others = present.filter((p) => p.att.id !== att.id);
    const ghostViews = [...this.ghosts.values()].map((g) => g.att);
    const blockedHere = [...others.map((p) => p.att), ...ghostViews]
      .filter((o) => this.edges.has(blockEdge(att.acc, o.acc)))
      .map((o) => o.id);
    this.send(server, {
      v: WS_PROTOCOL_VERSION,
      type: 'ROOM_SNAPSHOT',
      payload: {
        room: roomRef(map, identity.instance),
        selfId: att.id,
        players: [
          toPlayerView(att),
          ...others.map((p) => toPlayerView(p.att)),
          ...ghostViews.map((g) => toPlayerView(g, true)),
        ],
        serverTime: now,
        ...(blockedHere.length > 0 ? { blocked: blockedHere } : {}),
      },
    });
    // También a quien vuelve: así los demás le quitan la marca de «se le cayó».
    this.broadcast(
      { v: WS_PROTOCOL_VERSION, type: 'PLAYER_JOINED', payload: { player: toPlayerView(att) } },
      server,
    );
    // Quien ya estaba y bloqueó a quien llega lo sabe; la persona bloqueada no.
    for (const other of others) {
      if (!this.edges.has(blockEdge(other.att.acc, att.acc))) continue;
      this.send(other.ws, {
        v: WS_PROTOCOL_VERSION,
        type: 'PLAYER_BLOCKED',
        payload: { characterId: att.id, blocked: true },
      });
    }
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

  /** ¿Ya hay una conexión de esta persona con un turno más nuevo? */
  private isOutdated(identity: RoomIdentity): boolean {
    const ghost = this.ghosts.get(identity.characterId);
    return (
      this.live().some(({ att }) => att.id === identity.characterId && att.ep > identity.epoch) ||
      (ghost !== undefined && ghost.att.ep > identity.epoch)
    );
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
    if (!parsed.success) {
      return this.strike(ws, att, 'INVALID_MESSAGE', header.success ? header.data.type : undefined);
    }

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
      case 'CHAT_SEND':
        return this.onChat(ws, att, parsed.data, now);
      case 'EMOTE_PLAY':
        return this.onEmote(ws, att, parsed.data, now);
      case 'REPORT_PLAYER':
        return this.onReport(ws, att, parsed.data, now);
      case 'BLOCK_PLAYER':
        return this.onBlock(ws, att, parsed.data.payload.characterId, true, now);
      case 'UNBLOCK_PLAYER':
        return this.onBlock(ws, att, parsed.data.payload.characterId, false, now);
      case 'SIT':
        return this.onSit(ws, att, parsed.data, now);
      case 'STAND':
        return this.onStand(ws, att, now);
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
      // Los de más en este segundo se ignoran: el servidor manda igual. Solo
      // el primero cuenta como falta (y avisa una vez); castigar cada uno
      // corría en segundos a un joystick honesto que cambia en cada cuadro.
      if (att.n === NETWORK.maxInputsPerSecond + 1) {
        this.strike(ws, att, 'RATE_LIMITED', 'PLAYER_INPUT');
      } else {
        ws.serializeAttachment(att);
      }
      return;
    }
    // Secuencias viejas o repetidas no cuentan (§14.1).
    if (msg.seq <= att.seq) {
      ws.serializeAttachment(att);
      return;
    }
    const seat = att.st !== undefined ? seatOf(this.map as MapDef, att.st) : undefined;
    const next = applyInput(
      att,
      { ...msg.payload, seq: msg.seq },
      now,
      this.grid as CollisionGrid,
      seat,
    );
    ws.serializeAttachment(next);
    this.dirty.add(next.id);
    this.scheduleFlush();
  }

  // ─── Asientos (ADR-0013) ────────────────────────────────────────────────

  /**
   * Sentarse: el asiento existe en ESTE mapa, lo alcanzas desde donde la
   * sala te tiene ahora (o desde donde te levantarías, si ya estás sentado
   * en otro) y nadie más lo ocupa, ni quien se desconectó y tiene su lugar
   * guardado. La sala no espera nada entre revisar y sentar: nadie se cuela.
   */
  private onSit(ws: WebSocket, att: PlayerAttachment, msg: SitMessage, now: number): void {
    const about = { about: 'SIT' };
    if (att.tr) {
      ws.serializeAttachment(att);
      this.sendError(ws, 'INVALID_STATE', 'Ya vas en camino.', about);
      return;
    }
    if (att.sa !== undefined && now - att.sa < SEATS.minIntervalMs) {
      this.strike(ws, att, 'RATE_LIMITED', 'SIT', 'Con calma: una vez basta.');
      return;
    }
    att.sa = now;
    const map = this.map as MapDef;
    const seat = seatOf(map, msg.payload.seatId);
    if (!seat) {
      ws.serializeAttachment(att);
      this.sendError(ws, 'SEAT_NOT_FOUND', 'Aquí no hay ese asiento.', about);
      return;
    }
    if (att.st === seat.id) {
      ws.serializeAttachment(att);
      return;
    }
    const current = att.st !== undefined ? seatOf(map, att.st) : undefined;
    const here = current ? current.exit : positionAt(att, now, this.grid as CollisionGrid);
    if (!canReachSeat(here, seat, SEATS.reach)) {
      ws.serializeAttachment(att);
      this.sendError(ws, 'SEAT_NOT_REACHABLE', 'Acércate más para sentarte.', about);
      return;
    }
    if (this.seatTaken(seat.id, att.id)) {
      ws.serializeAttachment(att);
      this.sendError(ws, 'SEAT_TAKEN', 'Ya hay alguien sentado ahí.', about);
      return;
    }
    const next = sitDown(att, seat, now);
    ws.serializeAttachment(next);
    this.dirty.add(next.id);
    this.scheduleFlush();
  }

  /** Levantarse: de pie en la salida del asiento. Sin asiento, no pasa nada. */
  private onStand(ws: WebSocket, att: PlayerAttachment, now: number): void {
    if (att.st === undefined || att.tr) {
      ws.serializeAttachment(att);
      return;
    }
    const next = standUp(att, seatOf(this.map as MapDef, att.st), now);
    ws.serializeAttachment(next);
    this.dirty.add(next.id);
    this.scheduleFlush();
  }

  /** ¿Alguien más (presente o con lugar guardado) está sentado ahí? */
  private seatTaken(seatId: string, except: string): boolean {
    if (this.live().some(({ att }) => att.st === seatId && att.id !== except)) return true;
    for (const ghost of this.ghosts.values()) {
      if (ghost.att.st === seatId && ghost.att.id !== except) return true;
    }
    return false;
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
    const about = { about: 'ENTER_PORTAL' };
    if (att.tr) {
      ws.serializeAttachment(att);
      this.sendError(ws, 'INVALID_STATE', 'Ya vas en camino.', about);
      return;
    }
    if (att.pt !== undefined && now - att.pt < PORTALS.minIntervalMs) {
      this.strike(ws, att, 'RATE_LIMITED', 'ENTER_PORTAL');
      return;
    }
    att.pt = now;
    const map = this.map as MapDef;
    const grid = this.grid as CollisionGrid;
    const portal = map.portals.find((p) => p.id === msg.payload.portalId);
    const destination = portal ? getMap(portal.to.map) : undefined;
    if (!portal || !destination) {
      ws.serializeAttachment(att);
      this.sendError(ws, 'PORTAL_NOT_FOUND', 'Aquí no hay esa puerta.', about);
      return;
    }
    // Sentado, se mide desde donde te levantarías: se cruza de pie.
    const sentado = att.st !== undefined ? seatOf(map, att.st) : undefined;
    const here = sentado ? sentado.exit : positionAt(att, now, grid);
    if (!canReachPortal(here, portal)) {
      ws.serializeAttachment(att);
      this.sendError(ws, 'PORTAL_NOT_REACHABLE', 'Acércate más a la puerta.', about);
      return;
    }

    // En camino ANTES de cualquier espera: D1 y el directorio no pasan por la
    // compuerta de entrada del objeto, así que otros mensajes pueden colarse.
    const { st: _asiento, ...dePie } = att;
    const crossing: PlayerAttachment = {
      ...dePie,
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
        this.sendError(ws, 'INVALID_STATE', 'No se pudo cruzar. Intenta otra vez.', about);
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

  // ─── Chat y gestos ──────────────────────────────────────────────────────

  /**
   * Decir algo (§18). Silencio de moderación, flood, saneado y repetición, en
   * ese orden. Lo que se reparte es el texto saneado del servidor, a cada
   * quien por separado: entre dos personas con un bloqueo no cruza nada.
   * Quien habla también lo recibe: es su confirmación.
   */
  private onChat(ws: WebSocket, att: PlayerAttachment, msg: ChatSendMessage, now: number): void {
    const about = 'CHAT_SEND';
    if (att.mu !== undefined && att.mu > now) {
      ws.serializeAttachment(att);
      this.sendError(ws, 'CHAT_MUTED', 'Moderación te pidió una pausa en el chat.', {
        about,
        retryAfterMs: att.mu - now,
      });
      return;
    }
    const flood = slidingWindow(att.cw, now, CHAT.rate);
    att.cw = flood.stamps;
    if (!flood.allowed) {
      this.log.warn('room.chat_flood', { characterId: att.id });
      this.strike(ws, att, 'RATE_LIMITED', about, 'Vas muy rápido. Espera tantito.', {
        retryAfterMs: flood.retryAfterMs,
      });
      return;
    }
    const clean = sanitizeChat(msg.payload.text);
    if (!clean.ok) {
      ws.serializeAttachment(att);
      const texto =
        clean.reason === 'TOO_LONG'
          ? `Cabe hasta ${CHAT.maxChars} caracteres.`
          : 'Ese mensaje está vacío.';
      this.sendError(ws, 'CHAT_REJECTED', texto, { about });
      return;
    }
    const print = textPrint(clean.text);
    if (att.cp === print && att.ct !== undefined && now - att.ct < CHAT.repeatWindowMs) {
      ws.serializeAttachment(att);
      this.sendError(ws, 'CHAT_REJECTED', 'Eso ya lo dijiste.', {
        about,
        retryAfterMs: att.ct + CHAT.repeatWindowMs - now,
      });
      return;
    }
    att.cp = print;
    att.ct = now;
    ws.serializeAttachment(att);

    const record: ChatRecord = {
      id: this.ids.next('message'),
      from: att.id,
      name: att.name,
      text: clean.text,
      at: now,
      acc: att.acc,
    };
    this.remember(record, now);
    this.deliver(
      { v: WS_PROTOCOL_VERSION, type: 'CHAT_MESSAGE', payload: { message: toLine(record) } },
      att.acc,
    );
  }

  /** Un gesto del catálogo (§19), con enfriamiento. Tampoco cruza bloqueos. */
  private onEmote(ws: WebSocket, att: PlayerAttachment, msg: EmotePlayMessage, now: number): void {
    if (att.tr) {
      ws.serializeAttachment(att);
      return;
    }
    if (att.eg !== undefined && now - att.eg < EMOTE.cooldownMs) {
      this.strike(ws, att, 'RATE_LIMITED', 'EMOTE_PLAY', 'Un gesto a la vez.', {
        retryAfterMs: att.eg + EMOTE.cooldownMs - now,
      });
      return;
    }
    att.eg = now;
    ws.serializeAttachment(att);
    this.deliver(
      {
        v: WS_PROTOCOL_VERSION,
        type: 'EMOTE_PLAYED',
        payload: { id: att.id, emote: msg.payload.emote },
      },
      att.acc,
    );
  }

  /** Guarda un mensaje en la ventana reciente (memoria y storage) y tira lo vencido. */
  private remember(record: ChatRecord, now: number): void {
    this.recent.push(record);
    const dropped = pruneRecent(this.recent, now);
    const storage = this.ctx.storage;
    // Sin confirmar: el chat no espera a que el disco conteste para repartirse.
    storage
      .put(CHAT_PREFIX + record.id, record, { allowUnconfirmed: true })
      .catch((err: unknown) => this.log.warn('room.chat_store_failed', { error: String(err) }));
    if (dropped.length > 0) {
      storage
        .delete(
          dropped.map((id) => CHAT_PREFIX + id),
          { allowUnconfirmed: true },
        )
        .catch((err: unknown) => this.log.warn('room.chat_store_failed', { error: String(err) }));
    }
  }

  private pruneChat(now: number): void {
    const dropped = pruneRecent(this.recent, now);
    if (dropped.length === 0) return;
    this.ctx.waitUntil(
      this.ctx.storage
        .delete(dropped.map((id) => CHAT_PREFIX + id))
        .catch((err: unknown) => this.log.warn('room.chat_store_failed', { error: String(err) })),
    );
  }

  /** Sala vacía: la conversación no se queda guardada para nadie (§30). */
  private async forgetChat(): Promise<void> {
    this.recent.length = 0;
    const keys = [...(await this.ctx.storage.list({ prefix: CHAT_PREFIX })).keys()];
    for (let i = 0; i < keys.length; i += 128) {
      await this.ctx.storage.delete(keys.slice(i, i + 128));
    }
  }

  // ─── Bloqueos y reportes ────────────────────────────────────────────────

  /**
   * Bloqueos entre quien entra y la gente de la sala (presente, con lugar
   * guardado o entrando a la vez). Quien entra se anota ANTES de consultar:
   * así, si dos personas entran a la vez, al menos una de las dos consultas
   * incluye a la otra.
   */
  private async edgesFor(accountId: string): Promise<BlockEdge[]> {
    const others = new Set<string>();
    for (const { att } of this.live()) others.add(att.acc);
    for (const ghost of this.ghosts.values()) others.add(ghost.att.acc);
    for (const acc of this.joining.keys()) others.add(acc);
    others.delete(accountId);
    this.joining.set(accountId, (this.joining.get(accountId) ?? 0) + 1);
    try {
      return await loadBlockEdges(this.env.DB, accountId, [...others]);
    } finally {
      const left = (this.joining.get(accountId) ?? 1) - 1;
      if (left > 0) this.joining.set(accountId, left);
      else this.joining.delete(accountId);
    }
  }

  private addEdges(edges: readonly BlockEdge[]): void {
    let changed = false;
    for (const edge of edges) {
      if (this.edges.has(edge)) continue;
      this.edges.add(edge);
      changed = true;
    }
    if (changed) this.saveEdges();
  }

  /** Sin bloqueo en ninguna dirección entre dos cuentas. */
  private blocked(a: string, b: string): boolean {
    return this.edges.has(blockEdge(a, b)) || this.edges.has(blockEdge(b, a));
  }

  /** Solo quedan los bloqueos entre gente que sigue aquí (o entrando). */
  private pruneEdges(): void {
    if (this.edges.size === 0) return;
    const here = new Set<string>(this.joining.keys());
    for (const { att } of this.live()) here.add(att.acc);
    for (const ghost of this.ghosts.values()) here.add(ghost.att.acc);
    let changed = false;
    for (const edge of this.edges) {
      const [a = '', b = ''] = edge.split('>');
      if (here.has(a) && here.has(b)) continue;
      this.edges.delete(edge);
      changed = true;
    }
    if (changed) this.saveEdges();
  }

  private saveEdges(): void {
    const storage = this.ctx.storage;
    const write =
      this.edges.size > 0 ? storage.put(EDGES_KEY, [...this.edges]) : storage.delete(EDGES_KEY);
    this.ctx.waitUntil(
      Promise.resolve(write).catch((err: unknown) =>
        this.log.error('room.edges_store_failed', { error: String(err) }),
      ),
    );
  }

  /** ¿Cabe otra acción social en el minuto? Si no, cuenta como falta. */
  private socialAllowed(ws: WebSocket, att: PlayerAttachment, now: number, about: string): boolean {
    const check = slidingWindow(att.sw, now, {
      limit: SOCIAL.actionsPerMinute,
      windowMs: TIME.MINUTE,
    });
    att.sw = check.stamps;
    if (!check.allowed) {
      this.strike(ws, att, 'RATE_LIMITED', about, 'Con calma: espera un momento.', {
        retryAfterMs: check.retryAfterMs,
      });
      return false;
    }
    ws.serializeAttachment(att);
    return true;
  }

  /**
   * A quién se refiere un ID: alguien presente, con lugar guardado o que
   * habló hace poco (se puede bloquear o reportar a quien acaba de irse).
   */
  private whoIs(characterId: string): ReportTarget | null {
    for (const { att } of this.live()) {
      if (att.id === characterId) {
        return {
          characterId,
          accountId: att.acc,
          displayName: att.name,
          appearance: att.look,
        };
      }
    }
    const ghost = this.ghosts.get(characterId);
    if (ghost) {
      return {
        characterId,
        accountId: ghost.att.acc,
        displayName: ghost.att.name,
        appearance: ghost.att.look,
      };
    }
    for (let i = this.recent.length - 1; i >= 0; i--) {
      const record = this.recent[i] as ChatRecord;
      if (record.from === characterId) {
        return { characterId, accountId: record.acc, displayName: record.name, appearance: null };
      }
    }
    return null;
  }

  /**
   * Bloquear o desbloquear (ADR-0010). Se escribe en D1 y se aplica en el
   * acto en esta sala. Solo quien bloquea recibe la confirmación.
   */
  private async onBlock(
    ws: WebSocket,
    att: PlayerAttachment,
    characterId: string,
    block: boolean,
    now: number,
  ): Promise<void> {
    const about = block ? 'BLOCK_PLAYER' : 'UNBLOCK_PLAYER';
    if (!this.socialAllowed(ws, att, now, about)) return;
    if (characterId === att.id) {
      this.sendError(ws, 'FORBIDDEN', 'No puedes bloquearte a ti.', { about });
      return;
    }
    const target = this.whoIs(characterId);
    if (!target) {
      this.sendError(ws, 'PLAYER_NOT_FOUND', 'Esa persona ya no está aquí.', { about });
      return;
    }
    let limited = false;
    try {
      if (block)
        limited = (await addBlock(this.env.DB, att.acc, target.accountId, now)) === 'limit';
      else await removeBlock(this.env.DB, att.acc, target.accountId);
    } catch (err) {
      this.log.error('room.block_failed', { characterId: att.id, error: String(err) });
      if (isLive(ws))
        this.sendError(ws, 'INVALID_STATE', 'No se pudo. Intenta otra vez.', { about });
      return;
    }
    if (limited) {
      if (isLive(ws)) {
        this.sendError(ws, 'LIMIT_REACHED', 'Ya bloqueaste a demasiadas personas.', { about });
      }
      return;
    }
    const edge = blockEdge(att.acc, target.accountId);
    if (block !== this.edges.has(edge)) {
      if (block) this.edges.add(edge);
      else this.edges.delete(edge);
      this.saveEdges();
    }
    this.log.info(block ? 'room.block' : 'room.unblock', {
      characterId: att.id,
      targetId: characterId,
    });
    if (!isLive(ws)) return;
    this.send(ws, {
      v: WS_PROTOCOL_VERSION,
      type: 'PLAYER_BLOCKED',
      payload: { characterId, blocked: block },
    });
  }

  /**
   * Un bloqueo que se hizo fuera de la sala, desde la lista de amigos
   * (ADR-0011): ya está en D1 y aquí aplica en el acto, como si se hubiera
   * hecho en la ficha. Solo quien bloquea recibe la confirmación. Si quien
   * bloquea ya no está, no hay nada que filtrar: al volver lo trae de D1.
   */
  async applyBlock(blocker: string, blocked: string, blockedCharacterId: string): Promise<void> {
    const mine = this.live().filter(({ att }) => att.acc === blocker);
    if (mine.length === 0) return;
    const edge = blockEdge(blocker, blocked);
    if (!this.edges.has(edge)) {
      this.edges.add(edge);
      this.saveEdges();
    }
    this.log.info('room.block', { characterId: mine[0]?.att.id, targetId: blockedCharacterId });
    for (const { ws } of mine) {
      this.send(ws, {
        v: WS_PROTOCOL_VERSION,
        type: 'PLAYER_BLOCKED',
        payload: { characterId: blockedCharacterId, blocked: true },
      });
    }
  }

  /**
   * La caseta cambió la situación de alguien que está aquí (ADR-0012):
   * silencio, suspensión, cierre o sesiones cerradas. La sala no recibe la
   * sanción: la vuelve a leer de D1 para todos los presentes, la misma
   * revisión que corre cada minuto, pero ya.
   */
  async recheck(): Promise<void> {
    await this.review(Date.now());
  }

  /**
   * Reportar (§18). La evidencia sale de la ventana reciente de ESTA sala:
   * el cliente dice qué mensaje (por ID), nunca qué decía. Un mensaje que no
   * es de la persona reportada es un cliente alterado y cuenta como falta.
   */
  private async onReport(
    ws: WebSocket,
    att: PlayerAttachment,
    msg: ReportPlayerMessage,
    now: number,
  ): Promise<void> {
    const about = 'REPORT_PLAYER';
    if (!this.socialAllowed(ws, att, now, about)) return;
    const { characterId, reason, messageId, note } = msg.payload;
    if (characterId === att.id) {
      this.sendError(ws, 'FORBIDDEN', 'No puedes reportarte a ti.', { about });
      return;
    }
    const target = this.whoIs(characterId);
    if (!target) {
      this.sendError(ws, 'PLAYER_NOT_FOUND', 'Esa persona ya no está aquí.', { about });
      return;
    }
    const built = buildEvidence(this.recent, target, messageId, now);
    if (!built.ok) {
      this.strike(ws, att, 'FORBIDDEN', about, 'Ese mensaje no es de esa persona.');
      return;
    }
    const meta = this.meta as RoomMeta;
    let outcome: 'created' | 'duplicate';
    try {
      outcome = await insertReport(this.env.DB, {
        id: this.ids.next('report'),
        reporterAccountId: att.acc,
        reporterCharacterId: att.id,
        targetAccountId: target.accountId,
        targetCharacterId: characterId,
        reason,
        note: cleanNote(note),
        messageId: built.evidence.message?.id ?? null,
        room: `${meta.mapId}:${meta.instance}`,
        evidence: built.evidence,
        createdAt: now,
      });
    } catch (err) {
      this.log.error('room.report_failed', { characterId: att.id, error: String(err) });
      if (isLive(ws))
        this.sendError(ws, 'INVALID_STATE', 'No se pudo enviar. Intenta otra vez.', { about });
      return;
    }
    this.log.info('room.report', {
      characterId: att.id,
      targetId: characterId,
      reason,
      duplicate: outcome === 'duplicate',
    });
    if (!isLive(ws)) return;
    // Repetido o nuevo, la respuesta es la misma: el que ya estaba sigue abierto.
    this.send(ws, { v: WS_PROTOCOL_VERSION, type: 'REPORT_ACCEPTED', payload: { characterId } });
  }

  /** Reparte a cada quien, salvo a quien tiene un bloqueo con `from` (en cualquier dirección). */
  private deliver(message: ServerMessage, from: string): void {
    const text = JSON.stringify(message);
    for (const { ws, att } of this.live()) {
      if (att.acc !== from && this.blocked(from, att.acc)) continue;
      try {
        ws.send(text);
      } catch {
        // Se está cerrando.
      }
    }
  }

  /**
   * Revisión de quien sigue conectado (ADR-0010): cuenta activa, sesión
   * vigente y silencio de moderación. Suspender o «cerrar sesión en todos
   * lados» saca a la persona aquí; un silencio nuevo aplica al siguiente
   * mensaje. Si D1 no contesta, se deja para la próxima vuelta.
   */
  private async review(now: number): Promise<void> {
    const people = this.live().map(({ att }) => ({ accountId: att.acc, sessionId: att.ses }));
    if (people.length === 0) return;
    let standing: Awaited<ReturnType<typeof reviewStanding>>;
    try {
      standing = await reviewStanding(this.env.DB, people, now);
    } catch (err) {
      this.log.warn('room.review_failed', { error: String(err) });
      return;
    }
    for (const { ws, att } of this.live()) {
      const st = standing.get(`${att.acc}|${att.ses}`);
      if (!st) continue;
      if (!st.allowed) {
        this.log.info('room.session_ended', { characterId: att.id });
        this.sendError(ws, 'ACCOUNT_NOT_ACTIVE', 'Tu sesión terminó.');
        this.retire(ws, att, 'stale', WS_CLOSE.SESSION_ENDED);
        continue;
      }
      const muted = st.mutedUntil ?? undefined;
      if (att.mu === muted) continue;
      if (muted === undefined) delete att.mu;
      else att.mu = muted;
      ws.serializeAttachment(att);
    }
  }

  /** Falta: se avisa con código; demasiadas cierran el socket (§23). */
  private strike(
    ws: WebSocket,
    att: PlayerAttachment,
    code: WsErrorCode,
    about?: string,
    message?: string,
    extra: { retryAfterMs?: number } = {},
  ): void {
    if (addStrike(att, Date.now())) {
      this.sendError(ws, code, 'Demasiados mensajes inválidos.', { ...(about ? { about } : {}) });
      this.log.warn('room.policy_close', { characterId: att.id, code });
      this.retire(ws, att, 'stale', WS_CLOSE.POLICY);
      return;
    }
    ws.serializeAttachment(att);
    const text = message ?? (code === 'RATE_LIMITED' ? 'Vas muy rápido.' : 'Mensaje no válido.');
    this.sendError(ws, code, text, { ...(about ? { about } : {}), ...extra });
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
    this.pruneEdges();
    // Sala vacía: sin alarma pendiente, nada la vuelve a despertar, y la
    // conversación reciente se borra.
    if (remaining === 0) {
      this.ctx.waitUntil(this.ctx.storage.deleteAlarm());
      this.ctx.waitUntil(
        this.forgetChat().catch((err: unknown) =>
          this.log.warn('room.chat_store_failed', { error: String(err) }),
        ),
      );
    }
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

  /**
   * La próxima revisión: la mitad de la ventana de presencia (o la revisión
   * de moderación, si es antes) o el lugar guardado que vence antes.
   */
  private async scheduleAlarm(now: number): Promise<void> {
    let next = now + Math.min(NETWORK.staleAfterMs / 2, SOCIAL.recheckMs);
    for (const ghost of this.ghosts.values()) next = Math.min(next, ghost.until);
    const current = await this.ctx.storage.getAlarm();
    if (current === null || current > next) await this.ctx.storage.setAlarm(next);
  }

  override async alarm(): Promise<void> {
    const now = Date.now();
    this.reapStale(now);
    await this.reapGhosts(now);
    this.pruneChat(now);
    await this.review(now);
    if (this.occupants() > 0) await this.scheduleAlarm(Date.now());
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

  private sendError(
    ws: WebSocket,
    code: WsErrorCode,
    message: string,
    extra: ErrorExtra = {},
  ): void {
    this.send(ws, {
      v: WS_PROTOCOL_VERSION,
      type: 'ERROR',
      payload: {
        code,
        message,
        ...(extra.about ? { about: extra.about } : {}),
        ...(extra.retryAfterMs !== undefined
          ? { retryAfterMs: Math.max(0, Math.ceil(extra.retryAfterMs)) }
          : {}),
      },
    });
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

/** El asiento de alguien, para heredarlo (o nada). */
function seatPart(att: PlayerAttachment): { st?: string } {
  return att.st !== undefined ? { st: att.st } : {};
}

/**
 * ¿Un lugar heredado cabe en ESTE mapa? De pie, donde se puede estar; sentado,
 * en un asiento que siga existiendo, justo donde está.
 */
function lugarValido(map: MapDef, grid: CollisionGrid, lugar: Vec & { st?: string }): boolean {
  if (lugar.st !== undefined) {
    const seat = seatOf(map, lugar.st);
    return (
      seat !== undefined && Math.abs(seat.x - lugar.x) < 0.01 && Math.abs(seat.y - lugar.y) < 0.01
    );
  }
  return canStandAt(grid, lugar);
}

/** Tras esperar a D1, ¿el socket sigue representando a alguien? */
function isLive(ws: WebSocket): boolean {
  const att = attachmentOf(ws);
  return att !== null && !att.gone;
}

/** La nota de un reporte: saneada como el chat y recortada al tope. */
function cleanNote(note: string | undefined): string | null {
  if (!note) return null;
  const clean = sanitizeChat(note, Number.POSITIVE_INFINITY);
  if (!clean.ok) return null;
  return Array.from(clean.text).slice(0, SOCIAL.reportNoteMaxChars).join('');
}
