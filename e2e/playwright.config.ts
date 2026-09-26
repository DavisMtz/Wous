import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.WOUS_BASE_URL ?? 'http://localhost:5173';
const external = Boolean(process.env.WOUS_BASE_URL);

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
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
