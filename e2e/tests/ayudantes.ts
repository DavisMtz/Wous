import { type APIRequestContext, expect, type Page, type TestInfo } from '@playwright/test';

/**
 * Ayudantes de las pruebas contra el stack local. El correo va en modo log:
 * el buzón de desarrollo (/api/v1/dev/mailbox, solo local) hace de bandeja.
 */

type MailboxMessage = { type: string; to: { email: string }; params: Record<string, string> };

export async function waitForMail(
  request: APIRequestContext,
  email: string,
  type: string,
  timeoutMs = 40_000,
): Promise<MailboxMessage> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await request.get(`/api/v1/dev/mailbox?to=${encodeURIComponent(email)}`);
    if (res.ok()) {
      const body = (await res.json()) as { data: { messages: MailboxMessage[] } };
      const found = body.data.messages.find((m) => m.type === type);
      if (found) return found;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`No llegó ${type} a ${email}`);
}

/** Cada corrida entra con su propia IP: los límites por IP no se pisan entre corridas. */
export async function useOwnIp(page: Page) {
  const ip = `198.18.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  await page.route('**/api/**', (route) =>
    route.continue({ headers: { ...route.request().headers(), 'cf-connecting-ip': ip } }),
  );
}

export async function turnstileReady(page: Page) {
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, {
    timeout: 30_000,
  });
}

/**
 * Cuenta nueva, verificada y con personaje, por la interfaz (como una
 * persona). Deja la página en la casa.
 */
export async function cuentaConPersonaje(
  page: Page,
  request: APIRequestContext,
  info: TestInfo,
  nombre: string,
): Promise<{ email: string; username: string; password: string }> {
  await useOwnIp(page);
  const tag = `${Date.now().toString(36)}${info.project.name.slice(0, 1)}`;
  const email = `e2e.${tag}@example.com`;
  const username = `e2e_${tag}`.slice(0, 20);
  const password = 'Tianguis de prueba 2026';

  await page.goto('/register');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Nombre de usuario').fill(username);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByText('Tengo 16 años o más').click();
  await turnstileReady(page);
  await page.getByRole('button', { name: 'Crear mi cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible();
  const verify = await waitForMail(request, email, 'EMAIL_VERIFY');
  await page.goto(verify.params.verificationUrl ?? '');
  await page.getByRole('button', { name: 'Confirmar mi correo' }).click();
  await page.getByRole('button', { name: 'Armar mi personaje' }).click();
  await page.getByLabel('Nombre de tu personaje').fill(nombre);
  await page.getByRole('button', { name: '¡Listo, a la plaza!' }).click();
  await expect(page.getByRole('heading', { name: `¡Qué onda, ${nombre}!` })).toBeVisible();
  return { email, username, password };
}
