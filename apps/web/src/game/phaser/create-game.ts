import type { Vec } from '@wous/game-core';
import Phaser from 'phaser';
import { WorldScene, type WorldSceneOptions } from './world-scene.ts';

export type GameHandle = {
  /** Posición del jugador en tiles, o null si la escena aún no arranca. */
  position(): Vec | null;
  /** Dónde se dibuja a los demás (pruebas E2E). */
  remotes(): { id: string; x: number; y: number }[];
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
    pause: () => game.pause(),
    resume: () => game.resume(),
    destroy: () => game.destroy(true),
  };
}
