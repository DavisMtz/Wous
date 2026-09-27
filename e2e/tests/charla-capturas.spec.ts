import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { cuentaPorApi } from './ayudantes.ts';

/**
 * Capturas de revisión de la plática (Fase 7). Solo corre con WOUS_CAPTURAS=1
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

async function decir(page: Page, texto: string) {
  await page.keyboard.press('Enter');
  await page.getByLabel('Mensaje para la sala').fill(texto);
  await page.keyboard.press('Enter');
}

test('la plática en la plaza', async ({ browser }, info) => {
  test.skip(info.project.name !== 'escritorio', 'los tamaños se fijan a mano');
  test.setTimeout(240_000);
  mkdirSync(OUT, { recursive: true });

  const ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const ctxB = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await cuentaPorApi(a, info, 'Ana Plática');
  await cuentaPorApi(b, info, 'Beto Plática');
  await entrar(a);
  await entrar(b);
  await a.waitForFunction(() => (window.__wousJuego?.remotos().length ?? 0) >= 1);

  await decir(b, '¿Alguien va al café? Dicen que hay pan de muerto');
  await decir(a, 'yo voy, espérame tantito');
  await a.bringToFront();
  await a.keyboard.press('Digit3');
  await a.waitForTimeout(500);
  await a.screenshot({ path: path.join(OUT, 'desktop.png') });

  // Abierta: la hoja con el registro.
  await a.keyboard.press('Enter');
  await a.getByLabel('Mensaje para la sala').fill('ahorita llego');
  await a.waitForTimeout(300);
  await a.screenshot({ path: path.join(OUT, 'desktop-chat-abierto.png') });
  await a.keyboard.press('Escape');

  // La ficha desde el nombre en el chat, y el reporte.
  await a.keyboard.press('Enter');
  await a.getByRole('button', { name: 'Beto Plática' }).first().click();
  await expect(a.getByRole('dialog')).toBeVisible();
  await a.waitForTimeout(400);
  await a.screenshot({ path: path.join(OUT, 'desktop-ficha.png') });
  await a.getByRole('button', { name: 'Reportar' }).click();
  await a.getByText('Spam o mensajes repetidos').click();
  await a.waitForTimeout(300);
  await a.screenshot({ path: path.join(OUT, 'desktop-reporte.png') });
  await a.getByRole('button', { name: 'Enviar reporte' }).click();
  await expect(a.getByText('¡Enviado!')).toBeVisible();
  await a.waitForTimeout(600);
  await a.screenshot({ path: path.join(OUT, 'desktop-reporte-enviado.png') });
  await a.getByRole('button', { name: 'Bloquear también' }).click();
  await a.getByRole('button', { name: 'Bloquear', exact: true }).click();
  await expect(a.getByText('¡Hecho!')).toBeVisible();
  await a.getByRole('button', { name: 'Listo' }).click();
  await a.waitForTimeout(500);
  await a.screenshot({ path: path.join(OUT, 'desktop-bloqueo.png') });

  // La casa: la lista de bloqueados.
  await a.getByRole('button', { name: 'Salir' }).click();
  await expect(a.getByRole('heading', { name: 'Personas que bloqueaste' })).toBeVisible();
  await a.waitForTimeout(600);
  await a.screenshot({ path: path.join(OUT, 'desktop-casa.png'), fullPage: true });
  await ctxB.close();

  // Teléfono apaisado (táctil emulado): Caro, con la tira y el abanico de gestos.
  const movil = await browser.newContext({
    viewport: { width: 915, height: 412 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  const m = await movil.newPage();
  await cuentaPorApi(m, info, 'Caro Teléfono');
  await entrar(m);
  await m.getByRole('button', { name: 'Hablar' }).tap();
  await m.getByLabel('Mensaje para la sala').fill('hola desde el teléfono');
  await m.getByRole('button', { name: 'Decir' }).tap();
  await m.waitForTimeout(400);
  await m.getByRole('button', { name: 'Gestos' }).tap();
  await m.waitForTimeout(400);
  await m.screenshot({ path: path.join(OUT, 'mobile.png') });
  await m.getByRole('button', { name: 'Gestos' }).tap();
  await m.getByRole('button', { name: 'Hablar' }).tap();
  await m.waitForTimeout(400);
  await m.screenshot({ path: path.join(OUT, 'mobile-chat-abierto.png') });
  await m.getByRole('button', { name: 'Cerrar' }).tap();

  // Ana vuelve a la plaza y dice algo; Caro toca su nombre en la tira: la ficha.
  await entrar(a);
  await decir(a, 'hola, Caro');
  await m.getByRole('button', { name: 'Ana Plática' }).first().tap();
  await expect(m.getByRole('dialog')).toBeVisible();
  await m.waitForTimeout(400);
  await m.screenshot({ path: path.join(OUT, 'mobile-ficha.png') });
  await movil.close();
  await ctxA.close();
});
