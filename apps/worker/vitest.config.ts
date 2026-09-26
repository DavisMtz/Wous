import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

/** Valores de prueba: largos para contar como configurados, nunca reales. */
const TEST_SECRETS = {
  SESSION_PEPPER: 'test-session-pepper-0123456789abcdef',
  TOKEN_PEPPER: 'test-token-pepper-0123456789abcdef',
  TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
  BREVO_API_KEY: 'test-brevo-api-key-no-real-0123456789',
  BREVO_WEBHOOK_SECRET: 'test-brevo-webhook-secret-0123456789',
};

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(
        path.join(import.meta.dirname, '../../database/migrations'),
      );
      return {
        main: './src/index.ts',
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: { ...TEST_SECRETS, TEST_MIGRATIONS: migrations },
          // Sin consumidor automático: cada prueba entrega el outbox a mano y en orden.
          queueConsumers: {},
        },
      };
    }),
  ],
  test: {
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
  },
});
