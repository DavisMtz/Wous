import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { cuentaPorApi } from './ayudantes.ts';

/**
 * Capturas de revisión de tu banda (Fase 8). Solo corre con WOUS_CAPTURAS=1
 * (no es una prueba): deja PNG en apps/web/.impeccable/review.
 */
test.skip(!process.env.WOUS_CAPTURAS, 'solo para capturas de revisión');

const OUT = path.join(import.meta.dirname, '../../apps/web/.impeccable/review');

async function entrar(page: Page) {
  await page.goto('/plaza?quieto');
  await page.waitForFunction(() => window.__wousJuego?.conexion() === 'ONLINE', null, {
    timeout: 30_000,
  });
  await page.waitForTimeout(900);
}

async function fichaDe(page: Page, nombre: string) {
  await page.getByRole('button', { name: /personas aquí/ }).click();
  await page.getByRole('button', { name: nombre }).click();
  const ficha = page.getByRole('dialog', { name: nombre });
  await expect(ficha).toBeVisible();
  await page.waitForTimeout(400);
  return ficha;
}

test('tu banda: la ficha, la marca, la casa y la foto', async ({ browser }, info) => {
  test.skip(info.project.name !== 'escritorio', 'los tamaños se fijan a mano');
  test.setTimeout(300_000);
  mkdirSync(OUT, { recursive: true });

  const ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const ctxB = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await cuentaPorApi(a, info, 'Ana Banda');
  await cuentaPorApi(b, info, 'Beto Banda');
  await entrar(a);
  await entrar(b);
  await a.waitForFunction(() => (window.__wousJuego?.remotos().length ?? 0) >= 1);

  // La ficha de alguien que todavía no es de tu banda, y después de pedir.
  await a.bringToFront();
  const ficha = await fichaDe(a, 'Beto Banda');
  await a.screenshot({ path: path.join(OUT, 'desktop-ficha-agregar.png') });
  await ficha.getByRole('button', { name: 'Agregar amigo' }).click();
  await expect(ficha.getByText('¡Enviada!')).toBeVisible();
  await a.waitForTimeout(600);
  await a.screenshot({ path: path.join(OUT, 'desktop-ficha-enviada.png') });
  await a.keyboard.press('Escape');

  // Quien la recibe: en la casa, la calcomanía; en la plaza, «Aceptar solicitud».
  await b.bringToFront();
  await b.goto('/?quieto');
  await expect(b.locator('.casa__nuevas')).toBeVisible();
  await b.waitForTimeout(500);
  await b.screenshot({ path: path.join(OUT, 'desktop-casa-banda.png') });
  await entrar(b);
  const suya = await fichaDe(b, 'Ana Banda');
  await b.screenshot({ path: path.join(OUT, 'desktop-ficha-aceptar.png') });
  await suya.getByRole('button', { name: 'Aceptar solicitud' }).click();
  await expect(suya.getByText('¡Ya son amigos!')).toBeVisible();
  await b.waitForTimeout(600);
  await b.screenshot({ path: path.join(OUT, 'desktop-ficha-amigos.png') });
  await b.keyboard.press('Escape');

  // La marca en la etiqueta de un amigo (Ana vuelve a entrar para leer su lista).
  await a.bringToFront();
  await a.reload();
  await a.waitForFunction(() => window.__wousJuego?.conexion() === 'ONLINE', null, {
    timeout: 30_000,
  });
  await a.waitForFunction(() => (window.__wousJuego?.amigos().length ?? 0) >= 1);
  await a.waitForTimeout(900);
  await a.screenshot({ path: path.join(OUT, 'desktop-marca-amigo.png') });

  // Al volver a abrir su ficha: el estado fijo «Es de tu banda».
  const amiga = await fichaDe(a, 'Beto Banda');
  await expect(amiga.getByText('Es de tu banda')).toBeVisible();
  await a.screenshot({ path: path.join(OUT, 'desktop-ficha-es-banda.png') });
  await a.keyboard.press('Escape');

  // Tu banda de verdad, con la ficha abierta, en escritorio y en teléfono.
  await a.goto('/friends?quieto');
  await a.getByRole('button', { name: 'Beto Banda' }).click();
  await a.waitForTimeout(600);
  await a.screenshot({ path: path.join(OUT, 'desktop-banda.png'), fullPage: true });
  // La confirmación de quitar (sin confirmar).
  await a
    .getByRole('dialog', { name: 'Beto Banda' })
    .getByRole('button', { name: 'Quitar' })
    .click();
  await expect(a.getByText('¿Quitar a Beto Banda de tu banda?')).toBeVisible();
  await a.waitForTimeout(400);
  await a.screenshot({ path: path.join(OUT, 'desktop-banda-quitar.png'), fullPage: true });

  const ctxM = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    storageState: await ctxA.storageState(),
  });
  const m = await ctxM.newPage();
  await m.goto('/friends?quieto');
  await expect(m.getByRole('heading', { name: 'Tu banda' })).toBeVisible();
  await m.getByRole('button', { name: 'Beto Banda' }).click();
  await m.waitForTimeout(800);
  await m.screenshot({ path: path.join(OUT, 'mobile-banda.png'), fullPage: true });

  await ctxM.close();
  await ctxA.close();
  await ctxB.close();
});
