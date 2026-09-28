import type { MapObject } from '@wous/world-data';
import { casa, cerrada, comercios, mesaDePortal, portal } from './allende.ts';
import { catedral } from './catedral.ts';
import { barra, maceta, mesa, tapete, vitroleros } from './interior.ts';
import {
  banca,
  estatua,
  farol,
  fresno,
  fuenteDeTaza,
  kiosko,
  laurel,
  liquidambar,
  placa,
  porton,
  portonLado,
  posteDeGlobos,
  reja,
} from './morelia.ts';
import { hash, type Painter, painter } from './paint.ts';
import {
  asta,
  chorros,
  churros,
  farolDeCampanas,
  fuenteDeColumna,
  globos,
  jardinera,
  losaLiberales,
  monumentoOcampo,
  pilastra,
} from './plazas.ts';
import {
  CORTEZA,
  hundido,
  JACARANDA,
  PAPEL_PICADO,
  SOMBRA,
  SOMBRA_SUAVE,
  TILE,
} from './world-palette.ts';

/**
 * Un objeto del mapa ya pintado. `ox`/`oy` llevan del canto superior
 * izquierdo de su huella (en pixeles del mundo) al del canvas: lo alto (copas,
 * techos, lonas, torres) sobresale hacia arriba. `depth` es la línea de sus
 * pies: lo que pisa más abajo se dibuja encima.
 */
export type ObjectArt = {
  canvas: HTMLCanvasElement;
  ox: number;
  oy: number;
  depth: number;
  /** Se transparenta si tapa a la persona que juega (copa, techo). */
  occluder: boolean;
};

export function paintObject(o: MapObject): ObjectArt | null {
  const depth = (o.y + o.h) * TILE;
  const at = (art: { canvas: HTMLCanvasElement; ox: number; oy: number }, occluder = false) => ({
    ...art,
    depth,
    occluder,
  });
  switch (o.kind) {
    case 'catedral':
      return at(catedral(o.w, o.h));
    case 'portal':
      return at(portal(o.w, o.h, o.variant));
    case 'comercios':
      return at(comercios(o.w, (o.variant ?? '').split(',')));
    case 'edificio':
      if (o.variant === 'cerrada') return at(cerrada(o.w, o.h));
      return at(casa(o.w, o.h, o.variant, Math.round(o.x)));
    case 'reja':
      if (o.variant === 'porton') return at(porton(o.w));
      if (o.variant === 'porton-lado') return at(portonLado(o.h));
      return at(reja(o.w, o.h, o.variant !== 'parada'));
    case 'kiosko':
      return at(kiosko(o.w, o.h), true);
    case 'fuente':
      if (o.variant === 'ocampo') return at(monumentoOcampo(o.w, o.h), true);
      if (o.variant === 'columna') return at(fuenteDeColumna(o.w / 2), true);
      return at(fuenteDeTaza(o.w / 2));
    case 'chorros':
      // A ras de piso: quien pasa por en medio va encima.
      return { ...chorros(o.w, o.h), depth: o.y * TILE, occluder: false };
    case 'estatua':
      return at(estatua(), true);
    case 'placa':
      if (o.variant === 'losa') {
        return { ...losaLiberales(o.w, o.h), depth: o.y * TILE, occluder: false };
      }
      return at(placa());
    case 'asta':
      return at(asta(), true);
    case 'pilastra':
      return at(pilastra(o.variant), true);
    case 'banca': {
      const art = banca(o.variant);
      // De canto, quien se sienta queda encima del asiento: la banca va al fondo.
      const deCanto = o.variant === 'izquierda' || o.variant === 'derecha';
      return { ...art, depth: deCanto ? o.y * TILE + 2 : depth, occluder: false };
    }
    case 'arbol':
      if (o.variant === 'laurel') return at(laurel(o.id), true);
      if (o.variant === 'liquidambar') return at(liquidambar(o.id), true);
      return at(fresno(o.id, true), true);
    case 'jacaranda':
      return at(jacaranda(o.id), true);
    case 'farol':
      if (o.variant === 'globos') return at(posteDeGlobos());
      return at(o.variant === 'campanas' ? farolDeCampanas() : farol());
    case 'puesto':
      return at(o.variant === 'globos' ? globos(o.id) : churros(o.id), o.variant === 'globos');
    case 'jardinera':
      return at(jardinera(o.variant, o.w, o.h, o.id), o.variant === 'naranjo');
    case 'mesa':
      return at(o.variant === 'portal' ? mesaDePortal(o.id, o.w, o.h) : mesa(o.variant));
    case 'barra':
      return at(barra(o.w, o.h));
    case 'vitroleros':
      return at(vitroleros(o.w));
    case 'maceta':
      return at(maceta(o.variant));
    case 'tapete':
      return { ...tapete(o.w, o.h), depth: o.y * TILE, occluder: false };
    case 'papel-picado':
    case 'focos':
      return null; // Los arma la escena: cuelgan de pared a pared, encima de todos.
  }
}

// ─── Jacaranda ────────────────────────────────────────────────────────────

const COPA: [number, number, number][] = [
  [42, 31, 25],
  [21, 42, 17],
  [62, 40, 18],
  [29, 20, 16],
  [55, 18, 17],
  [42, 49, 17],
  [12, 52, 9],
  [72, 52, 9],
];

/**
 * Jacaranda: tronco con ramas y una copa de racimos. En flor (de febrero a
 * abril) morada; el resto del año, de hojita fina verde brillante.
 */
function jacaranda(seedId: string, enFlor = true): Omit<ObjectArt, 'depth' | 'occluder'> {
  const W = 84;
  const H = 104;
  const p = painter(W, H);
  const seed = [...seedId].reduce((a, c) => a + c.charCodeAt(0), 0);
  const cx = 42;
  const pie = H - 3;
  const hoja = enFlor
    ? JACARANDA
    : {
        flower: '#5f9a3a',
        light: '#7fb84e',
        lighter: '#a2d06a',
        shade: '#487a2c',
        deep: '#305a22',
      };

  // Tronco con raíces, corteza y ramas.
  p.rect(cx - 6, pie - 5, 13, 5, CORTEZA.shade);
  p.rect(cx - 3, pie - 42, 7, 42, CORTEZA.base);
  p.rect(cx - 3, pie - 42, 1, 42, CORTEZA.light);
  p.rect(cx + 2, pie - 42, 2, 42, CORTEZA.shade);
  for (let y = pie - 38; y < pie - 6; y += 5) p.px(cx - 1 + (y % 2), y, CORTEZA.shade);
  branch(p, cx - 1, pie - 38, cx - 22, pie - 62);
  branch(p, cx + 1, pie - 40, cx + 20, pie - 66);
  branch(p, cx, pie - 40, cx - 1, pie - 72);

  // Copa: racimos. El tono depende de la «altura» del racimo en cada pixel.
  for (let y = 0; y < 72; y++) {
    for (let x = 0; x < W; x++) {
      let best = -1;
      let bx = 0;
      let by = 0;
      for (const [ccx, ccy, r] of COPA) {
        const d = 1 - Math.hypot(x - ccx, (y - ccy) * 1.1) / r;
        if (d > best) {
          best = d;
          bx = (x - ccx) / r;
          by = (y - ccy) / r;
        }
      }
      if (best <= 0) continue;
      // Huecos en la orilla por donde se asoma el suelo y las ramas.
      if (best < 0.14 && hash(x, y, seed) < 0.35) continue;
      const light = -bx * 0.6 - by * 0.8;
      const bloom = hash(Math.floor(x / 2), Math.floor(y / 2), seed + 1);
      let c = light > 0.35 ? hoja.light : light < -0.35 ? hoja.shade : hoja.flower;
      if (best < 0.12) c = light > 0 ? hoja.flower : hoja.deep;
      if (bloom > 0.9 && light > -0.2) c = hoja.lighter;
      else if (bloom < 0.08) c = hoja.deep;
      p.px(x, y, c);
    }
  }
  return { canvas: p.canvas, ox: -(cx - 8), oy: -(H - TILE) };
}

function branch(p: Painter, x0: number, y0: number, x1: number, y1: number): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    p.rect(x, y, 2, 2, i % 3 ? CORTEZA.base : CORTEZA.shade);
  }
}

// ─── Papel picado ─────────────────────────────────────────────────────────

/** Tres cuadros por banderita: quieta, meciéndose a la izquierda y a la derecha. */
export const FLAG_W = 7;
export const FLAG_H = 9;
const FLAG = [
  '#######',
  '#######',
  '#.###.#',
  '##.#.##',
  '###.###',
  '##.#.##',
  '#.###.#',
  '#######',
  '#.#.#.#',
];

export function papelPicadoFlag(color: string, lean: -1 | 0 | 1): HTMLCanvasElement {
  const p = painter(FLAG_W + 2, FLAG_H);
  FLAG.forEach((row, y) => {
    // La parte de abajo se va más lejos que la de arriba.
    const shift = y >= 5 ? lean : 0;
    for (let x = 0; x < FLAG_W; x++) {
      if (row[x] !== '#') continue;
      p.px(1 + x + shift, y, y === 0 ? hundido(color, 0.3) : color);
    }
  });
  return p.canvas;
}

/** Colores de una tira de papel picado, en orden de fiesta. */
export function flagColor(i: number): string {
  return PAPEL_PICADO[i % PAPEL_PICADO.length] ?? PAPEL_PICADO[0];
}

// ─── Sombras horneadas en el suelo ────────────────────────────────────────

export function objectShadow(p: Painter, o: MapObject): void {
  const x = o.x * TILE;
  const y = o.y * TILE;
  const w = o.w * TILE;
  const h = o.h * TILE;
  switch (o.kind) {
    case 'catedral':
      // Las torres y la portada dan su sombra sobre el atrio.
      for (let i = 0; i < 10; i++) {
        p.rect(x - 4, y + h + i, w + 8, 1, `rgb(43 18 56 / ${(0.26 - i * 0.024).toFixed(3)})`);
      }
      break;
    case 'portal':
    case 'edificio':
      for (let i = 0; i < 5; i++) {
        p.rect(x, y + h + i, w, 1, `rgb(43 18 56 / ${(0.22 - i * 0.04).toFixed(3)})`);
      }
      break;
    case 'kiosko':
      // El techo da su sombra detrás y a la derecha, sobre la jardinera.
      p.ellipse(x + w / 2 + 10, y + h / 2 - 2, w / 2 + 4, h / 2 + 2, SOMBRA_SUAVE);
      break;
    case 'fuente':
      if (o.variant === 'ocampo') {
        p.rect(x + 2, y + h, w, 3, SOMBRA);
      } else {
        p.ellipse(x + w / 2 + 2, y + h / 2 + 3, w / 2 + 1, h / 2, SOMBRA_SUAVE);
      }
      break;
    case 'jardinera':
      p.rect(x + 2, y + h, w - 1, 3, SOMBRA_SUAVE);
      if (o.variant === 'naranjo') p.ellipse(x + w / 2 + 6, y + h - 6, 14, 6, SOMBRA_SUAVE);
      break;
    case 'pilastra':
      p.ellipse(x + 10, y + 13, 6, 2, SOMBRA);
      p.rect(x + 11, y + 10, 10, 3, SOMBRA_SUAVE);
      break;
    case 'asta':
      p.ellipse(x + 9, y + 14, 6, 2, SOMBRA);
      // La sombra larga del mástil sobre la explanada.
      p.rect(x + 12, y + 12, 40, 1, SOMBRA_SUAVE);
      break;
    case 'estatua':
      p.ellipse(x + w / 2 + 3, y + h - 2, w / 2 + 2, 4, SOMBRA);
      break;
    case 'banca':
      if (o.variant === 'izquierda' || o.variant === 'derecha') {
        p.rect(x + 3, y + 2, w - 4, h, SOMBRA_SUAVE);
      } else {
        p.rect(x + 2, y + h - 2, w - 2, 3, SOMBRA_SUAVE);
      }
      break;
    case 'arbol':
    case 'jacaranda': {
      // Sombra moteada de la copa: elipse con huecos de luz (el sol, alto y un poco al sur).
      const cx = x + 10;
      const cy = y + 10;
      const rx = o.variant === 'laurel' ? 28 : o.variant === 'liquidambar' ? 22 : 38;
      const ry = o.variant === 'laurel' ? 10 : o.variant === 'liquidambar' ? 9 : 13;
      for (let yy = -ry; yy <= ry; yy++) {
        for (let xx = -rx; xx <= rx; xx++) {
          if ((xx * xx) / (rx * rx) + (yy * yy) / (ry * ry) > 1) continue;
          if (hash(cx + xx, cy + yy, 5) < 0.2) continue;
          p.px(cx + xx, cy + yy, SOMBRA_SUAVE);
        }
      }
      p.ellipse(x + 8, y + 14, 5, 2, SOMBRA);
      break;
    }
    case 'farol':
      p.ellipse(x + 9, y + 15, 6, 2, SOMBRA);
      break;
    case 'puesto':
      if (o.variant === 'globos') p.ellipse(x + 10, y + 13, 12, 3, SOMBRA_SUAVE);
      else p.rect(x + 2, y + h - 2, w - 2, 3, SOMBRA_SUAVE);
      break;
    case 'reja':
      if (o.variant === 'parada' || o.variant === 'porton-lado') {
        p.rect(x + 8, y, 3, h, SOMBRA_SUAVE);
      } else {
        p.rect(x, y + h, w, 3, SOMBRA_SUAVE);
      }
      break;
    case 'placa':
      p.ellipse(x + 9, y + 15, 6, 2, SOMBRA);
      break;
    case 'mesa':
      p.ellipse(x + w / 2, y + h - 1, w / 2 - 4, 3, SOMBRA_SUAVE);
      break;
    case 'barra':
    case 'vitroleros':
      p.rect(x + 1, y + h, w - 1, 3, SOMBRA);
      p.rect(x + 1, y + h + 3, w - 1, 2, SOMBRA_SUAVE);
      break;
    case 'maceta':
      p.ellipse(x + 8, y + 14, 7, 2, SOMBRA);
      break;
    default:
      break;
  }
}
