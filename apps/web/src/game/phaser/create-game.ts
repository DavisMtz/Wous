import type { Vec } from '@wous/game-core';
import Phaser from 'phaser';
import { WorldScene, type WorldSceneOptions } from './world-scene.ts';

export type GameHandle = {
  /** Posición del jugador en tiles, o null si la escena aún no arranca. */
  position(): Vec | null;
  /** Dónde se dibuja a los demás (pruebas E2E). */
  remotes(): { id: string; x: number; y: number }[];
  /** Quién tiene un globo o un gesto encima ahora (pruebas E2E). */
  hanging(): { id: string; globo: boolean; gesto: string | null }[];
  /** A quién tocaste en la pantalla (clic o dedo), o null. */
  personAt(clientX: number, clientY: number): string | null;
  /** Sin servidor (banco de desarrollo): lo que dices cuelga sobre ti. */
  sayLocal(text: string): void;
  pause(): void;
  resume(): void;
  destroy(): void;
};

/**
 * Arranca Phaser dentro de `parent` (que debe tener tamaño propio). La
 * entrada de Phaser va apagada: el juego solo recibe `GameInput` del
 * InputManager (§11), nunca teclas ni toques.
 */
export function createGame(parent: HTMLElement, options: WorldSceneOptions): GameHandle {
  const scene = new WorldScene(options);
  const game = new Phaser.Game({
    // Canvas en modo quieto: los navegadores sin GPU (CI, capturas) lo pintan igual.
    type: options.quiet ? Phaser.CANVAS : Phaser.AUTO,
    parent,
    pixelArt: true,
    banner: false,
    autoFocus: false,
    disableContextMenu: true,
    backgroundColor: '#2e2632',
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    audio: { noAudio: true },
    scene,
  });
  return {
    position: () => (scene.sys?.isActive() ? scene.playerPosition : null),
    remotes: () => (scene.sys?.isActive() ? scene.remotePositions : []),
    hanging: () => (scene.sys?.isActive() ? scene.hanging : []),
    personAt: (clientX, clientY) => {
      const rect = game.canvas?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return null;
      const x = ((clientX - rect.left) * game.scale.width) / rect.width;
      const y = ((clientY - rect.top) * game.scale.height) / rect.height;
      return scene.personAt(x, y);
    },
    sayLocal: (text) => {
      if (scene.sys?.isActive()) scene.sayLocal(text);
    },
    pause: () => game.pause(),
    resume: () => game.resume(),
    destroy: () => game.destroy(true),
  };
}
