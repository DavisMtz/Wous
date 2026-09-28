import type { Emote } from '@wous/contracts';
import type { Facing } from '@wous/game-core';
import type Phaser from 'phaser';
import {
  DIRECTIONS,
  FRAME_H,
  FRAME_W,
  type Look,
  lookKey,
  SHEET_COLUMNS,
  SIT_DROP,
  SIT_FRAME,
  spriteSheet,
  WALK_FRAMES,
} from '../rendering/pixel-character.ts';
import { emoteKey, paintEmote } from '../world-art/emotes.ts';
import { painter } from '../world-art/paint.ts';
import { TILE } from '../world-art/world-palette.ts';
import type { GloboArt } from './globo.ts';

/** Los pies del sprite están en la fila 30 de 32: ahí se ancla al suelo. */
const FEET_ORIGIN_Y = 31 / FRAME_H;
/** Los nombres van sobre todo el mundo (incluido el papel picado). */
const NAME_DEPTH = 200_000;
/** Tamaño del nombre en pixeles de PANTALLA (se escala 1/zoom para verse nítido). */
const NAME_FONT_PX = 13;
export const NAME_FONT = '"Bricolage Grotesque Variable", system-ui, sans-serif';

const CARTULINA = '#fffbf1';
const MASKING = '#e9dbb1';
const PLUMON = '#17101b';
const PLUMON_SUAVE = '#4a3a51';
const FOSFO_VERDE = '#5dff86';

/** El globo se va apagando en su último tramo. */
const GLOBO_FADE_MS = 380;
const GLOBO_POP_MS = 150;
/** Margen de sombra arriba del papel en el canvas del globo (ver globo.ts). */
const GLOBO_SHADOW_TOP = 6;
/** Margen de sombra a los lados del papel (ver globo.ts). */
const GLOBO_SHADOW_SIDE = 8;

/** Dónde quedaría un globo sin apilar, en pixeles del mundo (para no encimarlos). */
export type GloboRect = { x0: number; x1: number; y0: number; y1: number; born: number };
const GESTO_FADE_MS = 320;

/**
 * Textura desde un canvas ya pintado. `create` (y no `addCanvas`) evita que
 * Phaser relea cada canvas con getImageData; `create` no trae el cuadro
 * `__BASE`, así que se agrega aquí.
 */
export function addCanvasTexture(
  scene: Phaser.Scene,
  key: string,
  paint: () => HTMLCanvasElement,
): Phaser.Textures.Texture {
  if (scene.textures.exists(key)) return scene.textures.get(key);
  const canvas = paint();
  const texture = scene.textures.create(key, canvas, canvas.width, canvas.height);
  if (!texture) throw new Error(`No se pudo crear la textura ${key}`);
  texture.add('__BASE', 0, 0, 0, canvas.width, canvas.height);
  return texture;
}

/** Hoja de sprites y animaciones de un look (una vez por look, compartidas). */
function ensureLook(scene: Phaser.Scene, look: Look): string {
  const sheetKey = `persona:${lookKey(look)}`;
  const texture = addCanvasTexture(scene, sheetKey, () => spriteSheet(look));
  DIRECTIONS.forEach((direction, row) => {
    for (const frame of [...WALK_FRAMES, SIT_FRAME]) {
      const index = row * SHEET_COLUMNS + frame;
      if (!texture.has(String(index))) {
        texture.add(index, 0, frame * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H);
      }
    }
    const key = `caminar:${sheetKey}:${direction}`;
    if (!scene.anims.exists(key)) {
      scene.anims.create({
        key,
        frames: WALK_FRAMES.map((frame) => ({
          key: sheetKey,
          frame: row * SHEET_COLUMNS + frame,
        })),
        frameRate: 9,
        repeat: -1,
      });
    }
  });
  addCanvasTexture(scene, 'sombra-persona', () => {
    const p = painter(14, 5);
    p.ellipse(7, 2, 6.5, 2.4, 'rgb(43 18 56 / 0.3)');
    return p.canvas;
  });
  return sheetKey;
}

/**
 * La marca de bloqueo junto al nombre (ADR-0010): un globo tachado a trazo de
 * plumón sobre un pedazo de masking, en pixeles de pantalla como la etiqueta.
 */
function paintBlockChip(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 22;
  canvas.height = 21;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no disponible');
  const papel = new Path2D();
  papel.roundRect(1, 1, 20, 19, [3, 5, 4, 6]);
  ctx.fillStyle = MASKING;
  ctx.fill(papel);
  ctx.save();
  ctx.translate(3, 2.6);
  ctx.scale(16 / 24, 16 / 24);
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = PLUMON_SUAVE;
  ctx.stroke(new Path2D('M4.2 5.3h15.6l-.2 10.1h-8.2l-4.3 3.6.3-3.6H4.4Z'));
  ctx.strokeStyle = PLUMON;
  ctx.stroke(new Path2D('M3.6 3.4 20.6 20.3'));
  ctx.restore();
  return canvas;
}

/** Corazón a trazo de plumón (el mismo del ícono `corazon`), en la rejilla de 24. */
export const CORAZON_PATH =
  'M12 19.7c-4.9-3-8.1-6.1-8.1-9.6 0-2.5 1.9-4.4 4.2-4.4 1.7 0 3.1 1 3.9 2.5.9-1.6 2.3-2.5 4-2.5 2.3 0 4.1 1.9 4.1 4.4 0 3.5-3.2 6.6-8.1 9.6Z';

/**
 * La marca de amistad (ADR-0011), al revés de la de bloqueo: un papelito
 * verde de hecho con el corazón a plumón. Solo la ve quien es su amigo.
 */
function paintFriendChip(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 22;
  canvas.height = 21;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no disponible');
  const papel = new Path2D();
  papel.roundRect(1, 1, 20, 19, [5, 3, 6, 4]);
  ctx.fillStyle = FOSFO_VERDE;
  ctx.fill(papel);
  ctx.save();
  ctx.translate(3, 2.6);
  ctx.scale(16 / 24, 16 / 24);
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = PLUMON;
  ctx.stroke(new Path2D(CORAZON_PATH));
  ctx.restore();
  return canvas;
}

/** Sentado (ADR-0013): cuánto se levanta el dibujo para quedar sobre el asiento. */
export type Postura = { lift: number } | null;

type Globo = { image: Phaser.GameObjects.Image; key: string; born: number; until: number };
type Gesto = {
  image: Phaser.GameObjects.Image;
  emote: Emote;
  frames: string[];
  born: number;
  until: number;
};

/**
 * Una persona en el mundo: sprite, sombra y su nombre en una etiqueta de
 * papel (la interfaz es papel aunque flote en el mundo). La propia lleva la
 * etiqueta en marcatextos para encontrarte de un vistazo. Encima de la
 * etiqueta cuelga su globo cuando habla y, más arriba, el gesto que hace.
 */
export class Persona {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly scene: Phaser.Scene;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly tag: Phaser.GameObjects.Text | null;
  private readonly sheetKey: string;
  private readonly name: string | null;
  private readonly own: boolean;
  private readonly look: Look;
  private facing: Facing;
  private away = false;
  private blocked = false;
  private friend = false;
  /** El papelito junto al nombre: bloqueo o amistad (el bloqueo gana). */
  private chip: Phaser.GameObjects.Image | null = null;
  private globo: Globo | null = null;
  private gesto: Gesto | null = null;
  /** Inicio del brinco (hora de la escena) y cuántos brincos. */
  private hop: { since: number; count: number } | null = null;
  private zoom = 1;
  private at = { px: 0, py: 0 };
  /** Sentado: cuánto sube el dibujo (px de arte). null = de pie. */
  private sentado: Postura = null;
  /** Cuánto sube el globo para no taparse con otro (lo decide la escena). */
  private globoLift = 0;
  private globoNatural: GloboRect | null = null;

  constructor(
    scene: Phaser.Scene,
    look: Look,
    options: { name?: string; own?: boolean; facing?: Facing },
  ) {
    this.scene = scene;
    this.look = look;
    this.sheetKey = ensureLook(scene, look);
    this.name = options.name ?? null;
    this.own = options.own === true;
    this.facing = options.facing ?? 'down';
    this.shadow = scene.add.image(0, 0, 'sombra-persona').setOrigin(0.5, 0.5).setDepth(-5);
    this.sprite = scene.add
      .sprite(0, 0, this.sheetKey, this.idleFrame())
      .setOrigin(0.5, FEET_ORIGIN_Y);
    this.tag = options.name
      ? scene.add
          .text(0, 0, options.name, {
            fontFamily: NAME_FONT,
            fontSize: `${NAME_FONT_PX}px`,
            fontStyle: '600',
            color: PLUMON,
            backgroundColor: this.own ? '#efff3a' : CARTULINA,
            padding: { x: 6, y: 2 },
          })
          .setOrigin(0.5, 1)
          .setDepth(NAME_DEPTH)
      : null;
  }

  private idleFrame(): number {
    return DIRECTIONS.indexOf(this.facing) * SHEET_COLUMNS;
  }

  /**
   * Posición en tiles (pies), mirando, si camina y, sentado, cuánto sube el
   * dibujo. Sentado no se anima: la pose es un solo cuadro.
   */
  draw(
    x: number,
    y: number,
    facing: Facing,
    moving: boolean,
    animate: boolean,
    postura: Postura = null,
  ): void {
    const px = Math.round(x * TILE);
    const py = Math.round(y * TILE);
    this.at = { px, py };
    this.facing = facing;
    this.sentado = postura;
    const lift = postura?.lift ?? 0;
    this.sprite.setPosition(px, py - lift).setDepth(y * TILE);
    this.shadow.setPosition(px, py).setVisible(postura === null || lift < 6);
    if (postura) {
      this.sprite.anims.stop();
      this.sprite.setFrame(DIRECTIONS.indexOf(facing) * SHEET_COLUMNS + SIT_FRAME);
    } else if (moving && animate) {
      this.sprite.anims.play(`caminar:${this.sheetKey}:${facing}`, true);
    } else {
      this.sprite.anims.stop();
      this.sprite.setFrame(this.idleFrame());
    }
  }

  /** Cuánto más abajo queda la coronilla que de pie (sentado baja la cabeza y sube el dibujo). */
  private get bajaCabeza(): number {
    return this.sentado ? SIT_DROP - this.sentado.lift : 0;
  }

  /**
   * Lo que cuelga sobre la persona, cada cuadro: el brinco del gesto, la
   * etiqueta, el globo y el gesto. `now` es la hora de la escena; `animate`
   * en falso (movimiento reducido o `?quieto`) deja todo quieto: aparece y se va.
   */
  tick(now: number, animate: boolean): void {
    const { px } = this.at;
    const lift = animate ? this.hopLift(now) : 0;
    const py = this.at.py - lift;
    this.sprite.setY(py - (this.sentado?.lift ?? 0));

    let top = py - FRAME_H - 2 + this.bajaCabeza;
    if (this.tag) {
      this.tag.setPosition(px, top);
      if (this.chip) {
        this.chip.setPosition(px - this.tag.displayWidth / 2 - 1 / this.zoom, top);
      }
      top -= this.tag.displayHeight;
    }

    const globo = this.globo;
    if (globo) {
      if (now >= globo.until) {
        this.dropGlobo();
      } else {
        const age = now - globo.born;
        const left = globo.until - now;
        // Sale del pico hacia arriba, 4 px de pantalla, sin escalar (el texto sigue nítido).
        const pop = animate && age < GLOBO_POP_MS ? (1 - age / GLOBO_POP_MS) * 4 : 0;
        const image = globo.image;
        const natural = top - 1 / this.zoom;
        const y = natural - this.globoLift + pop / this.zoom;
        image
          .setPosition(px, y)
          .setAlpha(animate ? Math.min(1, left / GLOBO_FADE_MS, age / GLOBO_POP_MS + 0.2) : 1);
        // El papel (sin su sombra) donde quedaría sin apilar.
        const s = image.scaleY;
        const up = image.height * image.originY * s;
        const left0 = px - image.width * image.originX * s;
        this.globoNatural = {
          x0: left0 + GLOBO_SHADOW_SIDE * s,
          x1: left0 + (image.width - GLOBO_SHADOW_SIDE) * s,
          y0: natural - up + GLOBO_SHADOW_TOP * s,
          y1: natural,
          born: globo.born,
        };
        // Lo que sigue (el gesto) va encima del papel, no de su sombra.
        top = y - image.height * image.originY * image.scaleY + GLOBO_SHADOW_TOP * image.scaleY;
      }
    }

    const gesto = this.gesto;
    if (gesto) {
      if (now >= gesto.until) {
        this.dropGesto();
      } else {
        const age = now - gesto.born;
        const left = gesto.until - now;
        // Sube de a pixel entero (escala entera, ADR-0007) y se apaga al final.
        const rise = animate ? Math.min(4, Math.floor(age / 160)) : 0;
        const shake = animate && gesto.emote === 'laugh' ? Math.floor(age / 90) % 2 : 0;
        const frame = animate ? Math.floor(age / 170) % gesto.frames.length : 0;
        const key = gesto.frames[frame] ?? gesto.frames[0] ?? '';
        if (gesto.image.texture.key !== key) gesto.image.setTexture(key);
        gesto.image
          .setPosition(px, Math.round(top - 2 - rise - shake))
          .setAlpha(animate ? Math.min(1, left / GESTO_FADE_MS) : 1);
      }
    }
  }

  /** Cuánto se levanta del piso por el brinco del gesto, en pixeles de arte. */
  private hopLift(now: number): number {
    const hop = this.hop;
    if (!hop) return 0;
    const each = hop.count > 1 ? 170 : 230;
    const t = now - hop.since;
    if (t >= each * hop.count) {
      this.hop = null;
      return 0;
    }
    const phase = (t % each) / each;
    const height = hop.count > 1 ? 2 : 3;
    return Math.round(Math.sin(phase * Math.PI) * height);
  }

  /** Cuelga un globo nuevo (el anterior se quita: una persona, un globo). */
  say(key: string, art: GloboArt, now: number, durationMs: number): void {
    this.dropGlobo();
    addCanvasTexture(this.scene, key, () => art.canvas);
    const tipX = art.width * 0.46 + 1;
    const image = this.scene.add
      .image(0, 0, key)
      .setOrigin(tipX / art.width, (art.height - art.tipFromBottom) / art.height)
      .setScale(1 / this.zoom)
      .setDepth(NAME_DEPTH + 1);
    this.globo = { image, key, born: now, until: now + durationMs };
  }

  /** Hace un gesto: brinca y el dibujo sube sobre su cabeza. */
  gesture(emote: Emote, now: number, durationMs: number): void {
    this.dropGesto();
    const baseKey = emoteKey(emote, this.look);
    const art = paintEmote(emote, this.look);
    const frames = art.frames.map((canvas, i) => {
      const key = `${baseKey}:${i}`;
      addCanvasTexture(this.scene, key, () => canvas);
      return key;
    });
    const image = this.scene.add
      .image(0, 0, frames[0] ?? '')
      .setOrigin(0.5, 1)
      .setDepth(NAME_DEPTH + 2);
    this.gesto = { image, emote, frames, born: now, until: now + durationMs };
    this.hop = { since: now, count: emote === 'laugh' ? 2 : 1 };
  }

  /** Lo que tiene colgado ahora (pruebas E2E). */
  get showing(): { globo: boolean; gesto: Emote | null } {
    return { globo: this.globo !== null, gesto: this.gesto?.emote ?? null };
  }

  /** El globo sin apilar (del cuadro anterior), si hay. */
  get globoRect(): GloboRect | null {
    return this.globo ? this.globoNatural : null;
  }

  /** Dónde está la etiqueta del nombre (con su marca), en pixeles del mundo. */
  get tagRect(): GloboRect | null {
    const tag = this.tag;
    if (!tag) return null;
    const half = tag.displayWidth / 2;
    const chip = this.chip ? this.chip.displayWidth + 1 / this.zoom : 0;
    return {
      x0: tag.x - half - chip,
      x1: tag.x + half,
      y0: tag.y - tag.displayHeight,
      y1: tag.y,
      born: 0,
    };
  }

  /** Sube el globo para que no tape (ni lo tape) el de alguien más. */
  setGloboLift(lift: number): void {
    this.globoLift = lift;
  }

  private dropGlobo(): void {
    this.globoNatural = null;
    this.globoLift = 0;
    if (!this.globo) return;
    this.globo.image.destroy();
    if (this.scene.textures.exists(this.globo.key)) this.scene.textures.remove(this.globo.key);
    this.globo = null;
  }

  private dropGesto(): void {
    this.gesto?.image.destroy();
    this.gesto = null;
  }

  /**
   * Se le cayó la conexión y la sala le guarda el lugar (§17): queda
   * desvanecida y su etiqueta lo dice, para que nadie le hable a un hueco.
   */
  setAway(away: boolean): void {
    if (away === this.away) return;
    this.away = away;
    this.sprite.setAlpha(away ? 0.45 : 1);
    this.shadow.setAlpha(away ? 0.5 : 1);
    if (this.tag && this.name) {
      this.tag.setText(away ? `${this.name} · sin señal` : this.name).setAlpha(away ? 0.78 : 1);
    }
  }

  /**
   * La bloqueaste (ADR-0010): sigue caminando, pero su etiqueta pasa a
   * masking con el globo tachado. Solo lo ve quien bloquea.
   */
  setBlocked(blocked: boolean): void {
    if (blocked === this.blocked || !this.tag) return;
    this.blocked = blocked;
    this.tag.setBackgroundColor(blocked ? MASKING : this.own ? '#efff3a' : CARTULINA);
    this.tag.setColor(blocked ? PLUMON_SUAVE : PLUMON);
    if (blocked) {
      this.dropGlobo();
      this.dropGesto();
    }
    this.refreshChip();
  }

  /** Es tu amigo (ADR-0011): su etiqueta lleva el papelito verde con el corazón. */
  setFriend(friend: boolean): void {
    if (friend === this.friend || !this.tag) return;
    this.friend = friend;
    this.refreshChip();
  }

  private refreshChip(): void {
    const want = this.blocked ? 'marca-bloqueo' : this.friend ? 'marca-amistad' : null;
    if ((this.chip?.texture.key ?? null) === want) return;
    this.chip?.destroy();
    this.chip = null;
    if (!want) return;
    addCanvasTexture(this.scene, want, want === 'marca-bloqueo' ? paintBlockChip : paintFriendChip);
    this.chip = this.scene.add
      .image(0, 0, want)
      .setOrigin(1, 1)
      .setScale(1 / this.zoom)
      .setDepth(NAME_DEPTH);
  }

  /** ¿Cae este punto del mundo (px) sobre la persona? Con margen para el dedo. */
  contains(worldX: number, worldY: number, pad: number): boolean {
    const { px, py } = this.at;
    return (
      worldX >= px - FRAME_W / 2 - pad &&
      worldX <= px + FRAME_W / 2 + pad &&
      worldY >= py - FRAME_H + this.bajaCabeza - pad &&
      worldY <= py + pad
    );
  }

  /** El nombre, el globo y la marca se escalan 1/zoom: su textura cae 1:1 en pantalla. */
  setZoom(zoom: number): void {
    this.zoom = zoom;
    this.tag?.setScale(1 / zoom);
    this.chip?.setScale(1 / zoom);
    this.globo?.image.setScale(1 / zoom);
  }

  destroy(): void {
    this.dropGlobo();
    this.dropGesto();
    this.chip?.destroy();
    this.sprite.destroy();
    this.shadow.destroy();
    this.tag?.destroy();
  }
}
