import { type APIRequestContext, expect, type Page, type TestInfo } from '@playwright/test';

/**
 * Ayudantes de las pruebas contra el stack local. El correo va en modo log:
 * el buzón de desarrollo (/api/v1/dev/mailbox, solo local) hace de bandeja.
 */

declare global {
  interface Window {
    /** Solo en desarrollo: lo que el juego deja leer a las pruebas. */
    __wousJuego?: {
      posicion(): { x: number; y: number } | null;
      metodo(): string;
      remotos(): { id: string; x: number; y: number }[];
      conexion(): string;
    };
  }
}

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
  // El widget viene de challenges.cloudflare.com: en una máquina cargada tarda.
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, {
    timeout: 60_000,
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

/** Token que aceptan las llaves de prueba de Turnstile en local (sin red). */
const TURNSTILE_PRUEBA = 'XXXX.DUMMY.TOKEN.XXXX';

/**
 * Cuenta verificada con personaje por la API, con las cookies en el contexto
 * de la página. Para pruebas que tratan de la plaza, no del registro (ese
 * flujo lo cubre cuenta.spec con la interfaz): no dependen del widget de
 * Turnstile, que en una máquina cargada puede no cargar. Deja la página en la casa.
 */
export async function cuentaPorApi(page: Page, info: TestInfo, nombre: string): Promise<void> {
  const origin = new URL(info.project.use.baseURL ?? 'http://localhost:5173').origin;
  // IP propia por cuenta, como useOwnIp: los límites por IP no se pisan entre corridas.
  const ip = `198.18.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  const headers = { Origin: origin, 'CF-Connecting-IP': ip };
  const tag = `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
  const email = `e2e.api.${tag}@example.com`;
  const registro = await page.request.post('/api/v1/auth/register', {
    headers,
    data: {
      email,
      username: `e2e_${tag}`.slice(0, 20),
      password: 'Tianguis de prueba 2026',
      turnstileToken: TURNSTILE_PRUEBA,
      termsVersion: '2026-01',
    },
  });
  expect(registro.status(), await registro.text()).toBe(202);
  const verify = await waitForMail(page.request, email, 'EMAIL_VERIFY');
  const token = new URL(verify.params.verificationUrl ?? '').searchParams.get('token');
  const verificado = await page.request.post('/api/v1/auth/verify-email', {
    headers,
    data: { token },
  });
  expect(verificado.status()).toBe(200);
  const personaje = await page.request.post('/api/v1/characters', {
    headers,
    data: {
      displayName: nombre,
      appearance: {
        body: 'a',
        skinTone: 'piel-4',
        hair: 'chino',
        hairColor: 'castano',
        top: 'playera.verde',
        bottom: 'pantalon.mezclilla',
        shoes: 'tenis.blanco',
        accessory: null,
      },
    },
  });
  expect(personaje.status(), await personaje.text()).toBe(201);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: `¡Qué onda, ${nombre}!` })).toBeVisible();
}
