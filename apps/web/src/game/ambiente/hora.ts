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
 * Solo el banco de desarrollo (`?hora=HH:MM`, `?sabado`): un reloj que
 * arranca hoy (o el último `diaSemana`) a esa hora de Morelia y de ahí corre
 * normal, para revisar las fuentes danzantes, las campanadas, la noche o las
 * Luces de Catedral sin esperar.
 */
export function relojDesde(minutos: number, localAhora: number, diaSemana?: number) {
  const hoy = Date.now();
  const enElDia = (((hoy + MORELIA_UTC_MS) % DIA_MS) + DIA_MS) % DIA_MS;
  const atras = diaSemana === undefined ? 0 : (horaDeMorelia(hoy).diaSemana - diaSemana + 7) % 7;
  const arranque = hoy - enElDia - atras * DIA_MS + minutos * 60_000;
  return (localNow: number): number => arranque + (localNow - localAhora);
}

/** La Catedral de Morelia, para el sol. */
const LATITUD = 19.7026;
const LONGITUD = -101.1923;
/** El meridiano del horario del centro (UTC−6). */
const MERIDIANO = -90;

/**
 * La salida y la puesta del sol en Morelia el día de `serverMs`, en minutos
 * desde la medianoche (hora local). Fórmulas de almanaque (declinación y
 * ecuación del tiempo aproximadas): un par de minutos de error bastan.
 */
export function solDeMorelia(serverMs: number): { salida: number; puesta: number } {
  const local = serverMs + MORELIA_UTC_MS;
  const inicioDelAnio = Date.UTC(new Date(local).getUTCFullYear(), 0, 1);
  const n = Math.floor((local - inicioDelAnio) / DIA_MS) + 1;
  const rad = Math.PI / 180;
  const declinacion = 23.44 * rad * Math.sin((2 * Math.PI * (284 + n)) / 365);
  // −0.833°: el borde del sol y la refracción.
  const cosAngulo =
    (Math.sin(-0.833 * rad) - Math.sin(LATITUD * rad) * Math.sin(declinacion)) /
    (Math.cos(LATITUD * rad) * Math.cos(declinacion));
  const medioDia = (Math.acos(Math.max(-1, Math.min(1, cosAngulo))) / rad) * 4;
  const b = (2 * Math.PI * (n - 81)) / 364;
  const ecuacion = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
  const mediodia = 12 * 60 + 4 * (MERIDIANO - LONGITUD) - ecuacion;
  return { salida: mediodia - medioDia, puesta: mediodia + medioDia };
}

/**
 * Qué tan de noche es: 0 de día, 1 de noche cerrada. Oscurece de un cuarto
 * de hora antes de la puesta del sol a tres cuartos después, y aclara al revés.
 */
export function nocheDe(serverMs: number): number {
  const { h, enLaHora } = horaDeMorelia(serverMs);
  const minuto = h * 60 + enLaHora / 60_000;
  const { salida, puesta } = solDeMorelia(serverMs);
  const rampa = (x: number) => Math.max(0, Math.min(1, x));
  return Math.max(rampa((minuto - (puesta - 15)) / 60), rampa((salida + 15 - minuto) / 60));
}

/**
 * «Luces de Catedral»: cada sábado a las 21:00 la Catedral se apaga, suenan
 * la música y los fuegos artificiales y la iluminación vuelve poco a poco
 * (investigacion.md §1.6). Dura unos minutos: aquí siete, con dos de
 * Catedral a oscuras antes. `avance` va de 0 a 1 durante los fuegos.
 */
export const LUCES_DE_CATEDRAL = { diaSemana: 6, hora: 21, oscura: 2, fuegos: 7 } as const;

export function lucesDeCatedral(
  serverMs: number,
): { fase: 'oscura' | 'fuegos'; avance: number } | null {
  const { h, diaSemana, enLaHora } = horaDeMorelia(serverMs);
  const minutos = enLaHora / 60_000;
  const { diaSemana: sabado, hora, oscura, fuegos } = LUCES_DE_CATEDRAL;
  if (diaSemana !== sabado) return null;
  if (h === hora - 1 && minutos >= 60 - oscura) return { fase: 'oscura', avance: 0 };
  if (h === hora && minutos < fuegos) return { fase: 'fuegos', avance: minutos / fuegos };
  return null;
}
