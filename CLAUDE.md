# Wous — guía para Claude

Fuente de verdad técnica: **`PLAN_CONSTRUCCION_WOUS.md`**. Léelo antes de cambiar arquitectura.
Si una tarea exige cambiar una decisión estructural: detente, escribe un ADR en `docs/adr/` y no
cambies la arquitectura en silencio (§38).

## Estado de las fases

| Fase | Estado |
| --- | --- |
| 0 · Bootstrap del monorepo | ✅ hecha |
| 1 · Infra Cloudflare y D1 | ⏳ |
| 2 · Registro, login, Brevo | ⏳ |
| 3 · Creación de personaje | ⏳ |
| 4 · Phaser + InputManager | ⏳ |
| 5 · Realtime / RoomDO | ⏳ |
| 6 · Portales, Café y reconexión | ⏳ |
| 7 · Chat, emotes y seguridad social | ⏳ |
| 8 · Amigos + correo social | ⏳ |

No se empieza una fase sin cumplir el Definition of Done de la anterior (§1.15).

## Comandos

```bash
pnpm install          # pnpm 12; solo esbuild y workerd pueden correr scripts (allowBuilds)
pnpm dev              # Worker en :8787 + Vite en :5173 (Vite reenvía /api y /ws)
pnpm typecheck        # regenera worker-configuration.d.ts y corre tsc en todo
pnpm lint             # Biome (lint + formato); `pnpm exec biome check --write .` corrige
pnpm test             # unidad + integración (el Worker corre dentro de workerd)
pnpm test:e2e         # Playwright con el Chrome instalado
pnpm build            # web → apps/web/dist, luego dry-run del Worker
pnpm deploy:staging   # migraciones remotas + deploy de wous-staging
```

## Reglas que no se negocian (resumen de §1 y §36)

- El servidor es autoritativo: el cliente manda intención, nunca posición final, precio, saldo,
  rol, tiempo ni recompensa.
- Validación runtime con los esquemas de `@wous/contracts` en ambos lados.
- D1 solo cambia por migración en `database/migrations/` (forward-only).
- Errores con códigos estables; el frontend decide por `code`, nunca por el texto.
- Brevo nunca en el camino de la petición: outbox en D1 → `EMAIL_QUEUE` → consumidor.
- Nada de secretos, tokens ni cookies en logs, en el repo (es **público**) ni en `localStorage`.
- Tiempo en epoch **ms**; IDs `<prefijo>_<ULID>` (ADR-0004).
- La UI móvil no depende de hover; el juego solo recibe `GameInput` normalizado.

## Secretos

Viven en `apps/worker/secrets.*.json` y `.dev.vars` (ignorados). Se suben con
`wrangler secret bulk <archivo> --env <entorno>`; **nunca** `secret put` por tubería (mete un salto
de línea en el valor). Antes de cada commit: `git status` sin ningún archivo de secretos.

## Trampas del entorno (Windows, sin admin)

- Node portable en `C:\Users\seguimientos\.local\node`; pnpm instalado ahí.
- Toda orden con red (install, wrangler remoto) necesita el sandbox desactivado.
- El dominio `wous.logidma.com` NO se declara en `wrangler.jsonc` (`routes` rompe el deploy con
  `Authentication error [10000]`); se ata una vez con `PUT /accounts/{id}/workers/domains`.
- Heredocs largos en Bash se truncan: los archivos se escriben con la herramienta de escritura.
