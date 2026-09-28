import type { Painter } from './paint.ts';

/**
 * Relieve en 3/4: pinta una pieza descrita columna por columna (lo que no es
 * una caja: la banca curva del kiosko). Cada pixel del suelo dice qué alturas
 * ocupa; un voxel en (x, y, z) cae en el pixel (x, y − z) del lienzo, y se
 * dibuja de atrás hacia adelante y de abajo hacia arriba, así lo de enfrente
 * y lo de arriba tapa lo demás. La tapa de cada tramo sale con luz y las
 * caras en sombra; el sol viene de arriba a la izquierda, como en todo el
 * mundo, así que la orilla izquierda de una cara se aclara y la derecha se
 * oscurece.
 */

/** Alturas ocupadas por una columna: de `desde` (incluida) a `hasta` (excluida), en pixeles. */
export type Tramo = readonly [desde: number, hasta: number];

export type Cara = 'tapa' | 'frente' | 'izquierda' | 'derecha';

/**
 * `columna(x, y)` da los tramos del pixel de suelo (x, y) o null si ahí no
 * hay nada; `color` pinta cada voxel según su cara. El suelo va de 0 a
 * `ancho` × `alto`; en el lienzo, desplazado `alzado` pixeles hacia abajo
 * para que quepa lo alto.
 */
export function relieve(
  p: Painter,
  ancho: number,
  alto: number,
  alzado: number,
  columna: (x: number, y: number) => readonly Tramo[] | null,
  color: (x: number, y: number, z: number, cara: Cara) => string,
): void {
  const tramos: (readonly Tramo[] | null)[] = new Array(ancho * alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) tramos[y * ancho + x] = columna(x, y);
  }
  const ocupa = (x: number, y: number, z: number) => {
    if (x < 0 || y < 0 || x >= ancho || y >= alto) return false;
    return tramos[y * ancho + x]?.some(([a, b]) => z >= a && z < b) ?? false;
  };
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const col = tramos[y * ancho + x];
      if (!col) continue;
      for (const [a, b] of col) {
        for (let z = a; z < b; z++) {
          let cara: Cara = 'frente';
          if (z === b - 1) cara = 'tapa';
          else if (!ocupa(x - 1, y, z)) cara = 'izquierda';
          else if (!ocupa(x + 1, y, z)) cara = 'derecha';
          p.px(x, y + alzado - z, color(x, y, z, cara));
        }
      }
    }
  }
}
