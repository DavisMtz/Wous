import { type APIRequestContext, expect, type Page, test } from '@playwright/test';
import { cuentaPorApi, waitForMail } from './ayudantes.ts';

/**
 * Fase 8 (DoD, ADR-0011): la relación no se duplica, reintentar la misma
 * solicitud no manda más correos y apagar el aviso impide el correo social
 * pero no los de seguridad. Dos navegadores de verdad: Ana agrega a Beto desde
 * su ficha en la plaza, a Beto le llega el correo, acepta en su banda (la
 * foto de grupo) y a Ana le llega que ya son amigos.
 */

const TURNSTILE_PRUEBA = 'XXXX.DUMMY.TOKEN.XXXX';

async function entrar(page: Page) {
  await page.goto('/plaza');
  await page.waitForFunction(() => window.__wousJuego?.conexion() === 'ONLINE', null, {
    timeout: 30_000,
  });
}

const yo = (page: Page) => page.evaluate(() => window.__wousJuego?.yo() ?? null);

/** Correos de un tipo en el buzón de desarrollo, esperando a que la cola termine. */
async function correosDe(request: APIRequestContext, email: string, type: string) {
  await new Promise((r) => setTimeout(r, 7000));
  const res = await request.get(`/api/v1/dev/mailbox?to=${encodeURIComponent(email)}`);
  const body = (await res.json()) as { data: { messages: { type: string }[] } };
  return body.data.messages.filter((m) => m.type === type).length;
}

function origen(page: Page): string {
  return new URL(page.url()).origin;
}

test('agregar desde la ficha, aceptar en tu banda y un solo correo por solicitud', async ({
  browser,
}, info) => {
  test.skip(info.project.name !== 'escritorio', 'dos contextos de escritorio bastan');
  test.setTimeout(240_000);
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  const { email: correoA } = await cuentaPorApi(a, info, 'Ana Banda');
  const { email: correoB } = await cuentaPorApi(b, info, 'Beto Banda');

  // En la casa: el camino a tu banda, todavía sin calcomanía.
  await expect(b.getByRole('link', { name: 'Tu banda' })).toBeVisible();
  await expect(b.locator('.casa__nuevas')).toHaveCount(0);

  await entrar(a);
  await entrar(b);
  const idB = await yo(b);
  await a.waitForFunction((id) => window.__wousJuego?.remotos().some((r) => r.id === id), idB);

  // Ana abre la ficha de Beto desde «Gente aquí» (el camino por teclado) y lo agrega.
  await a.bringToFront();
  await a.getByRole('button', { name: /personas aquí/ }).click();
  await a.getByRole('button', { name: 'Beto Banda' }).click();
  const ficha = a.getByRole('dialog', { name: 'Beto Banda' });
  await ficha.getByRole('button', { name: 'Agregar amigo' }).click();
  await expect(ficha.getByText('¡Enviada!')).toBeVisible();

  // Reintentarla (otro clic, otra pestaña) responde lo mismo y no escribe nada nuevo.
  for (let i = 0; i < 2; i++) {
    const otra = await a.request.post('/api/v1/friends/request', {
      headers: { Origin: origen(a) },
      data: { characterId: idB },
    });
    expect(otra.status()).toBe(200);
    expect(((await otra.json()) as { data: { relation: string } }).data.relation).toBe('OUTGOING');
  }

  // A Beto le llega UN correo, con el enlace a su banda.
  const aviso = await waitForMail(b.request, correoB, 'FRIEND_REQUEST');
  expect(aviso.params.actorDisplayName).toBe('Ana Banda');
  expect(aviso.params.displayName).toBe('Beto Banda');
  const enlace = new URL(aviso.params.friendsUrl ?? '');
  expect(enlace.pathname).toBe('/friends');
  expect(await correosDe(b.request, correoB, 'FRIEND_REQUEST')).toBe(1);

  // Beto sigue el enlace: el recado de Ana espera en su banda. Acepta y Ana sale en la foto.
  await b.bringToFront();
  await b.goto(enlace.pathname);
  await expect(b.getByRole('heading', { name: 'Tu banda' })).toBeVisible();
  const recado = b.locator('.recado').filter({ hasText: 'Ana Banda' });
  await recado.getByRole('button', { name: 'Aceptar' }).click();
  await expect(recado).toHaveCount(0);
  await expect(b.getByRole('button', { name: 'Ana Banda' })).toBeVisible();
  await expect(b.getByText('1 amigo', { exact: true })).toBeVisible();

  // A Ana le llega que ya son amigos. Beto regresa a la plaza y Ana, al volver a
  // entrar, ve su etiqueta con la marca de amistad.
  const aceptado = await waitForMail(a.request, correoA, 'FRIEND_ACCEPTED');
  expect(aceptado.params.actorDisplayName).toBe('Beto Banda');
  await entrar(b);
  await a.bringToFront();
  await a.reload();
  await a.waitForFunction(() => window.__wousJuego?.conexion() === 'ONLINE', null, {
    timeout: 30_000,
  });
  await a.waitForFunction((id) => window.__wousJuego?.amigos().includes(id ?? ''), idB);
  await a.waitForFunction((id) => window.__wousJuego?.remotos().some((r) => r.id === id), idB);

  // En la ficha de Beto ya dice que es de tu banda.
  await a.getByRole('button', { name: /personas aquí/ }).click();
  await a.getByRole('button', { name: 'Beto Banda' }).click();
  await expect(
    a.getByRole('dialog', { name: 'Beto Banda' }).getByText('Es de tu banda'),
  ).toBeVisible();

  await ctxA.close();
  await ctxB.close();
});

test('con el aviso apagado la solicitud llega a la banda pero no al correo; seguridad sí sale', async ({
  browser,
}, info) => {
  test.skip(info.project.name !== 'escritorio', 'dos contextos de escritorio bastan');
  test.setTimeout(240_000);
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await cuentaPorApi(a, info, 'Ana Avisos');
  const { email: correoB } = await cuentaPorApi(b, info, 'Beto Avisos');

  // Beto apaga el aviso de solicitudes en su banda; al volver, sigue apagado.
  await b.goto('/friends');
  const casilla = b.getByRole('checkbox', { name: 'Cuando alguien me manda solicitud' });
  await expect(casilla).toBeChecked();
  await b.getByText('Cuando alguien me manda solicitud').click();
  await expect(casilla).not.toBeChecked();
  await b.waitForTimeout(600);
  await b.reload();
  await expect(
    b.getByRole('checkbox', { name: 'Cuando alguien me manda solicitud' }),
  ).not.toBeChecked();

  // Ana le pide amistad (con el ID de su personaje, como la ficha).
  const sesionB = await b.request.get('/api/v1/auth/session');
  const idB = ((await sesionB.json()) as { data: { character: { id: string } } }).data.character.id;
  const pedido = await a.request.post('/api/v1/friends/request', {
    headers: { Origin: origen(a) },
    data: { characterId: idB },
  });
  expect(pedido.status()).toBe(200);

  // La solicitud está en su banda, sin correo.
  await b.reload();
  await expect(b.locator('.recado').filter({ hasText: 'Ana Avisos' })).toBeVisible();
  expect(await correosDe(b.request, correoB, 'FRIEND_REQUEST')).toBe(0);

  // Un correo de seguridad sale igual.
  const olvido = await b.request.post('/api/v1/auth/forgot-password', {
    // IP propia: el límite de «olvidé mi contraseña» es por IP.
    headers: {
      Origin: origen(b),
      'CF-Connecting-IP': `198.18.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    },
    data: { email: correoB, turnstileToken: TURNSTILE_PRUEBA },
  });
  expect(olvido.status()).toBe(202);
  await waitForMail(b.request, correoB, 'PASSWORD_RESET');

  await ctxA.close();
  await ctxB.close();
});
