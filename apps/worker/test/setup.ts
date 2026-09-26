import { applyD1Migrations, reset } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { afterAll } from 'vitest';

// Cada archivo de pruebas arranca con D1 vacía y aplica las migraciones reales:
// así «las migraciones aplican desde DB vacía» se comprueba en cada corrida.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

// Las alarmas de limpieza del RateLimitDO (ventanas de 15 min a 1 h) dejaban
// vivo el runtime de pruebas en el CI hasta que disparaban. Al terminar cada
// archivo se borra todo el almacenamiento, alarmas incluidas.
afterAll(async () => {
  await reset();
});
