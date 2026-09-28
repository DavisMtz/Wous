// Varias capturas seguidas de la misma vista, para revisar lo que se mueve
// (el agua, las palomas, las campanadas). Sin `?quieto` el juego anima; el
// intervalo va en milisegundos.
//
//   node e2e/scripts/cuadros.mjs "<url>" <prefijo> [n] [intervalo] [ancho alto]
//
// Ejemplo (las fuentes danzantes a las 11 de la mañana, 4 cuadros cada 150 ms):
//   node e2e/scripts/cuadros.mjs "http://localhost:5173/dev-plaza.html?en=20,83&zoom=4&hora=11:00" danza 4 150
//
// Usa el Chrome de la máquina o, si existe, el Chromium de WOUS_CHROMIUM.
import { chromium } from '@playwright/test';

const [, , url, prefijo, n = '4', intervalo = '200', ancho = '1280', alto = '800'] = process.argv;
if (!url || !prefijo) {
  console.error('Uso: node e2e/scripts/cuadros.mjs "<url>" <prefijo> [n] [intervalo] [ancho alto]');
  process.exit(1);
}
const ejecutable = process.env.WOUS_CHROMIUM;
const browser = await chromium.launch(
  ejecutable ? { executablePath: ejecutable } : { channel: 'chrome' },
);
const page = await browser.newPage({ viewport: { width: Number(ancho), height: Number(alto) } });
page.on('pageerror', (e) => console.log('error en la página:', e.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__wousJuego?.posicion() != null, null, { timeout: 20_000 });
await page.waitForTimeout(1200);
for (let i = 0; i < Number(n); i++) {
  await page.screenshot({ path: `${prefijo}-${i}.png` });
  await page.waitForTimeout(Number(intervalo));
}
await browser.close();
console.log('✓', `${prefijo}-0…${Number(n) - 1}.png`);
