// Del OpenStreetMap del centro de Morelia a tiles de la Plaza, a la escala que
// se pida (docs/plaza/HANDOFF.md, «Agrandar el mapa»). Sirve para rehacer el
// trazo a otra escala sin adivinar: dónde cae cada fuente, estatua, árbol,
// paso peatonal y comercio real.
//
// Uso (desde la raíz del repo, Node 24; antes: node scripts/plaza/referencias.mts --solo-osm):
//   node scripts/plaza/osm.mts [--escala 2.8] [--svg plano.svg] [--json elementos.json]
//                              [--px 8] [--con-mapa]
//
//   --escala    metros por tile (2.8 = la Plaza v2 de hoy; 1.4 = el doble de grande)
//   --svg       plano en espacio de tiles (girado 180°, como el juego), con rejilla
//   --json      todos los elementos en tiles (árboles, cruces, comercios, edificios…)
//   --px        pixeles por tile en el SVG (8 por omisión)
//   --con-mapa  encima, los objetos de la Plaza actual llevados a la escala pedida
//
// La transformación: la vista mira al sur desde Madero (ADR-0013), así que el
// oriente queda a la izquierda y el norte abajo. x = (X0 − este) / escala,
// y = (Y0 − sur) / escala, con el origen en la esquina de la Plaza v2 (las
// azoteas al oriente de Morelos, las fachadas de Allende). Con 2.8 m por tile
// reproduce la Plaza v2 con ±2 tiles de error: aquella se acomodó a mano.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PLAZA } from '../../packages/world-data/src/index.ts';

const RAIZ = path.resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const opcion = (nombre: string) => {
  const i = args.indexOf(nombre);
  return i >= 0 ? args[i + 1] : undefined;
};
const ESCALA = Number(opcion('--escala') ?? 2.8);
const PX = Number(opcion('--px') ?? 8);
if (!(ESCALA > 0.3 && ESCALA < 10)) {
  console.error('✗ --escala va en metros por tile (entre 0.3 y 10).');
  process.exit(1);
}
/** Cuántas veces más grande que la Plaza v2 (2.8 m por tile). */
const K = 2.8 / ESCALA;

// ─── Proyección ──────────────────────────────────────────────────────────

/** Proyección métrica local alrededor de la Catedral (este y sur en metros). */
const LAT0 = 19.70225;
const LON0 = -101.19231;
const este = (lon: number) => (lon - LON0) * 111320 * Math.cos((LAT0 * Math.PI) / 180);
const sur = (lat: number) => -(lat - LAT0) * 110540;
/** Esquina de la Plaza v2 (tile 0,0) en metros: ajustada a los monumentos. */
const X0 = 93.9;
const Y0 = 68.2;
const ANCHO_M = 104 * 2.8;
const ALTO_M = 49 * 2.8;
const tileX = (e: number) => (X0 - e) / ESCALA;
const tileY = (s: number) => (Y0 - s) / ESCALA;
const W = Math.round(ANCHO_M / ESCALA);
const H = Math.round(ALTO_M / ESCALA);

// ─── Lectura del OSM (XML simple de la API 0.6) ─────────────────────────

const archivo = path.join(RAIZ, 'docs/plaza/osm/centro.osm');
let xml: string;
try {
  xml = readFileSync(archivo, 'utf8');
} catch {
  console.error('✗ Falta docs/plaza/osm/centro.osm: node scripts/plaza/referencias.mts --solo-osm');
  process.exit(1);
}
type Tags = Record<string, string>;
const leerTags = (bloque: string): Tags => {
  const t: Tags = {};
  for (const m of bloque.matchAll(/<tag k="([^"]*)" v="([^"]*)"\s*\/>/g)) {
    t[m[1] as string] = decodificar(m[2] as string);
  }
  return t;
};
const decodificar = (s: string) =>
  s
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&#10;', ' ')
    .replaceAll('&amp;', '&');

type Punto = { x: number; y: number };
const nodos = new Map<string, Punto & { tags: Tags }>();
for (const m of xml.matchAll(
  /<node id="(\d+)"[^>]*?lat="([-\d.]+)" lon="([-\d.]+)"[^>]*?(\/>|>([\s\S]*?)<\/node>)/g,
)) {
  const tags = m[5] ? leerTags(m[5]) : {};
  nodos.set(m[1] as string, {
    x: tileX(este(Number(m[3]))),
    y: tileY(sur(Number(m[2]))),
    tags,
  });
}
const vias: { id: string; puntos: Punto[]; tags: Tags }[] = [];
for (const m of xml.matchAll(/<way id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g)) {
  const cuerpo = m[2] as string;
  const puntos = [...cuerpo.matchAll(/<nd ref="(\d+)"\s*\/>/g)]
    .map((r) => nodos.get(r[1] as string))
    .filter((p): p is Punto & { tags: Tags } => p !== undefined)
    .map(({ x, y }) => ({ x, y }));
  vias.push({ id: m[1] as string, puntos, tags: leerTags(cuerpo) });
}

// ─── Clasificación ───────────────────────────────────────────────────────

const r1 = (n: number) => Math.round(n * 10) / 10;
const dentro = (p: Punto) => p.x >= -2 && p.y >= -2 && p.x <= W + 2 && p.y <= H + 2;
const centro = (ps: Punto[]): Punto => ({
  x: ps.reduce((a, p) => a + p.x, 0) / ps.length,
  y: ps.reduce((a, p) => a + p.y, 0) / ps.length,
});
const caja = (ps: Punto[]) => {
  const xs = ps.map((p) => p.x);
  const ys = ps.map((p) => p.y);
  return {
    x: r1(Math.min(...xs)),
    y: r1(Math.min(...ys)),
    w: r1(Math.max(...xs) - Math.min(...xs)),
    h: r1(Math.max(...ys) - Math.min(...ys)),
  };
};

const arboles = [...nodos.values()].filter((n) => n.tags.natural === 'tree' && dentro(n));
const cruces = [...nodos.values()].filter(
  (n) => n.tags.highway?.startsWith('crossing') && dentro(n),
);
const negocios = [...nodos.values()].filter(
  (n) =>
    n.tags.name &&
    (n.tags.amenity || n.tags.tourism || n.tags.shop || n.tags.historic) &&
    dentro(n),
);
const fuentes = [
  ...[...nodos.values()]
    .filter((n) => n.tags.amenity === 'fountain')
    .map((n) => ({ x: n.x, y: n.y, de: 'nodo' })),
  ...vias
    .filter((v) => v.tags.amenity === 'fountain' && v.puntos.length)
    .map((v) => ({ ...centro(v.puntos), de: 'área' })),
].filter(dentro);
const edificios = vias.filter((v) => v.tags.building && v.puntos.some(dentro));
const areas = vias.filter(
  (v) =>
    (v.tags.leisure === 'park' || v.tags.area === 'yes' || v.tags.place === 'square') &&
    v.puntos.some(dentro),
);
const calles = vias.filter((v) => v.tags.highway && !v.tags.area && v.puntos.some(dentro));
const rejas = vias.filter((v) => v.tags.barrier && v.puntos.some(dentro));

// ─── Resumen en consola ──────────────────────────────────────────────────

console.log(
  `Escala ${ESCALA} m por tile (${K.toFixed(2)}× la Plaza v2): mapa de ${W} × ${H} tiles`,
);
const trozos =
  W * 16 > 2048 || H * 16 > 2048 ? ': más de 2048 px de lado, hay que partirlo en trozos' : '';
console.log(`Suelo: ${W * 16} × ${H * 16} px${trozos}\n`);
const hitos = [
  ...vias
    .filter((v) => v.tags.name && (v.tags.building || v.tags.leisure || v.tags.area === 'yes'))
    .map((v) => ({ que: v.tags.name as string, ...caja(v.puntos) })),
  ...vias
    .filter((v) => v.tags.leisure === 'bandstand')
    .map((v) => ({ que: 'Kiosko (bandstand)', ...caja(v.puntos) })),
  ...[...nodos.values()]
    .filter((n) => n.tags.tourism === 'artwork' || n.tags.historic)
    .map((n) => ({
      que: n.tags.name ?? n.tags.historic ?? 'monumento',
      x: r1(n.x),
      y: r1(n.y),
      w: 0,
      h: 0,
    })),
].filter((h) => dentro(h));
console.log('Hitos (x, y de la esquina; w × h en tiles):');
for (const h of hitos)
  console.log(
    `  ${h.que.padEnd(34)} ${String(h.x).padStart(6)} ${String(h.y).padStart(6)}   ${h.w} × ${h.h}`,
  );
console.log('\nFuentes:', fuentes.map((f) => `(${r1(f.x)}, ${r1(f.y)})`).join(' '));
console.log(
  `Árboles: ${arboles.length} · pasos peatonales: ${cruces.length} · comercios con nombre: ${negocios.length}`,
);

// ─── JSON ────────────────────────────────────────────────────────────────

const salidaJson = opcion('--json');
if (salidaJson) {
  const p = (n: Punto) => ({ x: r1(n.x), y: r1(n.y) });
  writeFileSync(
    salidaJson,
    JSON.stringify(
      {
        escala: ESCALA,
        factor: K,
        tiles: { w: W, h: H },
        nota: 'Coordenadas en tiles de la Plaza (vista al sur desde Madero). © OpenStreetMap contributors, ODbL.',
        hitos,
        fuentes: fuentes.map(p),
        arboles: arboles.map((n) => ({ ...p(n), especie: n.tags.species ?? n.tags.genus ?? null })),
        cruces: cruces.map(p),
        comercios: negocios.map((n) => ({
          ...p(n),
          nombre: n.tags.name,
          tipo: n.tags.amenity ?? n.tags.tourism ?? n.tags.shop ?? n.tags.historic,
        })),
        edificios: edificios.map((v) => ({
          id: v.id,
          nombre: v.tags.name ?? null,
          caja: caja(v.puntos),
        })),
      },
      null,
      2,
    ),
  );
  console.log(`\n✓ ${salidaJson}`);
}

// ─── SVG ─────────────────────────────────────────────────────────────────

const salidaSvg = opcion('--svg');
if (salidaSvg) {
  const s = (n: number) => (n * PX).toFixed(1);
  const pts = (ps: Punto[]) => ps.map((q) => `${s(q.x)},${s(q.y)}`).join(' ');
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W * PX}" height="${H * PX}" font-family="sans-serif" font-size="${Math.max(8, PX)}">`,
    `<rect width="100%" height="100%" fill="#f4f1ea"/>`,
  ];
  for (let x = 0; x <= W; x++) {
    const fuerte = x % 10 === 0 ? 0.9 : x % 5 === 0 ? 0.5 : 0.15;
    out.push(
      `<line x1="${s(x)}" y1="0" x2="${s(x)}" y2="${s(H)}" stroke="#888" stroke-opacity="${fuerte}" stroke-width="0.5"/>`,
    );
    if (x % 10 === 0) out.push(`<text x="${s(x) + 2}" y="10" fill="#555">${x}</text>`);
  }
  for (let y = 0; y <= H; y++) {
    const fuerte = y % 10 === 0 ? 0.9 : y % 5 === 0 ? 0.5 : 0.15;
    out.push(
      `<line x1="0" y1="${s(y)}" x2="${s(W)}" y2="${s(y)}" stroke="#888" stroke-opacity="${fuerte}" stroke-width="0.5"/>`,
    );
    if (y % 10 === 0) out.push(`<text x="2" y="${s(y) - 2}" fill="#555">${y}</text>`);
  }
  for (const v of areas)
    out.push(
      `<polygon points="${pts(v.puntos)}" fill="#e6efd8" stroke="#9bbf7a" fill-opacity="0.7"/>`,
    );
  for (const v of edificios) {
    const culto = v.tags.amenity === 'place_of_worship';
    out.push(
      `<polygon points="${pts(v.puntos)}" fill="${culto ? '#e9a38d' : '#d6c8bd'}" stroke="#8a6f63" fill-opacity="0.85"/>`,
    );
  }
  for (const v of calles)
    out.push(
      `<polyline points="${pts(v.puntos)}" fill="none" stroke="#777" stroke-opacity="0.5" stroke-width="${PX * 0.6}"/>`,
    );
  for (const v of rejas)
    out.push(
      `<polyline points="${pts(v.puntos)}" fill="none" stroke="#222" stroke-dasharray="4,2" stroke-width="1.5"/>`,
    );
  for (const f of fuentes)
    out.push(`<circle cx="${s(f.x)}" cy="${s(f.y)}" r="${PX * 1.2}" fill="#3aa0e0"/>`);
  for (const a of arboles)
    out.push(
      `<circle cx="${s(a.x)}" cy="${s(a.y)}" r="${PX * 0.9}" fill="#2f8a3a" fill-opacity="0.7"/>`,
    );
  for (const c of cruces)
    out.push(
      `<rect x="${s(c.x - 0.5)}" y="${s(c.y - 0.5)}" width="${PX}" height="${PX}" fill="#fff" stroke="#333"/>`,
    );
  for (const n of negocios) {
    out.push(`<circle cx="${s(n.x)}" cy="${s(n.y)}" r="2.5" fill="#b0306a"/>`);
    out.push(
      `<text x="${s(n.x) + 4}" y="${s(n.y) + 3}" fill="#b0306a" font-size="${Math.max(7, PX * 0.8)}">${escapar(n.tags.name ?? '')}</text>`,
    );
  }
  if (args.includes('--con-mapa')) {
    // La Plaza v2 llevada a esta escala: dónde quedaría hoy cada objeto.
    for (const o of PLAZA.objects) {
      out.push(
        `<rect x="${s(o.x * K)}" y="${s(o.y * K)}" width="${s(o.w * K)}" height="${s(o.h * K)}" fill="none" stroke="#d0342c" stroke-width="1"><title>${o.id}</title></rect>`,
      );
    }
  }
  out.push(
    `<text x="${s(1)}" y="${s(H) - 4}" fill="#333">© OpenStreetMap contributors (ODbL) · ${ESCALA} m por tile · ${W}×${H} tiles</text>`,
  );
  out.push('</svg>');
  writeFileSync(salidaSvg, out.join('\n'));
  console.log(`✓ ${salidaSvg}`);
}

function escapar(texto: string): string {
  return texto.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
