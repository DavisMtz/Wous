import { CHAT, EMOTE, SEATS } from '@wous/config';
import { type ChatLine, EMOTE_IDS, type Emote, type WsErrorCode } from '@wous/contracts';
import {
  type CollisionGrid,
  canStandAt,
  distance,
  type Facing,
  facingFrom,
  type GameInput,
  IDLE_INPUT,
  stepMovement,
  type Vec,
} from '@wous/game-core';
import {
  type CameraZone,
  collisionGrid,
  getMap,
  type MapDef,
  type MapObject,
  type Nearby,
  nearestInteraction,
  type Portal,
  type Seat,
  seatOf,
  spawnOf,
} from '@wous/world-data';
import Phaser from 'phaser';
import { relojDelServidor, relojDesde } from '../ambiente/hora.ts';
import type { HudStore } from '../hud-store.ts';
import type { InputManager } from '../input/input-manager.ts';
import { InputSampler } from '../network/input-sampler.ts';
import type { RoomError, RoomState } from '../network/room-state.ts';
import { lookFromAppearance } from '../rendering/appearance.ts';
import type { Look } from '../rendering/pixel-character.ts';
import { foco, focoXs, haloDeFoco } from '../world-art/interior.ts';
import { FLAG_W, flagColor, paintObject, papelPicadoFlag } from '../world-art/objects.ts';
import { painter } from '../world-art/paint.ts';
import { TILE } from '../world-art/world-palette.ts';
import { Ambiente } from './ambiente.ts';
import { globoMs, paintGlobo } from './globo.ts';
import { Noche } from './noche.ts';
import { addCanvasTexture, type GloboRect, NAME_FONT, Persona, type Postura } from './persona.ts';
import { SueloPorTrozos } from './suelo.ts';

/** La red de la sala, vista desde la escena: leer el estado y mandar intención. */
export type SceneNetwork = {
  room: RoomState;
  send(input: GameInput): boolean;
  /** Pide cruzar un portal (solo su ID). */
  enterPortal(portalId: string): boolean;
  /** Pide un gesto (solo su ID). */
  emote(emote: Emote): boolean;
  /** Pide sentarse (solo el ID del asiento) y levantarse (ADR-0013). */
  sit(seatId: string): boolean;
  stand(): boolean;
};

export type WorldSceneOptions = {
  /** La sala con la que arranca (con red, la que dijo el primer snapshot). */
  map: MapDef;
  spawn?: string;
  look: Look;
  /** Tu nombre, en la etiqueta de marcatextos. */
  name?: string;
  input: InputManager;
  hud: HudStore;
  /** Sin red (banco de desarrollo): solo tú, como en la Fase 4. */
  net?: SceneNetwork;
  /** Sin movimiento ambiental ni cámara suave (movimiento reducido, capturas). */
  quiet: boolean;
  /** Solo el banco de desarrollo: dónde aparecer (tiles), para revisar cada rincón. */
  inicio?: Vec;
  /** Solo el banco de desarrollo: zoom fijo (1 = el mapa entero en una captura grande). */
  zoom?: number;
  /** Solo el banco de desarrollo: la hora de Morelia con que arranca el ambiente (minutos). */
  hora?: number;
  /** Solo el banco de desarrollo: el día de la semana del ambiente (0 = domingo). */
  dia?: number;
};

/** Al arrancar o reiniciar la escena: qué sala y en qué punto. */
type SceneData = { map?: MapDef; spawn?: string };

const PAPEL_PICADO_DEPTH = 100_000;
const OCCLUDED_ALPHA = 0.45;
/** Con dos tiles caminados ya quedó claro cómo se camina. */
const WALK_HINT_TILES = 2;
/** Más lejos que esto, la corrección es un salto (no se desliza). */
const SNAP_TILES = 3;
/** Por debajo de esto la diferencia con el servidor es ruido. */
const IGNORE_TILES = 0.02;
/** Si la sala no contesta al pedir cruzar, se suelta a la persona. */
const CROSSING_TIMEOUT_MS = 6000;
/** Margen del cliente sobre el enfriamiento de gestos: el honesto nunca toca el tope. */
const EMOTE_MARGIN_MS = 150;
/** Margen para tocar a alguien con el dedo, en pixeles de arte. */
const TOUCH_PAD = 4;
/** Tiempo por cuadro (ms) para ir pintando los trozos del suelo que aún no se ven. */
const SUELO_MS = 4;

/** Lo que se le dice a quien la puerta no dejó pasar. */
const PORTAL_REFUSED: Partial<Record<WsErrorCode, string>> = {
  PORTAL_NOT_REACHABLE: 'Acércate más a la puerta.',
  PORTAL_NOT_FOUND: 'Esa puerta no lleva a ningún lado.',
  INVALID_STATE: 'No se pudo cruzar. Intenta otra vez.',
  RATE_LIMITED: 'Con calma: una vez basta.',
};

/** Lo que se le dice a quien la sala no dejó sentarse (y se vuelve a parar donde estaba). */
const SEAT_REFUSED: Partial<Record<WsErrorCode, string>> = {
  SEAT_TAKEN: 'Ya hay alguien sentado ahí.',
  SEAT_NOT_REACHABLE: 'Acércate más para sentarte.',
  SEAT_NOT_FOUND: 'Ese asiento ya no está.',
  INVALID_STATE: 'No se pudo. Intenta otra vez.',
  RATE_LIMITED: 'Con calma: una vez basta.',
};

/** Lo que haría el botón contextual: lo de junto (puerta, asiento, placa) o levantarse. */
type Accion = Nearby | { type: 'stand'; seat: Seat };

/** La cámara sube o baja hacia su encuadre así de rápido (ms de constante). */
const LOOK_EASE_MS = 420;
/** Aun encuadrando hacia arriba, quien juega queda al menos así de lejos del borde (tiles). */
const LOOK_MARGIN_TILES = 2.6;

type Occluder = { image: Phaser.GameObjects.Image; depth: number };
type Sent = { seq: number; x: number; y: number };

/**
 * La sala en Phaser. Cada cuadro: lee el `GameInput`, lo manda a la sala
 * (intención, a 12 Hz), PREDICE con el mismo `stepMovement` del servidor y
 * corrige suave contra los estados autoritativos; los demás se dibujan
 * interpolados ~100 ms en el pasado. Orden por profundidad y cámara con
 * zoom entero.
 *
 * La sala la decide el servidor: cuando un snapshot llega de otro mapa (se
 * cruzó un portal, o volviste a entrar y estabas en otro lado), la escena se
 * reinicia con ese mapa. El estado de cada sala se limpia en `init`.
 */
export class WorldScene extends Phaser.Scene {
  private readonly o: WorldSceneOptions;
  private map: MapDef;
  private spawnName: string | undefined;
  private grid!: CollisionGrid;
  private suelo!: SueloPorTrozos;
  private ambiente!: Ambiente;
  private noche!: Noche;
  private position!: Vec;
  private facing: Facing = 'down';
  private self!: Persona;
  private readonly remotes = new Map<string, { persona: Persona; x: number; y: number }>();
  private remotesVersion = -1;
  private occluders: Occluder[] = [];
  private flags: { image: Phaser.GameObjects.Image; color: number; lean: number }[] = [];
  private camCenter = { x: 0, y: 0 };
  private walked = 0;
  private readonly sampler: InputSampler;
  /** Dónde estabas al mandar cada input: con eso se mide el error del servidor. */
  private history: Sent[] = [];
  /** Corrección pendiente (tiles) que se aplica poco a poco. */
  private correction = { x: 0, y: 0 };
  /** Pediste cruzar y la sala aún no contesta: no se camina (§33, TRANSITIONING). */
  private crossing: { portalId: string; since: number } | null = null;
  /** Tu último gesto: se pinta al instante y el eco del servidor ya no lo repite. */
  private ownGesture: { emote: Emote; at: number } | null = null;
  private globoCount = 0;
  /**
   * Sentado (ADR-0013): en qué asiento y dónde estabas antes. Se predice al
   * pedirlo; si la sala dice que no, vuelves a `before`.
   */
  private seated: { seat: Seat; before: Vec; confirmed: boolean } | null = null;
  /** Lo que ofrece el botón contextual ahora (su clave, para no avisar al HUD en cada cuadro). */
  private accionKey: string | null = null;
  /** La placa abierta y dónde está (se cierra sola al alejarse). */
  private placaAbierta: { id: string; x: number; y: number; reach: number } | null = null;
  /** Cuánto sube la cámara ahora (tiles), camino a su encuadre. */
  private lookUp = 0;

  constructor(options: WorldSceneOptions) {
    super({ key: 'mundo' });
    this.o = options;
    this.map = options.map;
    this.spawnName = options.spawn;
    this.sampler = new InputSampler((input) => this.sendInput(input));
  }

  /** Cada arranque (el primero y cada cambio de sala) empieza limpio. */
  init(data: SceneData = {}): void {
    if (data.map) {
      this.map = data.map;
      this.spawnName = data.spawn;
    }
    this.remotes.clear();
    this.remotesVersion = -1;
    this.occluders = [];
    this.flags = [];
    this.history = [];
    this.correction = { x: 0, y: 0 };
    this.crossing = null;
    this.ownGesture = null;
    this.seated = null;
    this.accionKey = null;
    this.placaAbierta = null;
    this.lookUp = 0;
  }

  create(): void {
    const map = this.map;
    this.grid = collisionGrid(map);
    const spawn = spawnOf(map, this.spawnName);
    const inicio = !this.o.net && this.map === this.o.map ? this.o.inicio : undefined;
    this.position = inicio ? { ...inicio } : { x: spawn.x, y: spawn.y };
    this.facing = spawn.facing;

    this.suelo = new SueloPorTrozos(this, map);
    const net = this.o.net;
    const reloj =
      this.o.hora === undefined
        ? relojDelServidor(net ? (t) => net.room.serverNow(t) : undefined)
        : relojDesde(this.o.hora, this.time.now, this.o.dia);
    this.ambiente = new Ambiente({ scene: this, map, grid: this.grid, quiet: this.o.quiet, reloj });
    this.noche = new Noche({ scene: this, map, quiet: this.o.quiet, reloj });
    for (const object of map.objects) {
      if (object.kind === 'papel-picado') this.papelPicado(object);
      else if (object.kind === 'focos') this.focos(object);
      else this.placeObject(object);
    }
    this.self = new Persona(this, this.o.look, {
      ...(this.o.name ? { name: this.o.name } : {}),
      own: true,
      facing: this.facing,
    });
    this.self.draw(this.position.x, this.position.y, this.facing, false, false);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layoutCamera, this);
    this.layoutCamera();
    // El primer cuadro ya trae el suelo que se ve; lo demás se pinta de a poco.
    this.suelo.pintarVisibles(this.vista());
    if (!this.o.quiet) {
      this.time.addEvent({ delay: 110, loop: true, callback: this.swayFlags, callbackScope: this });
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layoutCamera, this);
    });
    this.o.hud.set({
      sala: map.name,
      mapa: map.id,
      listo: true,
      cercano: null,
      transicion: null,
      placa: null,
    });
  }

  /** Posición actual en tiles (pruebas E2E). */
  get playerPosition(): Vec {
    return { ...this.position };
  }

  /** Dónde se dibuja a cada quien (pruebas E2E: «A se mueve y B lo ve»). */
  get remotePositions(): { id: string; x: number; y: number }[] {
    return [...this.remotes].map(([id, r]) => ({ id, x: r.x, y: r.y }));
  }

  /** Quién tiene algo colgado ahora: globo o gesto (pruebas E2E). */
  get hanging(): { id: string; globo: boolean; gesto: string | null }[] {
    const out = [...this.remotes].map(([id, r]) => ({ id, ...r.persona.showing }));
    const selfId = this.o.net?.room.selfId ?? 'yo';
    if (this.self) out.push({ id: selfId, ...this.self.showing });
    return out;
  }

  /**
   * A quién tocaste (clic o dedo), en coordenadas del lienzo. Gana quien está
   * más al frente. Tú no cuentas: tu propia ficha no hace falta.
   */
  personAt(canvasX: number, canvasY: number): string | null {
    if (!this.sys.isActive()) return null;
    const point = this.cameras.main.getWorldPoint(canvasX, canvasY);
    let best: { id: string; depth: number } | null = null;
    for (const [id, entry] of this.remotes) {
      if (!entry.persona.contains(point.x, point.y, TOUCH_PAD)) continue;
      const depth = entry.persona.sprite.depth;
      if (!best || depth > best.depth) best = { id, depth };
    }
    return best?.id ?? null;
  }

  /** Sin servidor (banco de desarrollo): lo que dices cuelga sobre ti. */
  sayLocal(text: string): void {
    if (this.self) this.hangGlobo(this.self, text, this.time.now);
  }

  override update(time: number, delta: number): void {
    const net = this.o.net;
    // La sala manda: si el servidor te tiene en otro mapa, se cambia de escena.
    const room = net?.room.room;
    if (room && room.mapId !== this.map.id) {
      const next = getMap(room.mapId);
      if (next) {
        this.scene.restart({ map: next } satisfies SceneData);
        return;
      }
    }
    // Cruzando no se camina: la intención se vuelve «quieto» (y se manda una vez).
    const polled = this.o.input.poll();
    if (net) {
      const errors = net.room.takeErrors();
      this.watchCrossing(errors, net.room, time);
      this.watchSeat(errors);
    }
    const input = this.crossing ? { ...polled, ...IDLE_INPUT } : polled;

    // Al entrar (o reentrar) la sala dice dónde estás: se salta ahí (sentado, si lo estabas).
    const spawn = net?.room.takeSpawn();
    if (spawn) {
      this.position = { x: spawn.x, y: spawn.y };
      this.facing = spawn.facing;
      this.history = [];
      this.correction = { x: 0, y: 0 };
      this.crossing = null;
      const asiento = spawn.seat ? seatOf(this.map, spawn.seat) : undefined;
      this.seated = asiento ? { seat: asiento, before: asiento.exit, confirmed: true } : null;
      this.followCamera(0, true);
    }

    const intent = { x: input.moveX, y: input.moveY };
    const moving = intent.x !== 0 || intent.y !== 0;
    // Sentado, caminar levanta: de pie en la salida ANTES de mandar, como hace la sala.
    if (this.seated && moving) this.standHere();

    // Primero se manda (con la posición de ANTES de moverse: así la mide el servidor).
    this.sampler.tick(time, { moveX: input.moveX, moveY: input.moveY, interact: input.interact });
    if (polled.emote && !this.crossing) this.playOwnGesture(polled.emote, time);

    const next = this.seated
      ? this.position
      : stepMovement(this.position, intent, delta, this.grid);
    if (!this.seated) this.facing = facingFrom(intent, this.facing);
    if (this.walked < WALK_HINT_TILES) {
      this.walked += distance(next, this.position);
      if (this.walked >= WALK_HINT_TILES) this.o.hud.set({ camino: true });
    }
    this.position = next;
    if (net) this.reconcile(net.room, delta);
    this.self.draw(
      this.position.x,
      this.position.y,
      this.facing,
      moving && !this.seated,
      !this.o.quiet,
      this.seated ? { lift: this.seated.seat.lift ?? 0 } : null,
    );

    if (net) this.drawRemotes(net.room, time);
    if (net) this.hangFromRoom(net.room, time);
    this.stackGlobos();
    this.self.tick(time, !this.o.quiet);
    for (const { persona } of this.remotes.values()) persona.tick(time, !this.o.quiet);

    const gente = [this.position, ...[...this.remotes.values()].map(({ x, y }) => ({ x, y }))];
    this.ambiente.update(time, delta, this.position, gente);

    const accion = this.crossing ? null : this.accionDisponible();
    const objetivo = accion ? dondeSeMarca(accion) : null;
    this.ambiente.marcar(objetivo?.punto ?? null, objetivo?.alto ?? 0, time);
    const key = accion ? `${accion.type}:${accionId(accion)}` : null;
    if (key !== this.accionKey) {
      this.accionKey = key;
      this.o.hud.set({
        cercano: accion ? { id: accionId(accion), label: accionLabel(accion) } : null,
      });
    }
    if (polled.interact && accion) this.actuar(accion, time);
    this.cerrarPlacaLejana();

    this.updateOccluders();
    this.followCamera(delta, this.o.quiet);
    const vista = this.vista();
    this.noche.update(time, delta, vista);
    this.suelo.pintarVisibles(vista);
    this.suelo.pintarPendientes(vista, SUELO_MS);
  }

  // ─── Lo de junto: puertas, asientos y placas ────────────────────────────

  /** Sentado, lo único es levantarse; de pie, lo más cercano (un asiento, solo si está libre). */
  private accionDisponible(): Accion | null {
    if (this.seated) return { type: 'stand', seat: this.seated.seat };
    const room = this.o.net?.room;
    return nearestInteraction(
      this.map,
      this.position,
      SEATS.reach,
      (seat) => !room?.seatTaken(seat.id),
    );
  }

  private actuar(accion: Accion, time: number): void {
    switch (accion.type) {
      case 'portal':
        this.cross(accion.portal, time);
        return;
      case 'seat':
        this.sit(accion.seat);
        return;
      case 'stand':
        this.stand();
        return;
      case 'sign': {
        const { sign } = accion;
        if (this.placaAbierta?.id === sign.id) {
          this.placaAbierta = null;
          this.o.hud.set({ placa: null });
          return;
        }
        this.placaAbierta = { id: sign.id, x: sign.x, y: sign.y, reach: sign.reach };
        this.o.hud.set({ placa: { id: sign.id, titulo: sign.title, texto: [...sign.body] } });
        return;
      }
    }
  }

  /** La placa se cierra sola si te alejas (un paso de margen). */
  private cerrarPlacaLejana(): void {
    const placa = this.placaAbierta;
    if (!placa) {
      if (this.o.hud.get().placa) this.o.hud.set({ placa: null });
      return;
    }
    if (!this.o.hud.get().placa) {
      // La cerró el HUD (botón, Esc).
      this.placaAbierta = null;
      return;
    }
    if (distance(this.position, placa) > placa.reach + 1) {
      this.placaAbierta = null;
      this.o.hud.set({ placa: null });
    }
  }

  /**
   * Sentarse (ADR-0013). Con red se pide y se predice: los pies van al
   * asiento ya; si la sala dice que no, vuelves a donde estabas. El historial
   * de inputs se vacía: lo que la sala diga de antes no corrige el asiento.
   */
  private sit(seat: Seat): void {
    const net = this.o.net;
    if (net && !net.sit(seat.id)) {
      this.o.hud.avisar('Sin conexión: espera a que vuelva para sentarte.');
      return;
    }
    this.seated = { seat, before: { ...this.position }, confirmed: !net };
    this.position = { x: seat.x, y: seat.y };
    this.facing = seat.facing;
    this.history = [];
    this.correction = { x: 0, y: 0 };
  }

  /** «Levantarse» sin caminar: se pide y se queda de pie en la salida. */
  private stand(): void {
    if (!this.seated) return;
    this.o.net?.stand();
    this.standHere();
  }

  /** De pie en la salida del asiento (la sala hace lo mismo al levantarte). */
  private standHere(): void {
    const seated = this.seated;
    if (!seated) return;
    this.position = { ...seated.seat.exit };
    this.seated = null;
    this.history = [];
    this.correction = { x: 0, y: 0 };
  }

  /** Si la sala no dejó sentarse, se vuelve a donde estabas y se dice por qué. */
  private watchSeat(errors: RoomError[]): void {
    for (const { code, about } of errors) {
      if (about !== 'SIT') continue;
      const seated = this.seated;
      if (seated && !seated.confirmed) {
        this.position = { ...seated.before };
        this.seated = null;
        this.history = [];
        this.correction = { x: 0, y: 0 };
      }
      const texto = SEAT_REFUSED[code];
      if (texto) this.o.hud.avisar(texto);
    }
  }

  // ─── Portales ───────────────────────────────────────────────────────────

  /**
   * Pedir cruzar (§16). Con red solo se pide: la sala valida y, si acepta,
   * el cambio llega como un snapshot de otra sala. Sin red (banco de
   * desarrollo) se cruza aquí mismo, para revisar cada sala a ojo.
   */
  private cross(portal: Portal, time: number): void {
    const net = this.o.net;
    if (!net) {
      const next = getMap(portal.to.map);
      if (!next) return;
      // Misma cortina que con servidor: baja, se cambia de sala y sube.
      this.o.hud.set({ transicion: { destino: next.name, mapa: next.id }, cercano: null });
      this.accionKey = null;
      this.crossing = { portalId: portal.id, since: time };
      this.time.delayedCall(this.o.quiet ? 0 : 420, () =>
        this.scene.restart({ map: next, spawn: portal.to.spawn } satisfies SceneData),
      );
      return;
    }
    if (!net.enterPortal(portal.id)) {
      this.o.hud.avisar('Sin conexión: espera a que vuelva para cruzar.');
      return;
    }
    this.crossing = { portalId: portal.id, since: time };
    this.accionKey = null;
    this.o.hud.set({ cercano: null });
  }

  /** Lo que la sala contestó al pedir cruzar: si no dejó, se suelta y se dice por qué. */
  private watchCrossing(errors: RoomError[], room: RoomState, time: number): void {
    for (const { code, about } of errors) {
      // Lo del chat, los gestos o la seguridad social lo dice el HUD, no la puerta.
      if (about !== undefined && about !== 'ENTER_PORTAL') continue;
      const texto = this.crossing ? PORTAL_REFUSED[code] : undefined;
      if (!texto) continue;
      this.crossing = null;
      this.o.hud.avisar(texto);
    }
    if (room.transfer) return; // Aceptado: se espera la sala nueva.
    if (this.crossing && time - this.crossing.since > CROSSING_TIMEOUT_MS) {
      this.crossing = null;
      this.o.hud.avisar('La puerta no contestó. Intenta otra vez.');
    }
  }

  // ─── Chat y gestos ──────────────────────────────────────────────────────

  /**
   * Un gesto tuyo (1–4 o una calcomanía): se pinta YA y se pide a la sala;
   * el eco que regresa no lo repite. El enfriamiento del cliente es un poco
   * más largo que el del servidor, así que el honesto nunca toca el tope.
   */
  private playOwnGesture(raw: string, time: number): void {
    const emote = EMOTE_IDS.find((e) => e === raw);
    if (!emote) return;
    const last = this.ownGesture?.at ?? Number.NEGATIVE_INFINITY;
    if (time - last < EMOTE.cooldownMs + EMOTE_MARGIN_MS) return;
    const net = this.o.net;
    if (net && !net.emote(emote)) return;
    this.ownGesture = { emote, at: time };
    this.self.gesture(emote, time, EMOTE.showMs);
  }

  /** Lo dicho y los gestos que llegaron de la sala se cuelgan sobre cada quien. */
  private hangFromRoom(room: RoomState, time: number): void {
    const selfId = room.selfId;
    for (const line of room.takeSaid()) {
      const persona = line.from === selfId ? this.self : this.remotes.get(line.from)?.persona;
      if (persona) this.hangGlobo(persona, line.text, time, line);
    }
    for (const { id, emote } of room.takeGestures()) {
      if (id === selfId) {
        // Ya se pintó al pedirlo; solo si no (otra pestaña, reconexión) se pinta ahora.
        const own = this.ownGesture;
        if (own && own.emote === emote && time - own.at < EMOTE.showMs) continue;
        this.self.gesture(emote, time, EMOTE.showMs);
        continue;
      }
      this.remotes.get(id)?.persona.gesture(emote, time, EMOTE.showMs);
    }
  }

  /**
   * Globos que se enciman (dos personas juntas hablando): el más viejo se
   * queda en su lugar y el nuevo sube hasta quedar libre. Ningún globo tapa
   * la etiqueta de alguien más: los nombres son obstáculos desde el inicio.
   * Se decide con dónde quedaron en el cuadro anterior: la gente camina despacio.
   */
  private stackGlobos(): void {
    const personas = [this.self, ...[...this.remotes.values()].map((r) => r.persona)];
    const globos = personas
      .map((persona) => ({ persona, rect: persona.globoRect }))
      .filter((g): g is { persona: Persona; rect: GloboRect } => g.rect !== null)
      .sort((a, b) => a.rect.born - b.rect.born);
    if (globos.length === 0) return;
    const placed: GloboRect[] = personas
      .map((persona) => persona.tagRect)
      .filter((r): r is GloboRect => r !== null);
    for (const { persona, rect } of globos) {
      let lift = 0;
      for (let guard = 0; guard < placed.length + 1; guard++) {
        const hit = placed.find(
          (q) => rect.x0 < q.x1 && rect.x1 > q.x0 && rect.y0 - lift < q.y1 && rect.y1 - lift > q.y0,
        );
        if (!hit) break;
        lift = rect.y1 - hit.y0 + 1;
      }
      persona.setGloboLift(lift);
      placed.push({ ...rect, y0: rect.y0 - lift, y1: rect.y1 - lift });
    }
  }

  private hangGlobo(persona: Persona, text: string, time: number, line?: ChatLine): void {
    this.globoCount += 1;
    const key = `globo:${line?.id ?? 'local'}:${this.globoCount}`;
    persona.say(
      key,
      paintGlobo(text, NAME_FONT),
      time,
      globoMs(text, CHAT.bubbleMs, CHAT.bubblePerCharMs),
    );
  }

  // ─── Red ────────────────────────────────────────────────────────────────

  private sendInput(input: GameInput): void {
    const net = this.o.net;
    if (!net) return;
    if (net.send(input)) {
      this.history.push({ seq: input.seq, x: this.position.x, y: this.position.y });
      if (this.history.length > 64) this.history.shift();
    }
  }

  /**
   * Corrección de la predicción (§14): el estado del servidor para el input
   * N se compara con dónde estabas al mandar N. La diferencia se aplica poco
   * a poco (o de golpe si es grande) y también se descuenta del historial,
   * para no corregir dos veces el mismo error.
   */
  private reconcile(room: RoomState, delta: number): void {
    for (const state of room.takeSelfStates()) {
      // Sentado, la sala confirma el asiento; no hay posición que corregir.
      if (state.seat !== undefined) {
        if (this.seated?.seat.id === state.seat) this.seated.confirmed = true;
        continue;
      }
      const sent = this.history.find((h) => h.seq === state.seq);
      this.history = this.history.filter((h) => h.seq > state.seq);
      if (!sent || this.seated) continue;
      const ex = state.x - sent.x;
      const ey = state.y - sent.y;
      const size = Math.hypot(ex, ey);
      if (size > SNAP_TILES) {
        this.shift(ex, ey);
        this.correction = { x: 0, y: 0 };
      } else if (size > IGNORE_TILES) {
        this.correction = { x: ex, y: ey };
      }
    }
    if (this.correction.x === 0 && this.correction.y === 0) return;
    const k = 1 - Math.exp(-delta / 90);
    const sx = this.correction.x * k;
    const sy = this.correction.y * k;
    const candidate = { x: this.position.x + sx, y: this.position.y + sy };
    if (canStandAt(this.grid, candidate)) this.shift(sx, sy);
    this.correction.x -= sx;
    this.correction.y -= sy;
    if (Math.hypot(this.correction.x, this.correction.y) < 0.001) this.correction = { x: 0, y: 0 };
  }

  private shift(dx: number, dy: number): void {
    this.position = { x: this.position.x + dx, y: this.position.y + dy };
    for (const h of this.history) {
      h.x += dx;
      h.y += dy;
    }
  }

  private drawRemotes(room: RoomState, time: number): void {
    if (room.version !== this.remotesVersion) {
      this.remotesVersion = room.version;
      for (const [id, entry] of this.remotes) {
        if (!room.remotes.has(id)) {
          entry.persona.destroy();
          this.remotes.delete(id);
        }
      }
      for (const [id, remote] of room.remotes) {
        if (this.remotes.has(id)) continue;
        const persona = new Persona(this, lookFromAppearance(remote.appearance), {
          name: remote.displayName,
        });
        persona.setZoom(this.cameras.main.zoom);
        this.remotes.set(id, { persona, x: 0, y: 0 });
      }
      for (const [id, entry] of this.remotes) {
        entry.persona.setBlocked(room.blocked.has(id));
        entry.persona.setFriend(room.friends.has(id));
      }
      this.o.hud.set({ gente: room.remotes.size + 1 });
    }
    for (const [id, entry] of this.remotes) {
      const remote = room.remotes.get(id);
      const at = remote ? room.render(remote, time, this.grid) : null;
      if (!at) continue;
      entry.x = at.x;
      entry.y = at.y;
      const asiento = at.seat ? seatOf(this.map, at.seat) : undefined;
      const postura: Postura = asiento ? { lift: asiento.lift ?? 0 } : null;
      entry.persona.draw(at.x, at.y, at.facing, at.moving, !this.o.quiet, postura);
      entry.persona.setAway(at.away);
    }
  }

  // ─── Construcción ───────────────────────────────────────────────────────

  private placeObject(object: MapObject): void {
    const art = paintObject(object);
    if (!art) return;
    const key = `objeto:${this.map.id}:${this.map.version}:${object.id}`;
    addCanvasTexture(this, key, () => art.canvas);
    const image = this.add
      .image(object.x * TILE + art.ox, object.y * TILE + art.oy, key)
      .setOrigin(0, 0)
      .setDepth(art.depth);
    if (art.occluder) this.occluders.push({ image, depth: art.depth });
    this.ambiente.registrar(object, image, art);
    this.noche.registrar(object, image, art);
  }

  /** Tira de papel picado: una cuerda que se cuelga en tramos y banderitas que se mecen solas. */
  private papelPicado(object: MapObject): void {
    const x0 = object.x * TILE;
    const width = object.w * TILE;
    const top = object.y * TILE - 14;
    const span = 76;
    const sag = 6;
    const curve = (x: number) => {
      const t = (x % span) / span;
      return Math.round(sag * 4 * t * (1 - t));
    };
    const cuerdaKey = `cuerda:${this.map.id}:${object.id}`;
    addCanvasTexture(this, cuerdaKey, () => {
      const p = painter(width, sag + 2);
      for (let x = 0; x < width; x++) p.px(x, curve(x), '#efe2c4');
      return p.canvas;
    });
    this.add.image(x0, top, cuerdaKey).setOrigin(0, 0).setDepth(PAPEL_PICADO_DEPTH);

    for (let color = 0; color < 6; color++) {
      for (const lean of [-1, 0, 1] as const) {
        addCanvasTexture(this, `bandera:${color}:${lean}`, () =>
          papelPicadoFlag(flagColor(color), lean),
        );
      }
    }
    let i = 0;
    for (let x = 4; x < width - FLAG_W; x += FLAG_W + 3, i++) {
      const color = (i + object.y) % 6;
      const image = this.add
        .image(x0 + x, top + curve(x + 3) + 1, `bandera:${color}:0`)
        .setOrigin(0, 0)
        .setDepth(PAPEL_PICADO_DEPTH + 1);
      this.flags.push({ image, color, lean: 0 });
    }
  }

  /**
   * Serie de focos pelones de pared a pared: el cable cuelga en una sola
   * curva y cada foco suma su halo cálido a lo que hay debajo (modo aditivo).
   */
  private focos(object: MapObject): void {
    const x0 = object.x * TILE;
    const width = object.w * TILE;
    const top = object.y * TILE - 10;
    const sag = 9;
    const curve = (x: number) => Math.round(sag * 4 * (x / width) * (1 - x / width));
    const cuerdaKey = `cable:${this.map.id}:${object.id}`;
    addCanvasTexture(this, cuerdaKey, () => {
      const p = painter(width, sag + 2);
      for (let x = 0; x < width; x++) p.px(x, curve(x), '#2a2530');
      return p.canvas;
    });
    this.add.image(x0, top, cuerdaKey).setOrigin(0, 0).setDepth(PAPEL_PICADO_DEPTH);
    addCanvasTexture(this, 'foco', foco);
    addCanvasTexture(this, 'halo-foco', haloDeFoco);
    for (const bx of focoXs(width)) {
      const y = top + curve(bx);
      this.add
        .image(x0 + bx + 0.5, y + 6, 'halo-foco')
        .setOrigin(0.5, 0.5)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(PAPEL_PICADO_DEPTH + 1);
      this.add
        .image(x0 + bx - 2, y, 'foco')
        .setOrigin(0, 0)
        .setDepth(PAPEL_PICADO_DEPTH + 2);
    }
  }

  /** Una ráfaga que recorre la tira: cada banderita se inclina a su turno. */
  private swayFlags(): void {
    const t = this.time.now / 650;
    this.flags.forEach((flag, i) => {
      const v = Math.sin(t - i * 0.33) + Math.sin(t * 0.37 + i * 0.11) * 0.4;
      const lean = v > 0.75 ? 1 : v < -0.75 ? -1 : 0;
      if (lean !== flag.lean) {
        flag.lean = lean;
        flag.image.setTexture(`bandera:${flag.color}:${lean}`);
      }
    });
  }

  /** La copa o el techo que te tapa se vuelve translúcido: nunca te pierdes. */
  private updateOccluders(): void {
    const body = this.self.sprite.getBounds();
    for (const { image, depth } of this.occluders) {
      const behind = this.position.y * TILE < depth;
      const hides = behind && Phaser.Geom.Intersects.RectangleToRectangle(body, image.getBounds());
      const target = hides ? OCCLUDED_ALPHA : 1;
      if (image.alpha !== target) {
        image.setAlpha(this.o.quiet ? target : Phaser.Math.Linear(image.alpha, target, 0.18));
        if (Math.abs(image.alpha - target) < 0.02) image.setAlpha(target);
      }
    }
  }

  // ─── Cámara ─────────────────────────────────────────────────────────────

  /**
   * Zoom entero según el tamaño de la pantalla: en teléfono apaisado se ven
   * ~12 tiles de alto; en escritorio, de 22 a 30 de ancho (ADR-0007).
   */
  private layoutCamera(): void {
    const { width, height } = this.scale.gameSize;
    const zoom =
      this.o.zoom ?? Phaser.Math.Clamp(Math.floor(Math.min(width / 416, height / 224)), 2, 6);
    this.cameras.main.setZoom(zoom).setRoundPixels(true);
    this.self.setZoom(zoom);
    for (const { persona } of this.remotes.values()) persona.setZoom(zoom);
    this.followCamera(0, true);
  }

  /** Lo que ve la cámara ahora, en pixeles del mundo. */
  private vista(): Phaser.Geom.Rectangle {
    const cam = this.cameras.main;
    const w = cam.width / cam.zoom;
    const h = cam.height / cam.zoom;
    return new Phaser.Geom.Rectangle(this.camCenter.x - w / 2, this.camCenter.y - h / 2, w, h);
  }

  private followCamera(delta: number, snap: boolean): void {
    const cam = this.cameras.main;
    const viewW = cam.width / cam.zoom;
    const viewH = cam.height / cam.zoom;
    const mapW = this.map.width * TILE;
    const mapH = this.map.height * TILE;
    // Encuadre (ADR-0013): frente a lo alto, la cámara sube, sin perderte de vista.
    const zone = zoneAt(this.map.cameraZones, this.position);
    const room = Math.max(0, viewH / 2 - LOOK_MARGIN_TILES * TILE) / TILE;
    const target = Math.min(zone?.lookUp ?? 0, room);
    const ease = snap ? 1 : 1 - Math.exp(-delta / LOOK_EASE_MS);
    this.lookUp += (target - this.lookUp) * ease;
    if (Math.abs(target - this.lookUp) < 0.01) this.lookUp = target;
    const px = this.position.x * TILE;
    const py = this.position.y * TILE - 12 - this.lookUp * TILE;
    const tx = mapW <= viewW ? mapW / 2 : Phaser.Math.Clamp(px, viewW / 2, mapW - viewW / 2);
    const ty = mapH <= viewH ? mapH / 2 : Phaser.Math.Clamp(py, viewH / 2, mapH - viewH / 2);
    const k = snap ? 1 : 1 - Math.exp(-delta / 110);
    this.camCenter.x += (tx - this.camCenter.x) * k;
    this.camCenter.y += (ty - this.camCenter.y) * k;
    cam.centerOn(Math.round(this.camCenter.x), Math.round(this.camCenter.y));
  }
}

function accionId(accion: Accion): string {
  switch (accion.type) {
    case 'portal':
      return accion.portal.id;
    case 'seat':
    case 'stand':
      return accion.seat.id;
    case 'sign':
      return accion.sign.id;
  }
}

/** Lo que dice el botón contextual («Entrar al Café», «Sentarse», «Leer la placa»). */
function accionLabel(accion: Accion): string {
  switch (accion.type) {
    case 'portal':
      return accion.portal.label;
    case 'seat':
      return 'Sentarse';
    case 'stand':
      return 'Levantarse';
    case 'sign':
      return accion.sign.label;
  }
}

/**
 * Dónde flota la marca de lo que harías con «E» (tiles) y cuántos pixeles
 * arriba: sobre el asiento, la placa o la puerta. Sentada no hay marca.
 */
function dondeSeMarca(accion: Accion): { punto: Vec; alto: number } | null {
  switch (accion.type) {
    case 'seat':
      return { punto: accion.seat, alto: 24 + (accion.seat.lift ?? 0) };
    case 'sign':
      return { punto: accion.sign, alto: 30 };
    case 'portal':
      return { punto: accion.portal, alto: 36 };
    case 'stand':
      return null;
  }
}

/** El encuadre donde estás (el primero que te contiene). */
function zoneAt(zones: readonly CameraZone[], p: Vec): CameraZone | undefined {
  return zones.find((z) => p.x >= z.x && p.x < z.x + z.w && p.y >= z.y && p.y < z.y + z.h);
}
