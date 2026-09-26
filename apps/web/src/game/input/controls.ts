import { GamepadAdapter, KeyboardAdapter, TouchAdapter } from './adapters.ts';
import { type DeviceProfile, initialInputMethod, readDeviceProfile } from './device-profile.ts';
import { InputManager } from './input-manager.ts';

/**
 * Arma la entrada completa de una sesión de juego: adaptadores, manager y la
 * evidencia de uso que llega de la ventana (§11, híbridos). Devuelve todo y
 * cómo soltarlo; quien juega solo ve `manager`.
 */
export type Controls = {
  manager: InputManager;
  keyboard: KeyboardAdapter;
  touch: TouchAdapter;
  gamepad: GamepadAdapter;
  profile: DeviceProfile;
  dispose(): void;
};

/** Marca de los controles táctiles en pantalla (joystick y botón contextual). */
export const TOUCH_CONTROL_ATTR = 'data-control-tactil';

export function createControls(win: Window): Controls {
  const profile = readDeviceProfile();
  const manager = new InputManager(initialInputMethod(profile));
  const mark = manager.markActive.bind(manager);
  const keyboard = new KeyboardAdapter(mark);
  const touch = new TouchAdapter(mark);
  const gamepad = new GamepadAdapter(mark);
  manager.setSources([keyboard, touch, gamepad]);

  const detachKeyboard = keyboard.attach(win);
  const onPointer = (e: PointerEvent) => {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      manager.markActive('TOUCH');
      return;
    }
    // Un ratón (o la emulación de uno) sobre el joystick no es evidencia de
    // teclado: lo que ahí pase ya lo reporta el TouchAdapter.
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest(`[${TOUCH_CONTROL_ATTR}]`)) return;
    if (e.pointerType === 'mouse') manager.markActive('KEYBOARD_MOUSE');
  };
  const onHidden = () => {
    if (document.hidden) manager.release();
  };
  win.addEventListener('pointerdown', onPointer, { passive: true });
  win.addEventListener('pointermove', onPointer, { passive: true });
  document.addEventListener('visibilitychange', onHidden);

  return {
    manager,
    keyboard,
    touch,
    gamepad,
    profile,
    dispose() {
      detachKeyboard();
      win.removeEventListener('pointerdown', onPointer);
      win.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onHidden);
      manager.release();
    },
  };
}
