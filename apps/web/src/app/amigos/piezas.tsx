import type { AppearanceInput, FriendEntry } from '@wous/contracts';
import { useMemo } from 'react';
import { lookFromAppearance } from '../../game/rendering/appearance.ts';
import { Miniatura, RECORTES } from '../../ui/scene/Miniatura.tsx';

/**
 * Piezas comunes de la página de tu banda (ADR-0011): el retrato en pixel
 * art, las fechas en palabras y las acciones que la página le pide al
 * servidor (fallan con el error de la API; la lista se actualiza sola).
 */

export type AccionesDeBanda = {
  aceptar(entry: FriendEntry): Promise<unknown>;
  rechazar(entry: FriendEntry): Promise<unknown>;
  /** Tu solicitud: la retiras. */
  cancelar(entry: FriendEntry): Promise<unknown>;
  /** Una amistad: se termina. */
  quitar(entry: FriendEntry): Promise<unknown>;
  bloquear(entry: FriendEntry): Promise<unknown>;
};

/** Cabeza y hombros en pixel art. */
export function Retrato({
  appearance,
  escala = 3,
}: {
  appearance: AppearanceInput;
  escala?: number;
}) {
  const look = useMemo(() => lookFromAppearance(appearance), [appearance]);
  return <Miniatura look={look} recorte={RECORTES.cabeza} escala={escala} />;
}

const RELATIVO = new Intl.RelativeTimeFormat('es-MX', { numeric: 'auto' });
const FECHA = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long' });
const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

/** «hace un momento», «hace 2 horas», «ayer», «hace 3 días» o «el 12 de septiembre». */
export function haceCuanto(t: number, ahora: number): string {
  const pasado = Math.max(0, ahora - t);
  if (pasado < HORA) return 'hace un momento';
  if (pasado < DIA) return RELATIVO.format(-Math.round(pasado / HORA), 'hour');
  if (pasado < 7 * DIA) return RELATIVO.format(-Math.round(pasado / DIA), 'day');
  return `el ${FECHA.format(t)}`;
}

/** «desde el 12 de septiembre». */
export function desdeCuando(t: number): string {
  return `desde el ${FECHA.format(t)}`;
}

export function cuantos(n: number, una: string, varias: string): string {
  return `${n} ${n === 1 ? una : varias}`;
}
