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

test('un pulgar que no se está quieto en el joystick no corta la conexión (iPad, 27/09/2026)', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'movil', 'táctil: proyecto móvil');
  test.setTimeout(120_000);
  // Cuenta los PLAYER_INPUT que salen por el WebSocket, con su hora.
  await page.addInitScript(() => {
    const enviar = WebSocket.prototype.send;
    const envios: number[] = [];
    (window as unknown as { __envios: number[] }).__envios = envios;
    WebSocket.prototype.send = function (this: WebSocket, data) {
      if (typeof data === 'string' && data.includes('"PLAYER_INPUT"'))
        envios.push(performance.now());
      return enviar.call(this, data);
    };
  });
  await cuentaPorApi(page, info, 'Pulgar Inquieto');
  await entrarALaPlaza(page);
  await page.waitForFunction(() => window.__wousJuego?.conexion() === 'ONLINE', null, {
    timeout: 30_000,
  });
  const joystick = page.locator('.joystick');
  await expect(joystick).toBeVisible();
  const caja = await joystick.boundingBox();
  if (!caja) throw new Error('Sin joystick');
  const cx = caja.x + caja.width / 2;
  const cy = caja.y + caja.height / 2;

  // Seis segundos dando vueltas: la dirección cambia en cada cuadro, como un
  // dedo de verdad (un iPad manda de 60 a 120 movimientos por segundo; desde
  // Playwright no se llega a ese ritmo, así que se mueve dentro de la página,
  // dos veces por cuadro, con el mismo puntero que tomó la perilla). Antes, el
  // cliente mandaba un input por cuadro y la sala, al juntar faltas, cortaba el
  // cable con «Wous se actualizó».
  await page.evaluate(() => {
    document.querySelector('.joystick')?.addEventListener(
      'pointerdown',
      (e) => {
        (window as unknown as { __puntero: number }).__puntero = (e as PointerEvent).pointerId;
      },
      { capture: true },
    );
  });
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.evaluate(
    ({ x, y }) =>
      new Promise<void>((resolve) => {
        const perilla = document.querySelector('.joystick');
        const pointerId = (window as unknown as { __puntero?: number }).__puntero ?? 1;
        const fin = performance.now() + 6000;
        let i = 0;
        const paso = () => {
          for (let k = 0; k < 2; k++) {
            i += 1;
            const angulo = i * 0.21;
            perilla?.dispatchEvent(
              new PointerEvent('pointermove', {
                pointerId,
                bubbles: true,
                clientX: x + Math.cos(angulo) * 40,
                clientY: y + Math.sin(angulo) * 40,
              }),
            );
          }
          if (performance.now() < fin) requestAnimationFrame(paso);
          else resolve();
        };
        requestAnimationFrame(paso);
      }),
    { x: cx, y: cy },
  );
  await page.mouse.up();
  await page.waitForTimeout(500);

  // Lo más que salió en un segundo cualquiera: muy por debajo de lo que la sala tolera (40).
  const porSegundo = await page.evaluate(() => {
    const envios = (window as unknown as { __envios: number[] }).__envios;
    let max = 0;
    for (let i = 0, j = 0; i < envios.length; i++) {
      while ((envios[i] ?? 0) - (envios[j] ?? 0) > 1000) j++;
      max = Math.max(max, i - j + 1);
    }
    return { max, total: envios.length };
  });
  expect(porSegundo.total).toBeGreaterThan(60);
  expect(porSegundo.max).toBeLessThanOrEqual(30);
  expect(await page.evaluate(() => window.__wousJuego?.conexion())).toBe('ONLINE');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

test('junto a la puerta del Café aparece la acción y E cruza (banco, sin servidor)', async ({
  page,
}, info) => {
  test.skip(Boolean(process.env.WOUS_BASE_URL), 'el banco de la plaza solo existe en desarrollo');
  test.skip(info.project.name !== 'escritorio', 'teclado: proyecto de escritorio');
  await page.goto('/dev-plaza.html?quieto&spawn=desde-cafe');
  await page.waitForFunction(() => window.__wousJuego?.posicion() != null);

  const accion = page.locator('.pista--accion');
  await expect(accion).toContainText('Entrar al Café');
  // Alejarse de la puerta quita la acción; volver la trae.
  await mantener(page, 'KeyS', 700);
  await expect(accion).toBeHidden();
  await mantener(page, 'KeyW', 900);
  await expect(accion).toContainText('Entrar al Café');

  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__wousJuego?.sala() === 'cafe');
  await expect(page.getByRole('heading', { name: 'El Café' })).toBeVisible();
  await expect(accion).toContainText('Salir a la Plaza');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__wousJuego?.sala() === 'plaza');
  await expect(page.getByRole('heading', { name: 'La Plaza' })).toBeVisible();
});

test('en una banca se sienta con E, caminar la levanta y las placas se leen (banco, sin servidor)', async ({
  page,
}, info) => {
  test.skip(Boolean(process.env.WOUS_BASE_URL), 'el banco de la plaza solo existe en desarrollo');
  test.skip(info.project.name !== 'escritorio', 'teclado: proyecto de escritorio');
  const accion = page.locator('.pista--accion');

  // Frente a una banca de la Plaza de Armas, del lado de Madero.
  await page.goto('/dev-plaza.html?quieto&en=76,43.2');
  await page.waitForFunction(() => window.__wousJuego?.posicion() != null);
  await expect(accion).toContainText('Sentarse');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(
    () => Math.abs((window.__wousJuego?.posicion()?.y ?? 0) - 42.65) < 0.01,
  );
  await expect(accion).toContainText('Levantarse');
  // Caminar levanta a quien está sentado; la banca se vuelve a ofrecer.
  await mantener(page, 'KeyS', 250);
  expect((await posicion(page)).y).toBeGreaterThan(43.1);
  await expect(accion).toContainText('Sentarse');

  // La placa de la UNESCO se lee con E y se cierra con Esc.
  await page.goto('/dev-plaza.html?quieto&en=66.1,44.4');
  await page.waitForFunction(() => window.__wousJuego?.posicion() != null);
  await expect(accion).toContainText('Leer la placa');
  await page.keyboard.press('KeyE');
  const placa = page.getByRole('complementary', { name: 'Patrimonio Cultural de la Humanidad' });
  await expect(placa).toContainText('Diciembre de 1991');
  await page.keyboard.press('Escape');
  await expect(placa).toBeHidden();

  // La Catedral todavía no se abre: su puerta lo dice.
  await page.goto('/dev-plaza.html?quieto&en=34,36.3');
  await page.waitForFunction(() => window.__wousJuego?.posicion() != null);
  await expect(accion).toContainText('Ver la Catedral');
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('complementary', { name: 'Catedral de Morelia' })).toContainText(
    /pronto se podrá entrar/i,
  );
});
