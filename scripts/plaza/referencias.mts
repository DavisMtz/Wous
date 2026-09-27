// Baja las referencias de la Plaza (docs/plaza/HANDOFF.md): las fotos del
// centro de Morelia desde Wikimedia Commons y el extracto de OpenStreetMap
// del que sale el trazo. Todo va a carpetas ignoradas por git: las fotos son
// CC BY-SA (se usan para dibujar, no se redistribuyen) y el OSM es ODbL.
//
// Uso (desde la raíz del repo, Node 24):
//   node scripts/plaza/referencias.mts            # fotos + OSM (lo que falte)
//   node scripts/plaza/referencias.mts --solo-osm
//
// Deja: docs/plaza/referencias/<archivo>.jpg (1280 px de ancho) y
// docs/plaza/osm/centro.osm. Quién hizo cada foto y con qué licencia está en
// docs/plaza/referencias.json; qué se ve en cada una, en investigacion.md §7.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

type Foto = { n: number; archivo: string; archivoCommons: string | null; autorLicencia: string };
type Catalogo = { osm: { url: string }; fotos: Foto[] };

const RAIZ = path.resolve(import.meta.dirname, '../..');
const DOCS = path.join(RAIZ, 'docs/plaza');
const catalogo = JSON.parse(readFileSync(path.join(DOCS, 'referencias.json'), 'utf8')) as Catalogo;
// Wikimedia pide un User-Agent que diga quién pregunta.
const UA = 'WousReferencias/1.0 (https://github.com/DavisMtz/Wous; referencias de dibujo)';
const soloOsm = process.argv.includes('--solo-osm');

async function bajar(url: string, destino: string): Promise<boolean> {
  for (let intento = 1; intento <= 4; intento++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if (res.ok) {
      writeFileSync(destino, Buffer.from(await res.arrayBuffer()));
      return true;
    }
    // 429: Commons pide calma. Se espera y se reintenta.
    const espera = res.status === 429 ? 4000 * intento : 1000 * intento;
    console.log(`  ${res.status} en ${url}; reintento en ${espera / 1000} s`);
    await new Promise((r) => setTimeout(r, espera));
  }
  return false;
}

const osmDir = path.join(DOCS, 'osm');
mkdirSync(osmDir, { recursive: true });
const osm = path.join(osmDir, 'centro.osm');
if (existsSync(osm)) console.log('✓ OSM ya estaba: docs/plaza/osm/centro.osm');
else if (await bajar(catalogo.osm.url, osm)) console.log('✓ OSM: docs/plaza/osm/centro.osm');
else console.error('✗ No se pudo bajar el extracto de OSM');

if (!soloOsm) {
  const dir = path.join(DOCS, 'referencias');
  mkdirSync(dir, { recursive: true });
  let nuevas = 0;
  for (const foto of catalogo.fotos) {
    const destino = path.join(dir, foto.archivo);
    if (existsSync(destino) || !foto.archivoCommons) continue;
    const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${foto.archivoCommons}?width=1280`;
    if (await bajar(url, destino)) {
      nuevas++;
      console.log(`✓ ${foto.n}. ${foto.archivo} (${foto.autorLicencia})`);
    } else {
      console.error(`✗ ${foto.n}. ${foto.archivo}`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  console.log(
    `\n${nuevas} fotos nuevas en docs/plaza/referencias/ (${catalogo.fotos.length} en el catálogo).`,
  );
}
