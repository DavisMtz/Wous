import type { InputMethod } from '@wous/game-core';

/**
 * Perfil del dispositivo por CAPACIDADES, no por User-Agent (§11). Puede
 * cambiar en caliente: un híbrido enchufa un teclado, una tablet gira.
 */
export type DeviceProfile = {
  hasTouch: boolean;
  maxTouchPoints: number;
  coarsePointer: boolean;
  hover: boolean;
  hasKeyboardEvidence: boolean;
  hasMouseEvidence: boolean;
  hasGamepad: boolean;
  viewportWidth: number;
  viewportHeight: number;
  orientation: 'portrait' | 'landscape';
};

export type Evidence = { keyboard: boolean; mouse: boolean };

export function readDeviceProfile(
  evidence: Evidence = { keyboard: false, mouse: false },
): DeviceProfile {
  const mq = (query: string) => window.matchMedia(query).matches;
  const maxTouchPoints = navigator.maxTouchPoints ?? 0;
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  return {
    hasTouch: maxTouchPoints > 0 || 'ontouchstart' in window,
    maxTouchPoints,
    coarsePointer: mq('(pointer: coarse)'),
    hover: mq('(hover: hover)'),
    hasKeyboardEvidence: evidence.keyboard,
    hasMouseEvidence: evidence.mouse,
    hasGamepad: pads.length > 0,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    orientation: mq('(orientation: portrait)') ? 'portrait' : 'landscape',
  };
}

/** Método con el que se arranca antes de ver evidencia real de uso. */
export function initialInputMethod(profile: DeviceProfile): InputMethod {
  if (profile.hasGamepad) return 'GAMEPAD';
  if (profile.coarsePointer && !profile.hover && profile.hasTouch) return 'TOUCH';
  return 'KEYBOARD_MOUSE';
}
