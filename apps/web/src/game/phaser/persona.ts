import type { Facing } from '@wous/game-core';
import type Phaser from 'phaser';
import {
  DIRECTIONS,
  FRAME_H,
  FRAME_W,
  type Look,
  lookKey,
  spriteSheet,
  WALK_FRAMES,
} from '../rendering/pixel-character.ts';
import { painter } from '../world-art/paint.ts';
import { TILE } from '../world-art/world-palette.ts';

/** Los pies del sprite están en la fila 30 de 32: ahí se ancla al suelo. */
const FEET_ORIGIN_Y = 31 / FRAME_H;
/** Los nombres van sobre todo el mundo (incluido el papel picado). */
const NAME_DEPTH = 200_000;
/** Tamaño del nombre en pixeles de PANTALLA (se escala 1/zoom para verse nítido). */
const NAME_FONT_PX = 13;
export const NAME_FONT = '"Bricolage Grotesque Variable", system-ui, sans-serif';

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
    for (const frame of WALK_FRAMES) {
      const index = row * WALK_FRAMES.length + frame;
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
          frame: row * WALK_FRAMES.length + frame,
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
 * Una persona en el mundo: sprite, sombra y su nombre en una etiqueta de
 * papel (la interfaz es papel aunque flote en el mundo). La propia lleva la
 * etiqueta en marcatextos para encontrarte de un vistazo.
 */
export class Persona {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly tag: Phaser.GameObjects.Text | null;
  private readonly sheetKey: string;
  private facing: Facing;

  constructor(
    scene: Phaser.Scene,
    look: Look,
    options: { name?: string; own?: boolean; facing?: Facing },
  ) {
    this.sheetKey = ensureLook(scene, look);
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
            color: '#17101b',
            backgroundColor: options.own ? '#efff3a' : '#fffbf1',
            padding: { x: 6, y: 2 },
          })
          .setOrigin(0.5, 1)
          .setDepth(NAME_DEPTH)
      : null;
  }

  private idleFrame(): number {
    return DIRECTIONS.indexOf(this.facing) * WALK_FRAMES.length;
  }

  /** Posición en tiles (pies), mirando y si camina. */
  draw(x: number, y: number, facing: Facing, moving: boolean, animate: boolean): void {
    const px = Math.round(x * TILE);
    const py = Math.round(y * TILE);
    this.facing = facing;
    this.sprite.setPosition(px, py).setDepth(y * TILE);
    this.shadow.setPosition(px, py);
    if (this.tag) this.tag.setPosition(px, py - FRAME_H - 2);
    if (moving && animate) {
      this.sprite.anims.play(`caminar:${this.sheetKey}:${facing}`, true);
    } else {
      this.sprite.anims.stop();
      this.sprite.setFrame(this.idleFrame());
    }
  }

  /** El nombre se escala 1/zoom: su textura cae 1:1 en pixeles de pantalla. */
  setZoom(zoom: number): void {
    this.tag?.setScale(1 / zoom);
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
    this.tag?.destroy();
  }
}
