import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * Capturas de revisión de diseño de pantallas que exigen sesión. Solo corre
 * con WOUS_CAPTURAS=1 (no es una prueba): deja PNG en apps/web/.impeccable/review.
 */
test.skip(!process.env.WOUS_CAPTURAS, 'solo para capturas de revisión');

const OUT = path.join(import.meta.dirname, '../../apps/web/.impeccable/review');

test('probador (creador de personaje)', async ({ page, request }, info) => {
  test.setTimeout(120_000);
  mkdirSync(OUT, { recursive: true });
  const ip = `198.19.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  await page.route('**/api/**', (route) =>
    route.continue({ headers: { ...route.request().headers(), 'cf-connecting-ip': ip } }),
  );
  const tag = `${Date.now().toString(36)}c${info.project.name.slice(0, 1)}`;
  const email = `captura.${tag}@example.com`;

  await page.goto('/register');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Nombre de usuario').fill(`cap_${tag}`.slice(0, 20));
  await page.getByLabel('Contraseña', { exact: true }).fill('Captura de probador 2026');
  await page.getByText('Tengo 16 años o más').click();
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, {
    timeout: 30_000,
  });
  await page.getByRole('button', { name: 'Crear mi cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible();

  let link = '';
  for (let i = 0; i < 40 && !link; i++) {
    const res = await request.get(`/api/v1/dev/mailbox?to=${encodeURIComponent(email)}`);
    const body = (await res.json()) as {
      data: { messages: { type: string; params: Record<string, string> }[] };
    };
    link = body.data.messages.find((m) => m.type === 'EMAIL_VERIFY')?.params.verificationUrl ?? '';
    if (!link) await page.waitForTimeout(1000);
  }
  await page.goto(link);
  await page.getByRole('button', { name: 'Confirmar mi correo' }).click();
  await expect(page.getByRole('heading', { name: '¡Ya eres del barrio!' })).toBeVisible();

  await page.goto('/?quieto');
  await expect(page.getByRole('heading', { name: 'Arma tu personaje' })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'desktop-probador.png') });
  await page.getByRole('tab', { name: 'Arriba' }).click();
  await page.screenshot({ path: path.join(OUT, 'desktop-probador-arriba.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'mobile-probador.png'), fullPage: true });
});
