/**
 * La hora de Morelia para el ambiente de la Plaza: cuándo están prendidas las
 * fuentes danzantes y cuándo suenan las campanadas. Sale de la hora del
 * servidor (`RoomState.serverNow`), así que en todos los teléfonos pasa lo
 * mismo a la vez; nada de esto pasa por la sala (es solo ambiente).
 *
 * Morelia usa el horario del centro de México: UTC−6 todo el año (desde
 * 2022 no hay horario de verano).
 */

const HORA_MS = 3_600_000;
const DIA_MS = 24 * HORA_MS;
export const MORELIA_UTC_MS = -6 * HORA_MS;

export type Hora = {
  /** 0–23 */
  h: number;
  /** 0–59 */
  m: number;
  /** Milisegundos desde que empezó la hora. */
  enLaHora: number;
  /** 0 = domingo … 6 = sábado. */
  diaSemana: number;
};

export function horaDeMorelia(serverMs: number): Hora {
  const local = serverMs + MORELIA_UTC_MS;
  const enElDia = ((local % DIA_MS) + DIA_MS) % DIA_MS;
  const dias = Math.floor(local / DIA_MS);
  return {
    h: Math.floor(enElDia / HORA_MS),
    m: Math.floor((enElDia % HORA_MS) / 60_000),
    enLaHora: enElDia % HORA_MS,
    // El 1 de enero de 1970 fue jueves.
    diaSemana: (((dias + 4) % 7) + 7) % 7,
  };
}

/**
 * Las fuentes danzantes funcionan en dos turnos de ≈3 horas, por la mañana y
 * por la tarde (MiMorelia, febrero de 2026). La nota no da las horas: aquí van
 * de 10 a 13 y de 17 a 20.
 */
export const TURNOS_DANZANTES: readonly (readonly [number, number])[] = [
  [10, 13],
  [17, 20],
];

export function danzantesEncendidas(serverMs: number): boolean {
  const { h } = horaDeMorelia(serverMs);
  return TURNOS_DANZANTES.some(([desde, hasta]) => h >= desde && h < hasta);
}

/** Entre dos campanadas de la misma hora (ms). */
export const CAMPANADA_MS = 2_200;

/**
 * La campanada que suena ahora, si suena alguna: a cada hora en punto, un
 * toque por hora del reloj (de 1 a 12), uno cada `CAMPANADA_MS`. La `clave`
 * cambia en cada toque, para dar cada uno una sola vez.
 */
export function campanada(serverMs: number): { clave: string; toque: number; de: number } | null {
  const { h, enLaHora } = horaDeMorelia(serverMs);
  const de = ((h + 11) % 12) + 1;
  const toque = Math.floor(enLaHora / CAMPANADA_MS);
  if (toque >= de) return null;
  const hora = Math.floor((serverMs + MORELIA_UTC_MS) / HORA_MS);
  return { clave: `${hora}:${toque}`, toque: toque + 1, de };
}

/**
 * La hora del servidor para la escena. Antes del primer snapshot (o sin red,
 * en el banco) no hay reloj del servidor: vale el del teléfono.
 */
export function relojDelServidor(serverNow: ((local: number) => number) | undefined) {
  return (localNow: number): number => {
    const t = serverNow?.(localNow);
    // Un reloj de servidor es de época (ms desde 1970); uno local de performance.now() no.
    return t !== undefined && t > 1e12 ? t : Date.now();
  };
}

/**
 * Solo el banco de desarrollo (`?hora=HH:MM`): un reloj que arranca hoy a esa
 * hora de Morelia y de ahí corre normal, para revisar las fuentes danzantes o
 * las campanadas sin esperar.
 */
export function relojDesde(minutos: number, localAhora: number) {
  const hoy = Date.now();
  const enElDia = (((hoy + MORELIA_UTC_MS) % DIA_MS) + DIA_MS) % DIA_MS;
  const arranque = hoy - enElDia + minutos * 60_000;
  return (localNow: number): number => arranque + (localNow - localAhora);
}
