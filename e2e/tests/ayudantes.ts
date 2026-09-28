import { spawnSync } from 'node:child_process';
import path from 'node:path';
import {
  type APIRequestContext,
  type BrowserContext,
  expect,
  type Page,
  type TestInfo,
} from '@playwright/test';

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
      sala(): string;
      yo(): string | null;
      colgado(): { id: string; globo: boolean; gesto: string | null }[];
      bloqueados(): string[];
      amigos(): string[];
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
export async function cuentaPorApi(
  page: Page,
  info: TestInfo,
  nombre: string,
): Promise<{ email: string; username: string }> {
  const origin = new URL(info.project.use.baseURL ?? 'http://localhost:5173').origin;
  // IP propia por cuenta, como useOwnIp: los límites por IP no se pisan entre corridas.
  const ip = `198.18.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  const headers = { Origin: origin, 'CF-Connecting-IP': ip };
  const tag = `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
  const email = `e2e.api.${tag}@example.com`;
  const username = `e2e_${tag}`.slice(0, 20);
  const registro = await page.request.post('/api/v1/auth/register', {
    headers,
    data: {
      email,
      username,
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
  return { email, username };
}

/**
 * Da el rol de la caseta con el script de moderación, como en la vida real
 * (ADR-0012): la web no tiene forma de darlo. Habla con la D1 local.
 */
export function darCaseta(username: string): void {
  const raiz = path.join(import.meta.dirname, '../..');
  const r = spawnSync(
    process.execPath,
    [
      'scripts/moderacion/moderar.mts',
      'local',
      'dar-caseta',
      `@${username}`,
      '--motivo',
      'Prueba E2E',
      '--moderador',
      'e2e',
    ],
    { cwd: raiz, encoding: 'utf8' },
  );
  if (r.status !== 0) throw new Error(`dar-caseta falló:\n${r.stderr || r.stdout}`);
}

/**
 * Turnstile de mentiras para los formularios: entrega el token que el Worker
 * local acepta con las llaves de prueba, sin depender de challenges.cloudflare.com
 * (que en una máquina sin salida no carga). Lo que se prueba es la pantalla.
 */
export async function turnstileDePrueba(page: Page): Promise<void> {
  await page.route('https://challenges.cloudflare.com/turnstile/**', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `(() => {
        const widgets = new Map();
        const dar = (id) => setTimeout(() => widgets.get(id)?.callback?.('XXXX.DUMMY.TOKEN.XXXX'), 30);
        window.turnstile = {
          render(el, opts) {
            const id = 'prueba-' + Math.random().toString(36).slice(2);
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'cf-turnstile-response';
            input.value = 'XXXX.DUMMY.TOKEN.XXXX';
            el.append(input);
            widgets.set(id, opts);
            dar(id);
            return id;
          },
          reset(id) { dar(id); },
          remove(id) { widgets.delete(id); },
        };
      })();`,
    }),
  );
}

/** La cookie de sesión de un contexto (para hablar con la sala desde la prueba). */
export async function sesionDe(context: BrowserContext): Promise<string> {
  const cookie = (await context.cookies()).find((c) => c.name === '__Host-wous_session');
  if (!cookie) throw new Error('El contexto no tiene sesión');
  return cookie.value;
}

type Mensaje = { type: string; payload: Record<string, unknown> };

/**
 * Una conexión a la sala desde Node, con la sesión de una cuenta: para
 * preparar escenas (quién dice qué) sin abrir otra plaza en el navegador.
 */
export async function salaDesdeNode(baseURL: string, sesion: string) {
  const url = new URL('/ws/world', baseURL);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const recibidos: Mensaje[] = [];
  // El WebSocket de Node (undici) acepta cabeceras; el tipo estándar no lo sabe.
  const ws = new WebSocket(url, {
    headers: { Origin: new URL(baseURL).origin, Cookie: `__Host-wous_session=${sesion}` },
  } as unknown as string[]);
  ws.addEventListener('message', (e) => recibidos.push(JSON.parse(String(e.data)) as Mensaje));
  await new Promise<void>((resolve, reject) => {
    ws.addEventListener('open', () => resolve());
    ws.addEventListener('error', () => reject(new Error('No abrió la sala')));
  });
  const esperar = async (cumple: (m: Mensaje) => boolean, ms = 15_000): Promise<Mensaje> => {
    const fin = Date.now() + ms;
    while (Date.now() < fin) {
      const m = recibidos.find(cumple);
      if (m) {
        recibidos.splice(recibidos.indexOf(m), 1);
        return m;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`No llegó (${recibidos.map((m) => m.type).join(', ')})`);
  };
  await esperar((m) => m.type === 'ROOM_SNAPSHOT');
  return {
    decir: (text: string) =>
      ws.send(JSON.stringify({ v: 1, type: 'CHAT_SEND', payload: { text } })),
    reportar: (payload: Record<string, unknown>) =>
      ws.send(JSON.stringify({ v: 1, type: 'REPORT_PLAYER', payload })),
    esperar,
    cerrar: () => ws.close(1000),
  };
}
