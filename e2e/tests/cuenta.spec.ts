import { expect, test } from '@playwright/test';
import { turnstileReady, useOwnIp, waitForMail } from './ayudantes.ts';

/**
 * Flujo completo de cuenta contra el stack local (Worker + Vite): la
 * «verificación controlada» de §25, con el buzón de desarrollo como bandeja.
 */

test('registro, verificación, sesión, reset y vuelta a entrar', async ({
  browser,
  page,
  request,
}, info) => {
  test.setTimeout(180_000);
  await useOwnIp(page);
  const tag = `${Date.now().toString(36)}${info.project.name.slice(0, 1)}`;
  const email = `e2e.${tag}@example.com`;
  const username = `e2e_${tag}`.slice(0, 20);
  const password = 'Tianguis de prueba 2026';
  const newPassword = 'Cafe de la esquina 2027';

  // 1. Registro.
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Crea tu cuenta' })).toBeVisible();
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Nombre de usuario').fill(username);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByText('Tengo 16 años o más').click();
  await turnstileReady(page);
  await page.getByRole('button', { name: 'Crear mi cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  // 2. Sin verificar no se entra.
  const verify = await waitForMail(request, email, 'EMAIL_VERIFY');
  expect(verify.params.verificationUrl).toContain('/verify-email?token=');

  // 3. El enlace no se consume solo: hay que confirmar con el botón.
  await page.goto(verify.params.verificationUrl ?? '');
  await expect(page).toHaveURL(/\/verify-email$/);
  await page.getByRole('button', { name: 'Confirmar mi correo' }).click();
  await expect(page.getByRole('heading', { name: '¡Ya eres del barrio!' })).toBeVisible();
  await page.getByRole('button', { name: 'Armar mi personaje' }).click();

  // 3b. El probador: nombre, un par de piezas y listo (Fase 3).
  await expect(page.getByRole('heading', { name: 'Arma tu personaje' })).toBeVisible();
  await page.getByLabel('Nombre de tu personaje').fill('Ana Lucía');
  await page.getByRole('tab', { name: 'Pelo' }).click();
  await page.getByRole('radio', { name: 'Coleta' }).check();
  await page.getByRole('tab', { name: 'Arriba' }).click();
  await page.getByRole('radio', { name: 'Sudadera' }).check();
  // Lo que no está en el set inicial no se puede elegir.
  await page.getByRole('tab', { name: 'Zapatos' }).click();
  await expect(page.getByRole('radio', { name: 'Botas' })).toBeDisabled();
  await page.getByRole('button', { name: '¡Listo, a la plaza!' }).click();
  await expect(page.getByRole('heading', { name: '¡Qué onda, Ana Lucía!' })).toBeVisible();

  // Recargar conserva el personaje.
  await page.reload();
  await expect(page.getByRole('heading', { name: '¡Qué onda, Ana Lucía!' })).toBeVisible();

  // 4. Cerrar sesión y volver a entrar por nombre de usuario.
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page.getByRole('link', { name: '¡Pásale! Crea tu cuenta' })).toBeVisible();
  await page.goto('/login');
  await page.getByLabel('Correo o nombre de usuario').fill(username);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await turnstileReady(page);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: '¡Qué onda, Ana Lucía!' })).toBeVisible();

  // 5. Desde OTRO navegador (sin sesión): olvidé mi contraseña → enlace → nueva.
  const otro = await browser.newContext();
  const page2 = await otro.newPage();
  await useOwnIp(page2);
  await page2.goto('/forgot-password');
  await page2.getByLabel('Correo').fill(email);
  await turnstileReady(page2);
  await page2.getByRole('button', { name: 'Mandar enlace' }).click();
  await expect(page2.getByText('¡Enviado!')).toBeVisible();
  const reset = await waitForMail(request, email, 'PASSWORD_RESET');
  await page2.goto(reset.params.resetUrl ?? '');
  await page2.getByLabel('Contraseña nueva', { exact: true }).fill(newPassword);
  await page2.getByRole('button', { name: 'Guardar contraseña' }).click();
  await expect(page2.getByRole('heading', { name: 'Contraseña nueva, lista' })).toBeVisible();
  await otro.close();

  // El reset cerró la sesión que seguía abierta en el primer navegador.
  const session = await page.request.get('/api/v1/auth/session');
  expect(session.status()).toBe(401);

  // 6. Entrar con la nueva.
  await page.goto('/login');
  await page.getByLabel('Correo o nombre de usuario').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(newPassword);
  await turnstileReady(page);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: '¡Qué onda, Ana Lucía!' })).toBeVisible();
});

test('credenciales incorrectas muestran el error sin revelar si la cuenta existe', async ({
  page,
}) => {
  await useOwnIp(page);
  await page.goto('/login');
  // Identificador nuevo por corrida: el límite por identificador no debe
  // acumular intentos de corridas anteriores.
  await page
    .getByLabel('Correo o nombre de usuario')
    .fill(`nadie.${Date.now().toString(36)}@example.com`);
  await page.getByLabel('Contraseña', { exact: true }).fill('una contraseña cualquiera');
  await turnstileReady(page);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toContainText('no coinciden');
});
