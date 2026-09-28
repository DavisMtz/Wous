import { expect, type Page, test } from '@playwright/test';
import { cuentaPorApi } from './ayudantes.ts';

/**
 * Fase 6: la Plaza y el Café son dos salas. Cruzar la puerta lo valida el
 * servidor; quien se queda en la Plaza deja de ver a quien entró; recargar
 * te deja donde estabas; y de regreso vuelven a verse.
 */

async function entrar(page: Page) {
  await page.getByRole('button', { name: 'Salir a la plaza' }).click();
  await expect(page).toHaveURL(/\/plaza$/);
  await enLinea(page);
}

async function enLinea(page: Page, sala?: string) {
  await page.waitForFunction(
    (s) => window.__wousJuego?.conexion() === 'ONLINE' && (!s || window.__wousJuego?.sala() === s),
    sala,
    { timeout: 20_000 },
  );
}

/**
 * Camina por un eje hasta `meta` (± `tolerancia`) a toquecitos: cada uno
 * cubre parte de lo que falta y se vuelve a medir. Soltar una tecla tarda
 * (sin GPU, un cuadro dura tanto que el toque más corto avanza casi un tile):
 * mantenerla hasta pasarse deja al personaje donde sea y la ruta se atora en
 * el primer farol. Por eso cada tramo pide la holgura que su camino permite.
 */
async function caminarHasta(
  page: Page,
  eje: 'x' | 'y',
  meta: number,
  tolerancia: number,
): Promise<void> {
  await page.bringToFront();
  let antes: number | null = null;
  let quieto = 0;
  for (let i = 0; i < 60; i++) {
    const p = await page.evaluate(() => window.__wousJuego?.posicion() ?? null);
    if (!p) throw new Error('El juego no reporta posición');
    const falta = meta - p[eje];
    if (Math.abs(falta) <= tolerancia) return;
    // Cuatro toques seguidos sin avanzar: algo estorba.
    quieto = antes !== null && Math.abs(p[eje] - antes) < 0.01 ? quieto + 1 : 0;
    if (quieto >= 4) {
      throw new Error(`Atorada en ${p.x.toFixed(2)},${p.y.toFixed(2)} rumbo a ${eje}=${meta}`);
    }
    antes = p[eje];
    const key = eje === 'x' ? (falta > 0 ? 'KeyD' : 'KeyA') : falta > 0 ? 'KeyS' : 'KeyW';
    // El 70 % de lo que falta a 4.2 tiles/s, sin pasar de 3 s ni bajar de 80 ms.
    const ms = Math.max(80, Math.min(3000, ((Math.abs(falta) * 0.7) / 4.2) * 1000));
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    await page.keyboard.up(key);
    await page.waitForTimeout(60);
  }
  throw new Error(`No llegó a ${eje}=${meta}`);
}

test('cruza al Café: la Plaza deja de verla, recargar la deja ahí y de regreso se ven', async ({
  browser,
}, info) => {
  test.skip(info.project.name !== 'escritorio', 'dos contextos de escritorio bastan');
  test.setTimeout(240_000);

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await cuentaPorApi(a, info, 'Ana Café');
  await cuentaPorApi(b, info, 'Beto Plaza');
  await entrar(a);
  await entrar(b);
  // Por ID: otras pruebas pueden dejar gente en la misma plaza.
  const idA = (await (
    await a.waitForFunction(() => window.__wousJuego?.yo() ?? null)
  ).jsonValue()) as string;
  const beVeAAna = (visible: boolean) =>
    b.waitForFunction(
      ([id, v]) => (window.__wousJuego?.remotos() ?? []).some((r) => r.id === id) === v,
      [idA, visible] as const,
      { timeout: 10_000 },
    );
  await beVeAAna(true);

  // Ana camina del atrio a la puerta del Café, bajo los portales de Allende:
  // por el atrio poniente (sin reja al norte, como el de verdad) hasta el
  // empedrado de Allende, y por él hasta el arco del Café. Cada tramo tiene
  // holgura para un personaje que no se detiene exacto.
  await caminarHasta(a, 'x', 49, 1.2);
  await caminarHasta(a, 'y', 8.5, 0.6);
  await caminarHasta(a, 'x', 72.875, 0.6);
  await caminarHasta(a, 'y', 5.3, 0.3);
  await expect(a.locator('.pista--accion')).toContainText('Entrar al Café');
  await a.keyboard.press('KeyE');

  await enLinea(a, 'cafe');
  await expect(a.getByRole('heading', { name: 'El Café' })).toBeVisible();
  // Beto se quedó en la Plaza: ya no la ve.
  await beVeAAna(false);

  // Recargar no te saca del Café: la sala la recuerda el servidor.
  await a.reload();
  await enLinea(a, 'cafe');
  await expect(a.getByRole('heading', { name: 'El Café' })).toBeVisible();

  // De regreso por la puerta del Café.
  await expect(a.locator('.pista--accion')).toContainText('Salir a la Plaza');
  await a.bringToFront();
  await a.keyboard.press('KeyE');
  await enLinea(a, 'plaza');
  await beVeAAna(true);

  await ctxA.close();
  await ctxB.close();
});
