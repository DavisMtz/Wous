import { expect, test } from '@playwright/test';
import {
  cuentaPorApi,
  darCaseta,
  salaDesdeNode,
  sesionDe,
  turnstileDePrueba,
  useOwnIp,
} from './ayudantes.ts';

/**
 * Fase 9 (ADR-0012): la caseta. Solo existe para quien tiene el rol (y el rol
 * solo lo da el script); lo que se decide ahí aplica en la sala en el acto y
 * queda en la bitácora; una suspensión con fin se ve al intentar entrar; las
 * invitaciones se comparten como enlace que llega al registro con el código.
 */

const PASSWORD = 'Tianguis de prueba 2026';

test('la caseta es solo de quien tiene el rol: para lo demás no existe', async ({ page }, info) => {
  test.setTimeout(120_000);
  const { username } = await cuentaPorApi(page, info, 'Nico Curioso');

  await page.goto('/caseta');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: '¡Qué onda, Nico Curioso!' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'La caseta' })).toHaveCount(0);
  expect((await page.request.get('/api/v1/admin/summary')).status()).toBe(404);

  darCaseta(username);
  await page.reload();
  await page.getByRole('link', { name: 'La caseta' }).click();
  await expect(page.getByRole('heading', { name: 'La caseta' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ahora en Wous' })).toBeVisible();
  await expect(page.getByText('Local', { exact: true })).toBeVisible();
  // Las cuatro pestañas a la vista: en el teléfono se acomodan, no se esconden.
  for (const nombre of ['Tablero', 'Reportes', 'Personas', 'Invitaciones']) {
    await expect(page.getByRole('link', { name: nombre, exact: true })).toBeInViewport();
  }
});

test('atender un reporte: la evidencia de la sala y un silencio que aplica en el acto', async ({
  browser,
}, info) => {
  test.skip(info.project.name !== 'escritorio', 'la caseta se atiende igual en cualquier pantalla');
  test.setTimeout(180_000);
  const baseURL = info.project.use.baseURL ?? 'http://localhost:5173';
  const ctxCaseta = await browser.newContext();
  const ctxLola = await browser.newContext();
  const ctxMemo = await browser.newContext();
  const caseta = await ctxCaseta.newPage();
  const { username: quienAtiende } = await cuentaPorApi(caseta, info, 'Vero Caseta');
  darCaseta(quienAtiende);
  await cuentaPorApi(await ctxLola.newPage(), info, 'Lola Grosera');
  await cuentaPorApi(await ctxMemo.newPage(), info, 'Memo Reporta');

  // En la plaza: Lola insulta y Memo la reporta por el mensaje (la sala guarda la evidencia).
  const lola = await salaDesdeNode(baseURL, await sesionDe(ctxLola));
  const memo = await salaDesdeNode(baseURL, await sesionDe(ctxMemo));
  lola.decir('eres un tonto');
  const dicho = await memo.esperar(
    (m) =>
      m.type === 'CHAT_MESSAGE' && (m.payload.message as { text: string }).text === 'eres un tonto',
  );
  const mensaje = dicho.payload.message as { id: string; from: string };
  memo.reportar({ characterId: mensaje.from, reason: 'HARASSMENT', messageId: mensaje.id });
  await memo.esperar((m) => m.type === 'REPORT_ACCEPTED');

  await caseta.goto('/caseta?seccion=reportes');
  await caseta
    .getByRole('link', { name: /Lola Grosera/ })
    .first()
    .click();
  await expect(caseta.locator('.caseta-evidencia__linea--reportada')).toContainText(
    'eres un tonto',
  );
  await caseta.getByLabel('Silenciar', { exact: true }).check();
  await caseta.getByLabel('1 hora', { exact: true }).check();
  await caseta.getByLabel('Motivo (queda en la bitácora)').fill('Insultos en la plaza');
  await caseta.getByRole('button', { name: 'Silenciar 1 hora' }).click();
  await expect(caseta.getByText(`Silencio de 1 hora · @${quienAtiende}`)).toBeVisible();

  // Sin esperar la revisión del minuto: la sala ya lo sabe.
  lola.decir('otra vez');
  const error = await lola.esperar((m) => m.type === 'ERROR');
  expect(error.payload.code).toBe('CHAT_MUTED');

  // Y queda en su ficha, con quién lo hizo y por qué.
  await caseta.getByRole('link', { name: 'Ver su ficha' }).click();
  const bitacora = caseta.locator('.caseta-bitacora');
  await expect(bitacora).toContainText('Silencio en el chat · Insultos en la plaza');
  await expect(bitacora).toContainText(`@${quienAtiende}`);

  lola.cerrar();
  memo.cerrar();
  await Promise.all([ctxCaseta.close(), ctxLola.close(), ctxMemo.close()]);
});

test('suspender desde la ficha saca de la plaza y el login dice hasta cuándo', async ({
  browser,
}, info) => {
  test.skip(info.project.name !== 'escritorio', 'dos contextos de escritorio bastan');
  test.setTimeout(180_000);
  const ctxCaseta = await browser.newContext();
  const ctxAntonio = await browser.newContext();
  const caseta = await ctxCaseta.newPage();
  const antonio = await ctxAntonio.newPage();
  const { username: quienAtiende } = await cuentaPorApi(caseta, info, 'Rosa Caseta');
  darCaseta(quienAtiende);
  const cuenta = await cuentaPorApi(antonio, info, 'Toño Suspendido');

  await antonio.goto('/plaza');
  await antonio.waitForFunction(() => window.__wousJuego?.conexion() === 'ONLINE', null, {
    timeout: 30_000,
  });

  await caseta.goto(`/caseta?seccion=personas&q=${cuenta.username}`);
  await caseta.getByRole('link', { name: /Toño Suspendido/ }).click();
  await caseta.getByLabel('Suspender', { exact: true }).check();
  await caseta.getByLabel('3 días', { exact: true }).check();
  await caseta.getByLabel('Motivo (queda en la bitácora)').fill('Acoso repetido');
  await caseta.getByRole('button', { name: 'Suspender 3 días' }).click();
  await expect(caseta.locator('.caseta-persona')).toContainText('Suspendida');

  // La plaza de Toño se cierra en el acto…
  await expect(antonio.getByRole('heading', { name: 'Tu sesión terminó' })).toBeVisible({
    timeout: 15_000,
  });
  // …y al intentar entrar se entera de hasta cuándo.
  await turnstileDePrueba(antonio);
  await useOwnIp(antonio);
  await antonio.goto('/login');
  await antonio.getByLabel('Correo o nombre de usuario').fill(cuenta.email);
  await antonio.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await antonio.getByRole('button', { name: 'Entrar' }).click();
  await expect(antonio.getByRole('alert')).toContainText('Tu cuenta está suspendida hasta el');

  await Promise.all([ctxCaseta.close(), ctxAntonio.close()]);
});

test('una invitación se crea en la caseta y su enlace llega al registro con el código', async ({
  browser,
}, info) => {
  test.skip(info.project.name !== 'escritorio', 'el formulario es el mismo en el teléfono');
  test.setTimeout(180_000);
  const ctxCaseta = await browser.newContext();
  const caseta = await ctxCaseta.newPage();
  const { username } = await cuentaPorApi(caseta, info, 'Iván Invita');
  darCaseta(username);

  await caseta.goto('/caseta?seccion=invitaciones');
  // Nombre propio de esta corrida: la D1 local guarda las invitaciones de las anteriores.
  const para = `Primos del norte ${Date.now().toString(36)}`;
  await caseta.getByLabel('¿Para quién es?').fill(para);
  await caseta.getByLabel('1 persona', { exact: true }).check();
  await caseta.getByLabel('7 días', { exact: true }).check();
  await caseta.getByRole('button', { name: 'Crear invitación' }).click();
  const codigo = ((await caseta.locator('.caseta-codigo').textContent()) ?? '').trim();
  expect(codigo).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/);
  const enlace = ((await caseta.locator('.caseta-recien__enlace').textContent()) ?? '').trim();
  expect(enlace).toContain(`/register?invitacion=${codigo}`);
  const fila = caseta.locator('.caseta-invitacion', { hasText: para });
  await expect(fila).toContainText('0 de 1 usos');
  await expect(fila).toContainText('Vigente');

  // Quien recibe el enlace, con el registro en modo alpha cerrada (como staging y
  // producción; el Worker local tiene el registro abierto y la regla del
  // servidor la cubren sus pruebas de integración).
  const ctxNueva = await browser.newContext();
  const nueva = await ctxNueva.newPage();
  await useOwnIp(nueva);
  await nueva.route('**/api/v1/config', async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as { data: Record<string, unknown> };
    body.data.registration = 'invite';
    await route.fulfill({ response: res, json: body });
  });
  await turnstileDePrueba(nueva);
  await nueva.goto(enlace);
  await expect(nueva.getByRole('heading', { name: 'Crea tu cuenta' })).toBeVisible();
  const campo = nueva.getByLabel('Código de invitación');
  await expect(campo).toHaveValue(codigo);
  // El código ya está en el campo: fuera de la barra de direcciones.
  await expect(nueva).toHaveURL(/\/register$/);

  const tag = Date.now().toString(36);
  await nueva.getByLabel('Correo').fill(`e2e.inv.${tag}@example.com`);
  await nueva.getByLabel('Nombre de usuario').fill(`e2e_inv_${tag}`.slice(0, 20));
  await nueva.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await nueva.getByText('Tengo 16 años o más').click();

  // Sin código no se manda nada.
  await campo.fill('');
  await nueva.getByRole('button', { name: 'Crear mi cuenta' }).click();
  await expect(nueva.getByText('Escribe tu código de invitación.')).toBeVisible();

  await campo.fill(codigo.toLowerCase());
  const registro = nueva.waitForRequest((r) => r.url().endsWith('/api/v1/auth/register'));
  await nueva.getByRole('button', { name: 'Crear mi cuenta' }).click();
  expect((await registro).postDataJSON()).toMatchObject({ invitationCode: codigo.toLowerCase() });
  await expect(nueva.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible();

  await Promise.all([ctxCaseta.close(), ctxNueva.close()]);
});

test('las reglas de convivencia se leen sin sesión y la portada las enlaza', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Reglas de convivencia' }).click();
  await expect(page).toHaveURL(/\/reglas$/);
  await expect(page.getByRole('heading', { name: 'Reglas de convivencia' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tus datos' })).toBeVisible();
  await expect(page.getByText('Wous es para mayores de 16 años.')).toBeVisible();
  await page.getByRole('link', { name: 'Volver al inicio' }).click();
  await expect(page).toHaveURL(/\/$/);
});
