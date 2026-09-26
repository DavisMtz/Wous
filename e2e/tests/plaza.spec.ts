import { expect, type Page, test } from '@playwright/test';
import { cuentaPorApi } from './ayudantes.ts';

/**
 * Fase 4: la Plaza local. El DoD pide caminar con WASD/flechas en PC, con
 * joystick en el teléfono y que cambiar de método actualice la interfaz sin
 * recargar. La posición se lee del handle de desarrollo (`__wousJuego`).
 */

type Vec = { x: number; y: number };

async function posicion(page: Page): Promise<Vec> {
  const pos = await page.evaluate(() => window.__wousJuego?.posicion() ?? null);
  if (!pos) throw new Error('El juego no reporta posición');
  return pos;
}

async function metodo(page: Page): Promise<string> {
  return page.evaluate(() => window.__wousJuego?.metodo() ?? '');
}

async function entrarALaPlaza(page: Page) {
  await page.getByRole('button', { name: 'Salir a la plaza' }).click();
  await expect(page).toHaveURL(/\/plaza$/);
  await expect(page.getByRole('heading', { name: 'La Plaza' })).toBeVisible();
  await page.waitForFunction(() => window.__wousJuego?.posicion() != null, null, {
    timeout: 20_000,
  });
}

async function mantener(page: Page, key: string, ms: number) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

test('en PC se camina con WASD y flechas, y se sale a la casa', async ({ page }, info) => {
  test.skip(info.project.name !== 'escritorio', 'teclado: proyecto de escritorio');
  test.setTimeout(120_000);
  await cuentaPorApi(page, info, 'Teclado');
  await entrarALaPlaza(page);

  expect(await metodo(page)).toBe('KEYBOARD_MOUSE');
  await expect(page.getByText('para caminar')).toBeVisible();

  const inicio = await posicion(page);
  await mantener(page, 'KeyW', 600);
  const arriba = await posicion(page);
  expect(arriba.y).toBeLessThan(inicio.y - 1);
  expect(arriba.x).toBeCloseTo(inicio.x, 3);

  await mantener(page, 'ArrowLeft', 400);
  const izquierda = await posicion(page);
  expect(izquierda.x).toBeLessThan(arriba.x - 0.5);

  // Después de la primera vuelta, la pista de caminar se retira.
  await expect(page.getByText('para caminar')).toBeHidden();

  // Recargar no rompe nada: la plaza vuelve a abrir.
  await page.reload();
  await page.waitForFunction(() => window.__wousJuego?.posicion() != null);

  await page.getByRole('button', { name: 'Salir', exact: true }).click();
  await expect(page.getByRole('heading', { name: '¡Qué onda, Teclado!' })).toBeVisible();
});

test('en el teléfono se camina con el joystick y los controles siguen al método', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'movil', 'táctil: proyecto móvil');
  test.setTimeout(120_000);
  await cuentaPorApi(page, info, 'Pulgar');
  await entrarALaPlaza(page);

  expect(await metodo(page)).toBe('TOUCH');
  const joystick = page.locator('.joystick');
  await expect(joystick).toBeVisible();
  await expect(page.getByText('Arrastra para caminar')).toBeVisible();

  // Arrastrar la perilla hacia arriba.
  const caja = await joystick.boundingBox();
  if (!caja) throw new Error('Sin joystick');
  const cx = caja.x + caja.width / 2;
  const cy = caja.y + caja.height / 2;
  const inicio = await posicion(page);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy - 45, { steps: 4 });
  await page.waitForTimeout(700);
  await page.mouse.up();
  const despues = await posicion(page);
  expect(despues.y).toBeLessThan(inicio.y - 1);
  // Arrastrar el joystick no cuenta como «usar el ratón».
  expect(await metodo(page)).toBe('TOUCH');

  // Un teclado conectado: tras el debounce se esconden los controles táctiles.
  await mantener(page, 'KeyD', 600);
  await expect(joystick).toBeHidden();
  expect(await metodo(page)).toBe('KEYBOARD_MOUSE');

  // Tocar la pantalla los trae de vuelta al instante, sin recargar.
  await page.touchscreen.tap(cx + 300, cy - 120);
  await expect(joystick).toBeVisible();
  expect(await metodo(page)).toBe('TOUCH');

  // En vertical se pide girar el teléfono; al volver, el juego sigue.
  await page.setViewportSize({ width: 412, height: 915 });
  await expect(page.getByRole('heading', { name: 'Gira tu teléfono' })).toBeVisible();
  await page.setViewportSize({ width: 915, height: 412 });
  await expect(page.getByRole('heading', { name: 'Gira tu teléfono' })).toBeHidden();
  await expect(joystick).toBeVisible();
});

test('junto a la puerta del Café aparece la acción y E responde', async ({ page }, info) => {
  test.skip(Boolean(process.env.WOUS_BASE_URL), 'el banco de la plaza solo existe en desarrollo');
  test.skip(info.project.name !== 'escritorio', 'teclado: proyecto de escritorio');
  await page.goto('/dev-plaza.html?quieto&spawn=desde-cafe');
  await page.waitForFunction(() => window.__wousJuego?.posicion() != null);

  const accion = page.locator('.pista--accion');
  await expect(accion).toContainText('Entrar al Café');
  await page.keyboard.press('KeyE');
  await expect(
    page.getByRole('status').filter({ hasText: 'El Café abre muy pronto' }),
  ).toBeVisible();

  // Alejarse de la puerta quita la acción.
  await mantener(page, 'KeyS', 700);
  await expect(accion).toBeHidden();
});
