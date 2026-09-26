import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';

// Cada archivo de pruebas arranca con D1 vacía y aplica las migraciones reales:
// así «las migraciones aplican desde DB vacía» se comprueba en cada corrida.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
