// Pinta una pieza del arte del mundo sola y ampliada, para revisarla de cerca
// (docs/plaza/HANDOFF.md). Corre el código del juego dentro de la página de
// desarrollo (Vite sirve los módulos), así que Vite debe estar arriba.
//
//   node e2e/scripts/pieza.mjs <módulo> <función> '<args JSON>' <salida.png> [escala]
//
// Ejemplo (una banca curva del kiosko, ampliada 8 veces):
//   node e2e/scripts/pieza.mjs morelia bancaCurva '["curva:59.16:78.27:7.6:-1.0625:-6.0625",3.313,1.875]' banca.png 8
//
// `<módulo>` es un archivo de apps/web/src/game/world-art/ sin extensión. Usa el
// Chrome de la máquina o, si existe, el Chromium de WOUS_CHROMIUM.
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const [, , modulo, funcion, args = '[]', salida, escala = '6'] = process.argv;
if (!modulo || !funcion || !salida) {
  console.error(
    "Uso: node e2e/scripts/pieza.mjs <módulo> <función> '<args JSON>' <salida.png> [escala]",
  );
  process.exit(1);
}
const base = process.env.WOUS_BASE_URL ?? 'http://localhost:5173';
const ejecutable = process.env.WOUS_CHROMIUM;
const browser = await chromium.launch(
  ejecutable ? { executablePath: ejecutable } : { channel: 'chrome' },
);
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('error en la página:', e.message));
await page.goto(`${base}/dev-plaza.html?quieto`);
const png = await page.evaluate(
  async ({ modulo, funcion, args, escala }) => {
    const m = await import(`/src/game/world-art/${modulo}.ts`);
    const art = m[funcion](...args);
    const lienzo = art.canvas ?? art;
    // Sobre un gris de fondo, con cuadrícula de tiles, para ver lo transparente.
    const k = Number(escala);
    const salida = document.createElement('canvas');
    salida.width = lienzo.width * k;
    salida.height = lienzo.height * k;
    const ctx = salida.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#9aa39a';
    ctx.fillRect(0, 0, salida.width, salida.height);
    ctx.drawImage(lienzo, 0, 0, salida.width, salida.height);
    ctx.fillStyle = 'rgb(0 0 0 / 0.18)';
    for (let x = 0; x < lienzo.width; x += 16) ctx.fillRect(x * k, 0, 1, salida.height);
    for (let y = 0; y < lienzo.height; y += 16) ctx.fillRect(0, y * k, salida.width, 1);
    return salida.toDataURL('image/png');
  },
  { modulo, funcion, args: JSON.parse(args), escala },
);
writeFileSync(salida, Buffer.from(png.split(',')[1], 'base64'));
await browser.close();
console.log('✓', salida);
