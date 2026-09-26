/**
 * Entrada normalizada (§11). Es lo ÚNICO que el juego conoce: nunca «tecla W»
 * ni «joystick izquierdo», y es lo que viaja al servidor como PLAYER_INPUT.
 */
export type GameInput = {
  seq: number;
  /** -1..1 */
  moveX: number;
  /** -1..1 */
  moveY: number;
  interact: boolean;
  emote?: string;
};

export const IDLE_INPUT: Omit<GameInput, 'seq'> = { moveX: 0, moveY: 0, interact: false };

export type InputMethod = 'KEYBOARD_MOUSE' | 'TOUCH' | 'GAMEPAD';

/** Estados del jugador (§33). No se combinan con booleanos sueltos. */
export type PlayerState =
  | 'OFFLINE'
  | 'AUTHENTICATED'
  | 'LOADING_WORLD'
  | 'IN_ROOM'
  | 'TRANSITIONING'
  | 'RECONNECTING';
