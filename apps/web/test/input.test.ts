import type { GameInput } from '@wous/game-core';
import { describe, expect, it } from 'vitest';
import { GamepadAdapter, KeyboardAdapter, TouchAdapter } from '../src/game/input/adapters.ts';
import { InputManager } from '../src/game/input/input-manager.ts';
import { InputSampler } from '../src/game/network/input-sampler.ts';

describe('teclado', () => {
  it('WASD y flechas producen el mismo vector; el diagonal se normaliza en el manager', () => {
    const kb = new KeyboardAdapter();
    kb.handleKey('KeyD', true, false);
    kb.handleKey('ArrowUp', true, false);
    expect(kb.read()).toEqual({ x: 1, y: -1, interact: false });
    const manager = new InputManager('KEYBOARD_MOUSE');
    manager.setSources([kb]);
    const { moveX, moveY } = manager.poll();
    expect(Math.hypot(moveX, moveY)).toBeCloseTo(1, 6);
  });

  it('interactuar es de flanco: una pulsación = una interacción', () => {
    const kb = new KeyboardAdapter();
    kb.handleKey('KeyE', true, false);
    expect(kb.read().interact).toBe(true);
    expect(kb.read().interact).toBe(false);
  });

  it('1–4 son los gestos, de flanco; mantener la tecla no los repite', () => {
    const kb = new KeyboardAdapter();
    expect(kb.handleKey('Digit1', true, false)).toBe(true);
    expect(kb.read()).toEqual({ x: 0, y: 0, interact: false, emote: 'wave' });
    expect(kb.read().emote).toBeUndefined();
    kb.handleKey('Numpad4', true, false);
    const manager = new InputManager('KEYBOARD_MOUSE');
    manager.setSources([kb]);
    expect(manager.poll().emote).toBe('thumbs_up');
    expect(manager.poll().emote).toBeUndefined();
    // Escribiendo en el chat, un 3 es un 3, no un corazón.
    expect(kb.handleKey('Digit3', true, true)).toBe(false);
    expect(kb.read().emote).toBeUndefined();
  });

  it('las calcomanías entran al juego como la tecla, en ratón o en táctil', () => {
    const kb = new KeyboardAdapter();
    const touch = new TouchAdapter();
    const manager = new InputManager('TOUCH');
    manager.setSources([kb, touch]);
    touch.pressEmote('heart');
    expect(manager.poll().emote).toBe('heart');
    kb.pressEmote('laugh');
    expect(manager.poll().emote).toBe('laugh');
  });

  it('escribir en un campo no mueve al personaje', () => {
    const kb = new KeyboardAdapter();
    expect(kb.handleKey('KeyW', true, true)).toBe(false);
    expect(kb.read()).toEqual({ x: 0, y: 0, interact: false });
  });
});

describe('método activo', () => {
  it('pasar a táctil es inmediato; volver al teclado espera el debounce', () => {
    let now = 0;
    const manager = new InputManager('KEYBOARD_MOUSE', () => now, 400);
    const seen: string[] = [];
    manager.subscribe((m) => seen.push(m));
    const touch = new TouchAdapter((m) => manager.markActive(m));
    const kb = new KeyboardAdapter((m) => manager.markActive(m));
    manager.setSources([kb, touch]);

    touch.setVector(0.5, 0);
    expect(manager.activeMethod).toBe('TOUCH');

    kb.handleKey('KeyW', true, false);
    expect(manager.activeMethod).toBe('TOUCH');
    now = 450;
    manager.poll();
    expect(manager.activeMethod).toBe('KEYBOARD_MOUSE');
    expect(seen).toEqual(['TOUCH', 'KEYBOARD_MOUSE']);
  });

  it('el mando se detecta cuando se usa', () => {
    const manager = new InputManager('KEYBOARD_MOUSE', () => 1_000, 0);
    const pad = new GamepadAdapter(
      (m) => manager.markActive(m),
      () => [{ axes: [0.9, 0], buttons: [{ pressed: false }] }],
    );
    manager.setSources([pad]);
    expect(manager.poll().moveX).toBeCloseTo(0.9, 6);
    expect(manager.activeMethod).toBe('GAMEPAD');
  });
});

describe('muestreador de red (12 Hz)', () => {
  const run = (frames: { t: number; x: number; y: number }[]) => {
    const sent: GameInput[] = [];
    const sampler = new InputSampler((i) => sent.push(i), 12);
    for (const f of frames) sampler.tick(f.t, { moveX: f.x, moveY: f.y, interact: false });
    return sent;
  };

  it('manda en el acto al empezar, al cambiar de dirección y al soltar', () => {
    const sent = run([
      { t: 0, x: 1, y: 0 },
      { t: 16, x: 1, y: 0 },
      { t: 32, x: 0, y: 1 },
      { t: 48, x: 0, y: 0 },
    ]);
    expect(sent.map((s) => [s.moveX, s.moveY])).toEqual([
      [1, 0],
      [0, 1],
      [0, 0],
    ]);
    expect(sent.map((s) => s.seq)).toEqual([1, 2, 3]);
  });

  it('mientras camina, ~12 envíos por segundo aunque haya 60 cuadros', () => {
    const frames = Array.from({ length: 60 }, (_, i) => ({ t: i * (1000 / 60), x: 1, y: 0 }));
    const sent = run(frames);
    expect(sent.length).toBeGreaterThanOrEqual(11);
    expect(sent.length).toBeLessThanOrEqual(13);
  });

  it('parado no manda nada', () => {
    expect(
      run([
        { t: 0, x: 0, y: 0 },
        { t: 500, x: 0, y: 0 },
      ]),
    ).toEqual([]);
  });
});
