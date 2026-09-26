import type { D1Migration } from 'cloudflare:test';

declare global {
  namespace Cloudflare {
    interface Env {
      /** Migraciones reales de database/migrations, inyectadas solo en pruebas. */
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
