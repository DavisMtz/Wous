# Runbook · Despliegue

Los despliegues se hacen a mano desde la máquina de desarrollo (el CI solo valida).

## Requisitos

- `apps/worker/secrets.staging.json` y `secrets.production.json` (ignorados por git) con:
  `SESSION_PEPPER`, `TOKEN_PEPPER`, `TURNSTILE_SECRET_KEY`, `BREVO_API_KEY`,
  `BREVO_WEBHOOK_SECRET`. Son la fuente de verdad de los secretos: el deploy los sube con
  `--secrets-file` en cada despliegue.
- wrangler autenticado con la cuenta de Cloudflare de Wous.

## Pasos

```bash
pnpm typecheck && pnpm lint && pnpm test   # nada se despliega en rojo (§26)
pnpm deploy:staging                        # build web + migraciones remotas + deploy
curl -s https://wous-staging.logidma.workers.dev/api/v1/health
```

Producción igual con `pnpm deploy:production` y `https://wous.logidma.com/api/v1/health`.
Toda migración D1 pasa primero por staging.

### Sin los archivos de secretos (otra máquina, CI o un token)

Los cinco secretos están en `secrets.required` de `wrangler.jsonc`: un `wrangler deploy --env <entorno>`
**sin** `--secrets-file` los hereda del Worker ya desplegado (no los borra ni los cambia). Con un
token de API en `CLOUDFLARE_API_TOKEN` (más `CLOUDFLARE_ACCOUNT_ID`):

```bash
pnpm --filter @wous/web build
cd apps/worker
npx wrangler d1 migrations apply DB --remote --env <entorno>
npx wrangler deploy --env <entorno>
```

Así se desplegó la Fase 9 (27 sep 2026). Un secreto que NO esté en `secrets.required` sí se
perdería en un deploy sin archivo: todo secreto nuevo va en esa lista.

### Después de desplegar la Fase 9 en un entorno

- `REGISTRATION_MODE` (var) decide si registrarse pide invitación: `invite` en staging y producción,
  `open` en local.
- Nombra a quien atiende la caseta (ver `docs/runbooks/moderacion.md`) y crea las primeras
  invitaciones desde `/caseta`: sin invitación nadie nuevo puede registrarse.

## Recursos por entorno

| Recurso | staging | production |
| --- | --- | --- |
| Worker | `wous-staging` | `wous` |
| D1 | `wous-staging` | `wous-production` |
| R2 | `wous-assets-staging` | `wous-assets-production` |
| Cola / DLQ | `wous-email-staging` / `-dlq-staging` | `wous-email-production` / `-dlq-production` |
| Turnstile | widget «Wous staging» | widget «Wous produccion» |

## Dominio propio

`wous.logidma.com` está declarado en `wrangler.jsonc` (production, `routes` con `custom_domain: true`)
y se ata en cada deploy con la sesión OAuth de `wrangler login`. Con un **token de API** sin permisos de
zona, ese bloque hace fallar el deploy con `Authentication error [code: 10000]`; en ese caso, quitarlo y
atar el dominio una vez con `PUT /accounts/{account_id}/workers/domains`.

## Rotar un secreto

Editar el valor en `secrets.<entorno>.json` y volver a desplegar, o
`wrangler secret bulk secrets.<entorno>.json --env <entorno>` (surte efecto sin desplegar código).
Nunca `wrangler secret put` por tubería: añade un salto de línea al valor.
Rotar `SESSION_PEPPER` cierra todas las sesiones; rotar `TOKEN_PEPPER` invalida los enlaces de
verificación y reset pendientes **y las invitaciones** (no se pueden encontrar ni mostrar).
Las pruebas de carga (`docs/carga/`) necesitan el `SESSION_PEPPER` del entorno para acuñar
sesiones de bots.
