import {
  type CollisionGrid,
  canStandAt,
  distance,
  type Facing,
  facingFrom,
  type GameInput,
  stepMovement,
  type Vec,
} from '@wous/game-core';
import {
  collisionGrid,
  type MapDef,
  type MapObject,
  nearestPortal,
  spawnOf,
} from '@wous/world-data';
import Phaser from 'phaser';
import type { HudStore } from '../hud-store.ts';
import type { InputManager } from '../input/input-manager.ts';
import { InputSampler } from '../network/input-sampler.ts';
import type { RoomState } from '../network/room-state.ts';
import { lookFromAppearance } from '../rendering/appearance.ts';
import type { Look } from '../rendering/pixel-character.ts';
import { paintGround } from '../world-art/ground.ts';
import { FLAG_W, flagColor, paintObject, papelPicadoFlag } from '../world-art/objects.ts';
import { painter } from '../world-art/paint.ts';
import { TILE } from '../world-art/world-palette.ts';
import { addCanvasTexture, Persona } from './persona.ts';

/** La red de la sala, vista desde la escena: leer el estado y mandar intención. */
export type SceneNetwork = {
  room: RoomState;
  send(input: GameInput): boolean;
};

export type WorldSceneOptions = {
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
  cafeAbierto: boolean;
};

const PAPEL_PICADO_DEPTH = 100_000;
const OCCLUDED_ALPHA = 0.45;
/** Con dos tiles caminados ya quedó claro cómo se camina. */
const WALK_HINT_TILES = 2;
/** Más lejos que esto, la corrección es un salto (no se desliza). */
const SNAP_TILES = 3;
/** Por debajo de esto la diferencia con el servidor es ruido. */
const IGNORE_TILES = 0.02;

type Occluder = { image: Phaser.GameObjects.Image; depth: number };
type Sent = { seq: number; x: number; y: number };

/**
 * La sala en Phaser. Cada cuadro: lee el `GameInput`, lo manda a la sala
 * (intención, a 12 Hz), PREDICE con el mismo `stepMovement` del servidor y
 * corrige suave contra los estados autoritativos; los demás se dibujan
 * interpolados ~100 ms en el pasado. Orden por profundidad y cámara con
 * zoom entero.
 */
export class WorldScene extends Phaser.Scene {
  private readonly o: WorldSceneOptions;
  private grid!: CollisionGrid;
  private position!: Vec;
  private facing: Facing = 'down';
  private self!: Persona;
  private readonly remotes = new Map<string, { persona: Persona; x: number; y: number }>();
  private remotesVersion = -1;
  private readonly occluders: Occluder[] = [];
  private readonly flags: { image: Phaser.GameObjects.Image; color: number; lean: number }[] = [];
  private camCenter = { x: 0, y: 0 };
  private cercanoId: string | null = null;
  private walked = 0;
  private readonly sampler: InputSampler;
  /** Dónde estabas al mandar cada input: con eso se mide el error del servidor. */
  private history: Sent[] = [];
  /** Corrección pendiente (tiles) que se aplica poco a poco. */
  private correction = { x: 0, y: 0 };

  constructor(options: WorldSceneOptions) {
    super({ key: 'mundo' });
    this.o = options;
    this.sampler = new InputSampler((input) => this.sendInput(input));
  }

  create(): void {
    const { map } = this.o;
    this.grid = collisionGrid(map);
    const spawn = spawnOf(map, this.o.spawn);
    this.position = { x: spawn.x, y: spawn.y };
    this.facing = spawn.facing;

    addCanvasTexture(this, `suelo:${map.id}:${map.version}`, () => paintGround(map));
    this.add.image(0, 0, `suelo:${map.id}:${map.version}`).setOrigin(0, 0).setDepth(-10);
    for (const object of map.objects) {
      if (object.kind === 'papel-picado') this.papelPicado(object);
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
    if (!this.o.quiet) {
      this.time.addEvent({ delay: 110, loop: true, callback: this.swayFlags, callbackScope: this });
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layoutCamera, this);
    });
    this.o.hud.set({ sala: map.name, listo: true });
  }

  /** Posición actual en tiles (pruebas E2E). */
  get playerPosition(): Vec {
    return { ...this.position };
  }

  /** Dónde se dibuja a cada quien (pruebas E2E: «A se mueve y B lo ve»). */
  get remotePositions(): { id: string; x: number; y: number }[] {
    return [...this.remotes].map(([id, r]) => ({ id, x: r.x, y: r.y }));
  }

  override update(time: number, delta: number): void {
    const net = this.o.net;
    const input = this.o.input.poll();

    // Al entrar (o reentrar) la sala dice dónde estás: se salta ahí.
    const spawn = net?.room.takeSpawn();
    if (spawn) {
      this.position = { x: spawn.x, y: spawn.y };
      this.facing = spawn.facing;
      this.history = [];
      this.correction = { x: 0, y: 0 };
      this.followCamera(0, true);
    }

    // Primero se manda (con la posición de ANTES de moverse: así la mide el servidor).
    this.sampler.tick(time, input);

    const intent = { x: input.moveX, y: input.moveY };
    const moving = intent.x !== 0 || intent.y !== 0;
    const next = stepMovement(this.position, intent, delta, this.grid);
    this.facing = facingFrom(intent, this.facing);
    if (this.walked < WALK_HINT_TILES) {
      this.walked += distance(next, this.position);
      if (this.walked >= WALK_HINT_TILES) this.o.hud.set({ camino: true });
    }
    this.position = next;
    if (net) this.reconcile(net.room, delta);
    this.self.draw(this.position.x, this.position.y, this.facing, moving, !this.o.quiet);

    if (net) this.drawRemotes(net.room, time);

    const portal = nearestPortal(this.o.map, this.position);
    const id = portal?.id ?? null;
    if (id !== this.cercanoId) {
      this.cercanoId = id;
      this.o.hud.set({ cercano: portal ? { id: portal.id, label: portal.label } : null });
    }
    if (input.interact && portal) {
      // Los portales se cruzan en la Fase 6 (validados por el servidor).
      this.o.hud.avisar(
        this.o.cafeAbierto ? portal.label : 'El Café abre muy pronto. Mientras, date una vuelta.',
      );
    }

    this.updateOccluders();
    this.followCamera(delta, this.o.quiet);
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
      const sent = this.history.find((h) => h.seq === state.seq);
      this.history = this.history.filter((h) => h.seq > state.seq);
      if (!sent) continue;
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
      this.o.hud.set({ gente: room.remotes.size + 1 });
    }
    for (const [id, entry] of this.remotes) {
      const remote = room.remotes.get(id);
      const at = remote ? room.render(remote, time, this.grid) : null;
      if (!at) continue;
      entry.x = at.x;
      entry.y = at.y;
      entry.persona.draw(at.x, at.y, at.facing, at.moving, !this.o.quiet);
    }
  }

  // ─── Construcción ───────────────────────────────────────────────────────

  private placeObject(object: MapObject): void {
    const art = paintObject(object, { cafeAbierto: this.o.cafeAbierto });
    if (!art) return;
    const key = `objeto:${this.o.map.id}:${object.id}`;
    addCanvasTexture(this, key, () => art.canvas);
    const image = this.add
      .image(object.x * TILE + art.ox, object.y * TILE + art.oy, key)
      .setOrigin(0, 0)
      .setDepth(art.depth);
    if (art.occluder) this.occluders.push({ image, depth: art.depth });
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
    const cuerdaKey = `cuerda:${this.o.map.id}:${object.id}`;
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
    const zoom = Phaser.Math.Clamp(Math.floor(Math.min(width / 416, height / 224)), 2, 6);
    this.cameras.main.setZoom(zoom).setRoundPixels(true);
    this.self.setZoom(zoom);
    for (const { persona } of this.remotes.values()) persona.setZoom(zoom);
    this.followCamera(0, true);
  }

  private followCamera(delta: number, snap: boolean): void {
    const cam = this.cameras.main;
    const viewW = cam.width / cam.zoom;
    const viewH = cam.height / cam.zoom;
    const mapW = this.o.map.width * TILE;
    const mapH = this.o.map.height * TILE;
    const px = this.position.x * TILE;
    const py = this.position.y * TILE - 12;
    const tx = mapW <= viewW ? mapW / 2 : Phaser.Math.Clamp(px, viewW / 2, mapW - viewW / 2);
    const ty = mapH <= viewH ? mapH / 2 : Phaser.Math.Clamp(py, viewH / 2, mapH - viewH / 2);
    const k = snap ? 1 : 1 - Math.exp(-delta / 110);
    this.camCenter.x += (tx - this.camCenter.x) * k;
    this.camCenter.y += (ty - this.camCenter.y) * k;
    cam.centerOn(Math.round(this.camCenter.x), Math.round(this.camCenter.y));
  }
}
