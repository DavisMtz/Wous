// Captura de una página del juego para revisar el arte (docs/plaza/HANDOFF.md).
//
//   node e2e/scripts/captura.mjs "<url>" <salida.png> [ancho alto] [x,y,ancho,alto]
//
// Con el banco de la Plaza (solo desarrollo, sin sesión ni servidor):
//   node e2e/scripts/captura.mjs "http://localhost:5173/dev-plaza.html?quieto&en=83.5,39&zoom=2" kiosko.png 1400 900
//   ?en=x,y  pone a la persona ahí (en tiles) · ?zoom=N fija el zoom (1 = el mapa entero)
//   ?spawn=desde-cafe · ?mapa=cafe · ?quieto (sin la persona de prueba caminando)
//
// Usa el Chrome de la máquina o, si existe, el Chromium de WOUS_CHROMIUM.
import { chromium } from '@playwright/test';

const [, , url, salida, ancho = '1280', alto = '800', recorte] = process.argv;
if (!url || !salida) {
  console.error(
    'Uso: node e2e/scripts/captura.mjs "<url>" <salida.png> [ancho alto] [x,y,ancho,alto]',
  );
  process.exit(1);
}
const ejecutable = process.env.WOUS_CHROMIUM;
const browser = await chromium.launch(
  ejecutable ? { executablePath: ejecutable } : { channel: 'chrome' },
);
const page = await browser.newPage({ viewport: { width: Number(ancho), height: Number(alto) } });
page.on('pageerror', (e) => console.log('error en la página:', e.message));
await page.goto(url, { waitUntil: 'networkidle' });
// El suelo y los objetos se pintan por código al cargar: se les da un momento.
await page.waitForTimeout(1500);
const opciones = { path: salida, fullPage: !recorte };
if (recorte) {
  const [x, y, w, h] = recorte.split(',').map(Number);
  opciones.clip = { x, y, width: w, height: h };
}
await page.screenshot(opciones);
await browser.close();
console.log('✓', salida);
