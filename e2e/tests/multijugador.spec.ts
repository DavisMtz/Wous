import { expect, type Page, test } from '@playwright/test';
import { cuentaPorApi } from './ayudantes.ts';

/**
 * Fase 5: dos navegadores en la misma plaza. El DoD pide que se vean, que el
 * movimiento de uno le llegue al otro y que desconectar quite la presencia.
 */

async function entrar(page: Page) {
  await page.getByRole('button', { name: 'Salir a la plaza' }).click();
  await expect(page).toHaveURL(/\/plaza$/);
  await page.waitForFunction(() => window.__wousJuego?.conexion() === 'ONLINE', null, {
    timeout: 20_000,
  });
}

const remotos = (page: Page) => page.evaluate(() => window.__wousJuego?.remotos() ?? []);

test('dos navegadores se ven, uno camina y el otro lo ve; al irse, desaparece', async ({
  browser,
}, info) => {
  test.skip(info.project.name !== 'escritorio', 'dos contextos de escritorio bastan');
  // Dos cuentas completas (Turnstile y Argon2 reales) antes de empezar.
  test.setTimeout(240_000);

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await cuentaPorApi(a, info, 'Ana Red');
  await cuentaPorApi(b, info, 'Beto Red');

  await entrar(a);
  await entrar(b);

  // Se ven: cada quien tiene un remoto y el letrero cuenta a dos.
  await b.waitForFunction(() => (window.__wousJuego?.remotos().length ?? 0) === 1);
  await a.waitForFunction(() => (window.__wousJuego?.remotos().length ?? 0) === 1);
  await expect(b.getByText('2 personas aquí')).toBeVisible();

  // Ana camina hacia arriba; Beto la ve subir.
  const [antes] = await remotos(b);
  if (!antes) throw new Error('Beto no ve a Ana');
  await a.bringToFront();
  await a.keyboard.down('KeyW');
  await a.waitForTimeout(800);
  await a.keyboard.up('KeyW');
  await b.waitForFunction(
    (y0) => {
      const [r] = window.__wousJuego?.remotos() ?? [];
      return r !== undefined && r.y < y0 - 1.5;
    },
    antes.y,
    { timeout: 10_000 },
  );

  // Donde Ana cree estar y donde Beto la dibuja coinciden (al asentarse).
  await a.waitForTimeout(600);
  const propia = await a.evaluate(() => window.__wousJuego?.posicion());
  const [vista] = await remotos(b);
  expect(Math.abs((propia?.y ?? 0) - (vista?.y ?? 0))).toBeLessThan(0.3);

  // Ana cierra la pestaña de golpe: Beto deja de verla.
  await a.close();
  await b.waitForFunction(() => (window.__wousJuego?.remotos().length ?? 1) === 0, null, {
    timeout: 10_000,
  });
  await expect(b.getByText('Solo tú por ahora')).toBeVisible();
  await ctxA.close();
  await ctxB.close();
});
