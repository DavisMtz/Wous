// Revisa los mapas en segundos, sin correr toda la suite (docs/plaza/HANDOFF.md):
// integridad (validateWorld: todo se alcanza a pie desde la entrada, asientos
// con salida, formas sobre suelo pisable…), cuántas piezas hay y cuánto tarda
// en armarse la rejilla de colisión.
//
// Uso (desde la raíz del repo, Node 24):
//   node scripts/plaza/validar.mts
import { buildCollisionGrid, MAPS, validateWorld } from '../../packages/world-data/src/index.ts';

const problemas = validateWorld();
if (problemas.length) {
  console.error(`✗ ${problemas.length} problemas:`);
  for (const p of problemas) console.error(`  - ${p}`);
} else {
  console.log('✓ Los mapas son válidos');
}
for (const mapa of Object.values(MAPS)) {
  const t0 = performance.now();
  const rejilla = buildCollisionGrid(mapa);
  const ms = performance.now() - t0;
  console.log(
    `  ${mapa.id} v${mapa.version}: ${mapa.width}×${mapa.height} tiles (${mapa.width * 16}×${mapa.height * 16} px), ` +
      `${mapa.objects.length} objetos, ${mapa.seats.length} asientos, ${mapa.signs.length} placas, ` +
      `${mapa.portals.length} puertas; rejilla ${rejilla.width}×${rejilla.height} en ${ms.toFixed(1)} ms`,
  );
}
process.exit(problemas.length ? 1 : 0);
