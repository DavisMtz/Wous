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

## Recursos por entorno

| Recurso | staging | production |
| --- | --- | --- |
| Worker | `wous-staging` | `wous` |
| D1 | `wous-staging` | `wous-production` |
| R2 | `wous-assets-staging` | `wous-assets-production` |
| Cola / DLQ | `wous-email-staging` / `-dlq-staging` | `wous-email-production` / `-dlq-production` |
| Turnstile | widget «Wous staging» | widget «Wous produccion» |

## Dominio propio

`wous.logidma.com` NO va en `wrangler.jsonc`: un bloque `routes` hace fallar el deploy con
`Authentication error [code: 10000]`. Se ata una sola vez con
`PUT /accounts/{account_id}/workers/domains` y el vínculo sobrevive a los despliegues.

## Rotar un secreto

Editar el valor en `secrets.<entorno>.json` y volver a desplegar, o
`wrangler secret bulk secrets.<entorno>.json --env <entorno>` (surte efecto sin desplegar código).
Nunca `wrangler secret put` por tubería: añade un salto de línea al valor.
Rotar `SESSION_PEPPER` cierra todas las sesiones; rotar `TOKEN_PEPPER` invalida los enlaces de
verificación y reset pendientes.
