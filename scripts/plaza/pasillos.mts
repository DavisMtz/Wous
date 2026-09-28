// ¿Qué tan ancho es cada tramo de una ruta a pie? Para planear las rutas de
// E2E (docs/plaza/HANDOFF.md): el personaje de Playwright no se detiene exacto
// (soltar una tecla tarda casi un tile sin GPU), así que cada tramo recto debe
// recorrerse completo aunque empiece corrido de lado. Para cada tramo mide
// cuánto se puede correr a cada lado sin chocar, con el movimiento del servidor.
//
// Uso (desde la raíz del repo, Node 24):
//   node scripts/plaza/pasillos.mts [--mapa plaza] <eje>:<fija>:<desde>:<hasta> …
//
//   y:96:80.6:20.5    subir por x = 96 de y = 80.6 a y = 20.5
//   x:20.5:96:145.875 ir por y = 20.5 de x = 96 a x = 145.875
//
// Imprime la holgura de cada tramo (p. ej. «−2.30 … +4.00»: se puede empezar
// hasta 2.3 tiles antes o 4 después sobre el otro eje). Un tramo que ni por el
// centro se recorre sale «bloqueado» con el punto donde se atora.
import { stepMovement, type Vec } from '../../packages/game-core/src/index.ts';
import { buildCollisionGrid, MAPS } from '../../packages/world-data/src/index.ts';

const args = process.argv.slice(2);
const i = args.indexOf('--mapa');
const id = i >= 0 ? args.splice(i, 2)[1] : 'plaza';
const mapa = Object.values(MAPS).find((m) => m.id === id);
if (!mapa) throw new Error(`No hay mapa «${id}»`);
const grid = buildCollisionGrid(mapa);
/** Hasta dónde se mide a cada lado, en tiles. */
const TOPE = 4;
const PASO = 0.05;

/** Camina en línea recta hacia `meta`, a 4.2 tiles por segundo; se detiene si choca. */
function caminar(desde: Vec, meta: Vec): Vec {
  let q = desde;
  for (let n = 0; n < 5000; n++) {
    const dx = meta.x - q.x;
    const dy = meta.y - q.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.02) break;
    const siguiente = stepMovement(
      q,
      { x: dx / d, y: dy / d },
      Math.min(50, (d / 4.2) * 1000),
      grid,
    );
    if (Math.hypot(siguiente.x - q.x, siguiente.y - q.y) < 1e-6) break;
    q = siguiente;
  }
  return q;
}

for (const tramo of args) {
  const [eje, ...numeros] = tramo.split(':');
  const [fija, desde, hasta] = numeros.map(Number);
  if ((eje !== 'x' && eje !== 'y') || [fija, desde, hasta].some((n) => !Number.isFinite(n))) {
    throw new Error(`Tramo mal escrito: «${tramo}» (se espera eje:fija:desde:hasta)`);
  }
  const punto = (a: number, corrido: number): Vec =>
    eje === 'y' ? { x: (fija as number) + corrido, y: a } : { x: a, y: (fija as number) + corrido };
  const recorre = (corrido: number) => {
    const meta = punto(hasta as number, corrido);
    const fin = caminar(punto(desde as number, corrido), meta);
    return { ok: Math.hypot(fin.x - meta.x, fin.y - meta.y) < 0.05, fin };
  };
  const centro = recorre(0);
  if (!centro.ok) {
    console.log(`${tramo}: bloqueado en ${centro.fin.x.toFixed(2)},${centro.fin.y.toFixed(2)}`);
    continue;
  }
  let antes = 0;
  let despues = 0;
  while (antes > -TOPE && recorre(antes - PASO).ok) antes -= PASO;
  while (despues < TOPE && recorre(despues + PASO).ok) despues += PASO;
  const tope = (n: number) =>
    `${n < 0 ? '−' : '+'}${Math.abs(n) >= TOPE - PASO ? `${TOPE}+` : Math.abs(n).toFixed(2)}`;
  console.log(`${tramo}: holgura ${tope(antes)} … ${tope(despues)}`);
}
