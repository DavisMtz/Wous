import { EMOTE_IDS, type Emote } from '@wous/contracts';
import type { InputMethod } from '@wous/game-core';
import { useLayoutEffect, useRef, useState } from 'react';
import { TOUCH_CONTROL_ATTR } from '../../game/input/controls.ts';
import type { Look } from '../../game/rendering/pixel-character.ts';
import { paintEmote } from '../../game/world-art/emotes.ts';
import { Icono } from '../../ui/components/Icono.tsx';
import { pixelCanvas } from '../../ui/scene/pixel-canvas.ts';

/** Cómo se llama cada gesto en la interfaz (el ID del cable no se enseña). */
export const NOMBRE_GESTO: Record<Emote, string> = {
  wave: 'Saludar',
  laugh: 'Reírte',
  heart: 'Corazón',
  thumbs_up: 'Pulgar arriba',
};

/**
 * El gesto en pixel art, pegado sobre la cartulina como calcomanía: el mismo
 * dibujo que sale sobre tu cabeza, con tu piel y tu playera, a escala entera.
 */
export function Calcomania({
  emote,
  look,
  escala = 2,
}: {
  emote: Emote;
  look: Look;
  escala?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const art = paintEmote(emote, look);
    const frame = art.frames[0];
    if (!frame) return;
    const p = pixelCanvas(canvas, art.w, art.h, escala);
    p.clear();
    p.sprite(frame, 0, 0, art.w, art.h, 0, 0);
  }, [emote, look, escala]);
  return <canvas ref={ref} className="pixel calcomania" />;
}

/**
 * Los cuatro gestos (§19). Con teclado son calcomanías con su tecla (1–4) al
 * pie de la pantalla; en táctil, una cartulina «Gestos» que despliega las
 * cuatro y se recoge al elegir. El gesto entra al juego como entrada
 * normalizada, igual que caminar.
 */
export function Gestos({
  look,
  metodo,
  onGesto,
}: {
  look: Look;
  metodo: InputMethod;
  onGesto: (emote: Emote) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const tactil = metodo === 'TOUCH';

  const calcomanias = EMOTE_IDS.map((emote, i) => (
    <button
      key={emote}
      type="button"
      className="gesto"
      onMouseDown={(e) => e.preventDefault()}
      aria-label={tactil ? NOMBRE_GESTO[emote] : `${NOMBRE_GESTO[emote]} (${i + 1})`}
      aria-keyshortcuts={tactil ? undefined : String(i + 1)}
      onClick={() => {
        onGesto(emote);
        if (tactil) setAbierto(false);
      }}
    >
      <Calcomania emote={emote} look={look} />
      {tactil ? null : <kbd className="gesto__tecla">{i + 1}</kbd>}
    </button>
  ));

  if (!tactil) {
    return (
      <div className="gestos" role="toolbar" aria-label="Gestos">
        {calcomanias}
      </div>
    );
  }
  return (
    <div className="gestos gestos--tactil" {...{ [TOUCH_CONTROL_ATTR]: '' }}>
      {abierto ? (
        <div className="gestos__abanico" role="toolbar" aria-label="Gestos">
          {calcomanias}
        </div>
      ) : null}
      <button
        type="button"
        className="boton-hud"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        <Icono name={abierto ? 'cerrar' : 'carita'} size={20} />
        <span>Gestos</span>
      </button>
    </div>
  );
}
