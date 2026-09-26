import {
  type CollisionGrid,
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
import {
  DIRECTIONS,
  FRAME_H,
  FRAME_W,
  type Look,
  lookKey,
  spriteSheet,
  WALK_FRAMES,
} from '../rendering/pixel-character.ts';
import { paintGround } from '../world-art/ground.ts';
import { FLAG_W, flagColor, paintObject, papelPicadoFlag } from '../world-art/objects.ts';
import { painter } from '../world-art/paint.ts';
import { TILE } from '../world-art/world-palette.ts';

export type WorldSceneOptions = {
  map: MapDef;
  spawn?: string;
  look: Look;
  input: InputManager;
  hud: HudStore;
  /** Cada cuadro, la intención normalizada (el muestreador de red la recibe). */
  onInput?: (nowMs: number, input: Omit<GameInput, 'seq'>) => void;
  /** Sin movimiento ambiental ni cámara suave (movimiento reducido, capturas). */
  quiet: boolean;
  cafeAbierto: boolean;
};

/** Los pies del sprite están en la fila 30 de 32: ahí se ancla al suelo. */
const FEET_ORIGIN_Y = 31 / FRAME_H;
const PAPEL_PICADO_DEPTH = 100_000;
const OCCLUDED_ALPHA = 0.45;
/** Con dos tiles caminados ya quedó claro cómo se camina. */
const WALK_HINT_TILES = 2;

type Occluder = { image: Phaser.GameObjects.Image; depth: number };

/**
 * La sala en Phaser (Fase 4: solo tú, sin red). Cada cuadro: lee el
 * `GameInput` del manager, avanza con el mismo `stepMovement` que usará el
 * servidor, ordena por profundidad y mueve la cámara con zoom entero.
 */
export class WorldScene extends Phaser.Scene {
  private readonly o: WorldSceneOptions;
  private grid!: CollisionGrid;
  private position!: Vec;
  private facing: Facing = 'down';
  private player!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Image;
  private sheetKey = '';
  private readonly occluders: Occluder[] = [];
  private readonly flags: { image: Phaser.GameObjects.Image; color: number; lean: number }[] = [];
  private camCenter = { x: 0, y: 0 };
  private cercanoId: string | null = null;
  /** Tiles recorridos hasta que se retiran las pistas de arranque. */
  private walked = 0;

  constructor(options: WorldSceneOptions) {
    super({ key: 'mundo' });
    this.o = options;
  }

  create(): void {
    const { map } = this.o;
    this.grid = collisionGrid(map);
    const spawn = spawnOf(map, this.o.spawn);
    this.position = { x: spawn.x, y: spawn.y };
    this.facing = spawn.facing;

    this.addTexture(`suelo:${map.id}:${map.version}`, () => paintGround(map));
    this.add.image(0, 0, `suelo:${map.id}:${map.version}`).setOrigin(0, 0).setDepth(-10);

    for (const object of map.objects) {
      if (object.kind === 'papel-picado') this.papelPicado(object);
      else this.placeObject(object);
    }
    this.createPlayer();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layoutCamera, this);
    this.layoutCamera();
    this.followCamera(0, true);

    if (!this.o.quiet) {
      this.time.addEvent({ delay: 110, loop: true, callback: this.swayFlags, callbackScope: this });
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layoutCamera, this);
    });
    this.o.hud.set({ sala: map.name, listo: true });
  }

  /** Posición actual en tiles (para pruebas y, en la Fase 5, la reconciliación). */
  get playerPosition(): Vec {
    return { ...this.position };
  }

  override update(time: number, delta: number): void {
    const input = this.o.input.poll();
    this.o.onInput?.(time, input);

    const intent = { x: input.moveX, y: input.moveY };
    const moving = intent.x !== 0 || intent.y !== 0;
    const next = stepMovement(this.position, intent, delta, this.grid);
    this.facing = facingFrom(intent, this.facing);
    if (this.walked < WALK_HINT_TILES) {
      this.walked += distance(next, this.position);
      if (this.walked >= WALK_HINT_TILES) this.o.hud.set({ camino: true });
    }
    this.position = next;
    this.drawPlayer(moving);

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

  // ─── Construcción ───────────────────────────────────────────────────────

  /**
   * Textura desde un canvas ya pintado. `create` (y no `addCanvas`) evita
   * que Phaser relea cada canvas con getImageData: el arte no se edita después.
   */
  private addTexture(key: string, paint: () => HTMLCanvasElement): Phaser.Textures.Texture {
    if (this.textures.exists(key)) return this.textures.get(key);
    const canvas = paint();
    const texture = this.textures.create(key, canvas, canvas.width, canvas.height);
    if (!texture) throw new Error(`No se pudo crear la textura ${key}`);
    // `create` no trae el cuadro completo que usan las imágenes sin frame.
    texture.add('__BASE', 0, 0, 0, canvas.width, canvas.height);
    return texture;
  }

  private placeObject(object: MapObject): void {
    const art = paintObject(object, { cafeAbierto: this.o.cafeAbierto });
    if (!art) return;
    const key = `objeto:${this.o.map.id}:${object.id}`;
    this.addTexture(key, () => art.canvas);
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
    this.addTexture(cuerdaKey, () => {
      const p = painter(width, sag + 2);
      for (let x = 0; x < width; x++) p.px(x, curve(x), '#efe2c4');
      return p.canvas;
    });
    this.add.image(x0, top, cuerdaKey).setOrigin(0, 0).setDepth(PAPEL_PICADO_DEPTH);

    for (let color = 0; color < 6; color++) {
      for (const lean of [-1, 0, 1] as const) {
        this.addTexture(`bandera:${color}:${lean}`, () => papelPicadoFlag(flagColor(color), lean));
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

  private createPlayer(): void {
    this.sheetKey = `persona:${lookKey(this.o.look)}`;
    const texture = this.addTexture(this.sheetKey, () => spriteSheet(this.o.look));
    DIRECTIONS.forEach((direction, row) => {
      for (const frame of WALK_FRAMES) {
        const index = row * WALK_FRAMES.length + frame;
        if (!texture.has(String(index))) {
          texture.add(index, 0, frame * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H);
        }
      }
      const key = `caminar:${this.sheetKey}:${direction}`;
      if (!this.anims.exists(key)) {
        this.anims.create({
          key,
          frames: WALK_FRAMES.map((frame) => ({
            key: this.sheetKey,
            frame: row * WALK_FRAMES.length + frame,
          })),
          frameRate: 9,
          repeat: -1,
        });
      }
    });

    this.addTexture('sombra-persona', () => {
      const p = painter(14, 5);
      p.ellipse(7, 2, 6.5, 2.4, 'rgb(43 18 56 / 0.3)');
      return p.canvas;
    });
    this.shadow = this.add.image(0, 0, 'sombra-persona').setOrigin(0.5, 0.5).setDepth(-5);
    this.player = this.add
      .sprite(0, 0, this.sheetKey, this.idleFrame())
      .setOrigin(0.5, FEET_ORIGIN_Y);
    this.drawPlayer(false);
  }

  private idleFrame(): number {
    return DIRECTIONS.indexOf(this.facing) * WALK_FRAMES.length;
  }

  private drawPlayer(moving: boolean): void {
    const x = Math.round(this.position.x * TILE);
    const y = Math.round(this.position.y * TILE);
    this.player.setPosition(x, y).setDepth(this.position.y * TILE);
    this.shadow.setPosition(x, y);
    if (moving && !this.o.quiet) {
      this.player.anims.play(`caminar:${this.sheetKey}:${this.facing}`, true);
    } else {
      this.player.anims.stop();
      this.player.setFrame(this.idleFrame());
    }
  }

  /** La copa o el techo que te tapa se vuelve translúcido: nunca te pierdes. */
  private updateOccluders(): void {
    const body = this.player.getBounds();
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
