import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.WOUS_BASE_URL ?? 'http://localhost:5173';
const external = Boolean(process.env.WOUS_BASE_URL);

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  // Cada flujo de cuenta hace Argon2 y Turnstile de verdad: más de dos a la vez
  // satura el Worker local (respuestas de 6 s y conexiones perdidas).
  workers: 2,
  retries: 0,
  // El stack local hace Argon2 real y Vite compila al vuelo: con varias pruebas
  // a la vez, 5 s se quedan cortos para una respuesta sana.
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL,
    // Chrome instalado en la máquina: no depende de descargar navegadores.
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    {
      name: 'movil',
      use: { ...devices['Pixel 7 landscape'], channel: 'chrome' },
    },
  ],
  // Sin URL externa, levanta Worker + Vite locales con `pnpm dev`.
  ...(external
    ? {}
    : {
        webServer: {
          command: 'pnpm --dir .. dev',
          url: `${baseURL}/api/v1/health`,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
});
