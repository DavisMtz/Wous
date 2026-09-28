import { canStandAt } from '@wous/game-core';
import { collisionGrid, PLAZA } from '@wous/world-data';
import { describe, expect, it } from 'vitest';
import {
  CAMPANADA_MS,
  campanada,
  danzantesEncendidas,
  horaDeMorelia,
  lucesDeCatedral,
  nocheDe,
  relojDelServidor,
  relojDesde,
  solDeMorelia,
} from '../src/game/ambiente/hora.ts';
import {
  lugaresDeParvada,
  PARVADAS,
  quienAsusta,
  RADIO_SUSTO,
  rumboDeHuida,
} from '../src/game/ambiente/palomas.ts';
import { PREGONES, pregonDe } from '../src/game/ambiente/pregones.ts';

const utc = (iso: string) => Date.parse(iso);

describe('la hora de Morelia', () => {
  it('va seis horas detrás de UTC, todo el año', () => {
    expect(horaDeMorelia(utc('2026-09-28T04:15:00Z'))).toMatchObject({
      h: 22,
      m: 15,
      diaSemana: 0,
    });
    // En enero tampoco hay horario de verano que la mueva.
    expect(horaDeMorelia(utc('2026-01-10T18:30:00Z'))).toMatchObject({
      h: 12,
      m: 30,
      diaSemana: 6,
    });
  });

  it('las fuentes danzantes, en dos turnos de tres horas: mañana y tarde', () => {
    expect(danzantesEncendidas(utc('2026-09-28T15:59:00Z'))).toBe(false); // 9:59
    expect(danzantesEncendidas(utc('2026-09-28T16:00:00Z'))).toBe(true); // 10:00
    expect(danzantesEncendidas(utc('2026-09-28T19:30:00Z'))).toBe(false); // 13:30
    expect(danzantesEncendidas(utc('2026-09-28T23:59:00Z'))).toBe(true); // 17:59
    expect(danzantesEncendidas(utc('2026-09-29T02:00:00Z'))).toBe(false); // 20:00
  });

  it('a cada hora en punto, un toque por hora del reloj, cada uno una sola vez', () => {
    const mediodia = utc('2026-09-28T18:00:00Z');
    expect(campanada(mediodia)).toMatchObject({ toque: 1, de: 12 });
    expect(campanada(mediodia + CAMPANADA_MS * 2 + 10)).toMatchObject({ toque: 3, de: 12 });
    expect(campanada(mediodia + CAMPANADA_MS * 12 + 10)).toBeNull();
    // La una: un solo toque.
    const una = utc('2026-09-28T19:00:00Z');
    expect(campanada(una + 10)).toMatchObject({ toque: 1, de: 1 });
    expect(campanada(una + CAMPANADA_MS + 10)).toBeNull();
    // Las claves no se repiten: ni entre toques ni entre horas.
    const claves = new Set(
      [mediodia, mediodia + CAMPANADA_MS, una].map((t) => campanada(t + 10)?.clave),
    );
    expect(claves.size).toBe(3);
    // A media hora, nada.
    expect(campanada(utc('2026-09-28T18:30:00Z'))).toBeNull();
  });

  it('sin reloj del servidor todavía, vale el del teléfono', () => {
    const antes = Date.now();
    expect(relojDelServidor(undefined)(123)).toBeGreaterThanOrEqual(antes);
    // Antes del primer snapshot, `serverNow` devuelve el reloj local (performance.now).
    expect(relojDelServidor((t) => t)(5_000)).toBeGreaterThanOrEqual(antes);
    expect(relojDelServidor((t) => t + 1.9e12)(5_000)).toBe(1.9e12 + 5_000);
  });

  it('el sol sale y se pone en Morelia a su hora, según la temporada', () => {
    const minutos = (h: number, m: number) => h * 60 + m;
    const junio = solDeMorelia(utc('2026-06-21T18:00:00Z'));
    expect(junio.salida).toBeGreaterThan(minutos(5, 55));
    expect(junio.salida).toBeLessThan(minutos(6, 15));
    expect(junio.puesta).toBeGreaterThan(minutos(19, 15));
    expect(junio.puesta).toBeLessThan(minutos(19, 35));
    const diciembre = solDeMorelia(utc('2026-12-21T18:00:00Z'));
    expect(diciembre.salida).toBeGreaterThan(minutos(7, 5));
    expect(diciembre.salida).toBeLessThan(minutos(7, 25));
    expect(diciembre.puesta).toBeGreaterThan(minutos(18, 5));
    expect(diciembre.puesta).toBeLessThan(minutos(18, 20));
  });

  it('de día no hay noche; oscurece con la puesta del sol y es noche cerrada a las diez', () => {
    expect(nocheDe(utc('2026-09-28T18:00:00Z'))).toBe(0); // mediodía
    expect(nocheDe(utc('2026-09-29T04:00:00Z'))).toBe(1); // 22:00
    expect(nocheDe(utc('2026-09-28T10:00:00Z'))).toBe(1); // 4:00
    // A media tarde del crepúsculo (18:50 con la puesta a las 18:34), a medias.
    const crepusculo = nocheDe(utc('2026-09-29T00:50:00Z'));
    expect(crepusculo).toBeGreaterThan(0.3);
    expect(crepusculo).toBeLessThan(0.7);
  });

  it('las Luces de Catedral: los sábados, a oscuras a las 20:58 y fuegos de 21:00 a 21:07', () => {
    // El sábado 3 de octubre de 2026, hora de Morelia.
    expect(lucesDeCatedral(utc('2026-10-04T02:57:00Z'))).toBeNull(); // 20:57
    expect(lucesDeCatedral(utc('2026-10-04T02:59:00Z'))).toEqual({ fase: 'oscura', avance: 0 });
    expect(lucesDeCatedral(utc('2026-10-04T03:03:30Z'))).toMatchObject({ fase: 'fuegos' });
    expect(lucesDeCatedral(utc('2026-10-04T03:03:30Z'))?.avance).toBeCloseTo(3.5 / 7, 3);
    expect(lucesDeCatedral(utc('2026-10-04T03:07:00Z'))).toBeNull(); // 21:07
    // El viernes a la misma hora, nada.
    expect(lucesDeCatedral(utc('2026-10-03T03:03:00Z'))).toBeNull();
  });

  it('el banco puede arrancar el reloj a cualquier hora de Morelia', () => {
    const reloj = relojDesde(11 * 60, 1_000);
    expect(horaDeMorelia(reloj(1_000))).toMatchObject({ h: 11, m: 0 });
    expect(horaDeMorelia(reloj(1_000 + 61_000))).toMatchObject({ h: 11, m: 1 });
    // Y en sábado, para ver las Luces de Catedral.
    const sabado = relojDesde(21 * 60 + 1, 0, 6);
    expect(lucesDeCatedral(sabado(0))).toMatchObject({ fase: 'fuegos' });
  });
});

describe('las palomas', () => {
  const grid = collisionGrid(PLAZA);

  it('cada parvada de la Plaza se posa en piso libre, casi completa', () => {
    const parvadas = PARVADAS.plaza ?? [];
    expect(parvadas.length).toBeGreaterThan(4);
    for (const p of parvadas) {
      const lugares = lugaresDeParvada(p, grid);
      expect(lugares.length, p.id).toBeGreaterThanOrEqual(Math.ceil(p.n / 2));
      for (const l of lugares) {
        expect(canStandAt(grid, l)).toBe(true);
        expect(Math.hypot(l.x - p.x, l.y - p.y)).toBeLessThanOrEqual(1.6);
      }
      // Siempre en el mismo lugar: la parvada no se reacomoda al recargar.
      expect(lugaresDeParvada(p, grid)).toEqual(lugares);
    }
  });

  it('se asustan con quien se acerca y salen volando lejos de ella, hacia arriba', () => {
    const palomas = [
      { x: 10, y: 10 },
      { x: 11, y: 10.5 },
    ];
    expect(quienAsusta(palomas, [{ x: 20, y: 20 }])).toBeNull();
    const susto = { x: 11 + RADIO_SUSTO - 0.1, y: 10.5 };
    expect(quienAsusta(palomas, [{ x: 20, y: 20 }, susto])).toEqual(susto);
    for (let i = 0; i < 10; i++) {
      const v = rumboDeHuida({ x: 10, y: 10 }, { x: 12, y: 10 }, i);
      expect(v.y).toBeLessThan(0);
      expect(v.x).toBeLessThan(0);
    }
  });
});

describe('los pregones', () => {
  it('cada vendedor de la Plaza tiene los suyos y se turnan', () => {
    const puestos = PLAZA.objects.filter((o) => o.kind === 'puesto');
    expect(puestos.length).toBeGreaterThanOrEqual(5);
    for (const puesto of puestos) expect(pregonDe(puesto.variant, 0), puesto.id).toBeTruthy();
    const elotes = PREGONES.elotes ?? [];
    expect(pregonDe('elotes', 0)).toBe(elotes[0]);
    expect(pregonDe('elotes', 1)).toBe(elotes[1]);
    expect(pregonDe('elotes', 2)).toBe(elotes[0]);
    expect(pregonDe('tacos', 0)).toBeNull();
    expect(pregonDe(undefined, 0)).toBeNull();
  });
});
