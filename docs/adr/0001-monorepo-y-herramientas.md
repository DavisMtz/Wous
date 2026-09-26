# ADR-0001 · Monorepo y herramientas

- **Estado:** aceptado · 2026-09-26
- **Contexto:** §2 y §4 del plan fijan pnpm workspaces, TypeScript estricto, Vitest, Playwright y
  Wrangler, pero dejan abiertas dos elecciones: la herramienta de lint/formato («elegida una sola
  vez») y las versiones concretas.

## Decisión

| Pieza | Elección | Por qué |
| --- | --- | --- |
| Gestor | pnpm 12.6 (`packageManager` fijado) | Workspaces nativos. pnpm 12 bloquea scripts de instalación: solo `esbuild` y `workerd` están permitidos en `allowBuilds`. |
| Lenguaje | TypeScript 6.0 estricto + `noUncheckedIndexedAccess` | TS 7 (nativo) es demasiado nuevo para fijarlo en un monorepo con Vite y Workers. |
| Lint + formato | **Biome 2** | Una sola herramienta y un solo archivo (`biome.json`) en vez de ESLint + Prettier. `noExplicitAny` es error. |
| Pruebas | Vitest **4.1** | `@cloudflare/vitest-pool-workers@0.22` exige `vitest ^4.1`; se usa la misma versión en todo el repo. |
| Pruebas del Worker | `cloudflareTest()` (pool de Workers) | Corren dentro de workerd con D1, DO y colas reales en local. |
| E2E | Playwright con `channel: 'chrome'` | Usa el Chrome instalado: en la red de desarrollo la descarga de navegadores de Playwright puede estar bloqueada. |
| Paquetes internos | exportan `src/*.ts` sin compilar | Vite y Wrangler empaquetan TS directamente; no hay paso de build intermedio que se desincronice. |

`worker-configuration.d.ts` lo genera `wrangler types` y **no se versiona**: el `typecheck` del
Worker lo regenera siempre antes de `tsc`.

## Consecuencias

- `pnpm test` corre unidad + integración; el E2E va aparte (`pnpm test:e2e`), como pide §26.
- Subir vitest a 5 depende de que el pool de Workers lo soporte.
