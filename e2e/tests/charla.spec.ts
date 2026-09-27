import { expect, type Page, test } from '@playwright/test';
import { cuentaPorApi } from './ayudantes.ts';

/**
 * Fase 7 (DoD): el HTML de una persona no se ejecuta en el navegador de
 * nadie, el flood se limita, los bloqueos se respetan (también al volver a
 * entrar) y un reporte llega a la sala. Dos navegadores de verdad.
 */

async function entrar(page: Page) {
  await page.goto('/plaza');
  await page.waitForFunction(() => window.__wousJuego?.conexion() === 'ONLINE', null, {
    timeout: 30_000,
  });
}

async function decir(page: Page, texto: string) {
  await page.bringToFront();
  await page.keyboard.press('Enter');
  const campo = page.getByLabel('Mensaje para la sala');
  await expect(campo).toBeFocused();
  await campo.fill(texto);
  await page.keyboard.press('Enter');
}

/** ¿Está esa línea en el registro del chat de esta página? */
const enElChat = (page: Page, texto: string) =>
  page.locator('.renglon__texto').filter({ hasText: texto });

const yo = (page: Page) => page.evaluate(() => window.__wousJuego?.yo() ?? null);

test('el HTML de alguien se lee tal cual, el chat y los gestos llegan y el flood se frena', async ({
  browser,
}, info) => {
  test.skip(info.project.name !== 'escritorio', 'dos contextos de escritorio bastan');
  test.setTimeout(240_000);
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  const dialogos: string[] = [];
  for (const page of [a, b]) {
    page.on('dialog', (d) => {
      dialogos.push(d.message());
      void d.dismiss();
    });
  }
  await cuentaPorApi(a, info, 'Ana Charla');
  await cuentaPorApi(b, info, 'Beto Charla');
  await entrar(a);
  await entrar(b);
  const idA = await yo(a);
  await b.waitForFunction((id) => window.__wousJuego?.remotos().some((r) => r.id === id), idA);

  const payload = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script>';
  await decir(a, payload);
  await expect(enElChat(b, '<img src=x').first()).toHaveText(payload);
  await expect(enElChat(a, '<img src=x').first()).toHaveText(payload);
  for (const page of [a, b]) {
    expect(await page.evaluate(() => (window as { __pwned?: number }).__pwned)).toBeUndefined();
    expect(await page.locator('img[src="x"]').count()).toBe(0);
  }
  // El globo cuelga sobre Ana en las dos pantallas.
  await a.waitForFunction(
    (id) => window.__wousJuego?.colgado().some((c) => c.id === id && c.globo),
    idA,
  );
  await b.waitForFunction(
    (id) => window.__wousJuego?.colgado().some((c) => c.id === id && c.globo),
    idA,
  );

  // Un gesto: Ana presiona 1 y Beto la ve saludar.
  await a.bringToFront();
  await a.keyboard.press('Digit1');
  await b.waitForFunction(
    (id) => window.__wousJuego?.colgado().some((c) => c.id === id && c.gesto === 'wave'),
    idA,
  );

  // Flood: cinco mensajes en 10 s pasan (el del HTML ya contó); el sexto no.
  for (const texto of ['uno', 'dos', 'tres', 'cuatro']) await decir(a, texto);
  await expect(enElChat(b, 'cuatro')).toBeVisible();
  await decir(a, 'cinco');
  await expect(a.locator('.charla__aviso')).toContainText('Vas muy rápido');
  await expect(a.getByLabel('Mensaje para la sala')).toHaveValue('cinco');
  await b.waitForTimeout(800);
  await expect(enElChat(b, 'cinco')).toHaveCount(0);

  expect(dialogos).toEqual([]);
  await ctxA.close();
  await ctxB.close();
});

test('bloquear: dejan de oírse, sigue al volver a entrar y se deshace en la casa; reportar llega', async ({
  browser,
}, info) => {
  test.skip(info.project.name !== 'escritorio', 'dos contextos de escritorio bastan');
  test.setTimeout(240_000);
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await cuentaPorApi(a, info, 'Ana Bloqueo');
  await cuentaPorApi(b, info, 'Beto Bloqueo');
  await entrar(a);
  await entrar(b);
  const idB = await yo(b);

  await decir(b, 'hola ana');
  await expect(enElChat(a, 'hola ana')).toBeVisible();

  // Desde su nombre en el chat: reportar y bloquear.
  await a.bringToFront();
  await a.getByRole('button', { name: 'Beto Bloqueo' }).first().click();
  const ficha = a.getByRole('dialog');
  await expect(ficha.getByText('«hola ana»')).toBeVisible();
  await ficha.getByRole('button', { name: 'Reportar' }).click();
  await ficha.getByText('Me está molestando').click();
  await ficha.getByRole('button', { name: 'Enviar reporte' }).click();
  await expect(ficha.getByText('¡Enviado!')).toBeVisible();
  await ficha.getByRole('button', { name: 'Bloquear también' }).click();
  await ficha.getByRole('button', { name: 'Bloquear', exact: true }).click();
  await expect(ficha.getByText('¡Hecho!')).toBeVisible();
  await ficha.getByRole('button', { name: 'Listo' }).click();
  await expect(ficha).toHaveCount(0);
  expect(await a.evaluate(() => window.__wousJuego?.bloqueados())).toEqual([idB]);

  // Ya no se oyen, en ninguna dirección.
  await decir(b, '¿me oyes?');
  await expect(enElChat(b, '¿me oyes?')).toBeVisible();
  await decir(a, 'no te oigo');
  await expect(enElChat(a, 'no te oigo')).toBeVisible();
  await a.waitForTimeout(1200);
  await expect(enElChat(a, '¿me oyes?')).toHaveCount(0);
  await expect(enElChat(b, 'no te oigo')).toHaveCount(0);

  // Ana vuelve a entrar: el bloqueo viene del servidor, no de la pestaña.
  await a.reload();
  await a.waitForFunction(() => window.__wousJuego?.conexion() === 'ONLINE', null, {
    timeout: 30_000,
  });
  await a.waitForFunction((id) => window.__wousJuego?.bloqueados().includes(id ?? ''), idB);
  await decir(b, 'sigo aquí');
  await expect(enElChat(b, 'sigo aquí')).toBeVisible();
  await a.waitForTimeout(1200);
  await expect(enElChat(a, 'sigo aquí')).toHaveCount(0);

  // En la casa: la lista y desbloquear.
  await a.getByRole('button', { name: 'Salir' }).click();
  await expect(a.getByRole('heading', { name: 'Personas que bloqueaste' })).toBeVisible();
  await expect(a.getByText('Beto Bloqueo')).toBeVisible();
  await a.getByRole('button', { name: 'Desbloquear' }).click();
  await expect(a.getByText('Nadie por ahora.', { exact: false })).toBeVisible();

  await ctxA.close();
  await ctxB.close();
});
