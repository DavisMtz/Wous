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

/** Camina con una tecla hasta que la posición cumpla la condición (o se atore). */
async function caminarHasta(
  page: Page,
  key: string,
  eje: 'x' | 'y',
  meta: number,
  timeoutMs = 12_000,
): Promise<void> {
  await page.bringToFront();
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(
      ([e, m, hacia]) => {
        const p = window.__wousJuego?.posicion();
        if (!p) return false;
        return hacia > 0 ? p[e] >= m : p[e] <= m;
      },
      [eje, meta, key === 'KeyD' || key === 'KeyS' ? 1 : -1] as const,
      { timeout: timeoutMs, polling: 30 },
    );
  } finally {
    await page.keyboard.up(key);
  }
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

  // Ana camina de la entrada a la puerta del Café: a la derecha y luego arriba hasta la fachada.
  await caminarHasta(a, 'KeyD', 'x', 30.9);
  await caminarHasta(a, 'KeyW', 'y', 3.3);
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
