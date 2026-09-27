# Runbook · Moderación

Moderación básica de la Fase 7 (ADR-0010). No hay panel: se modera desde la terminal con
`scripts/moderacion/moderar.mts`, que habla con D1 por `wrangler d1 execute`. Hace falta la sesión
de Cloudflare de quien despliega (`wrangler login`) y, en staging o producción, correr fuera del
sandbox (tiene red).

```bash
node scripts/moderacion/moderar.mts <local|staging|production> <orden> [argumentos] [opciones]
```

A quién se nombra: `chr_…` (personaje), `acc_…` (cuenta) o `@usuario`. Toda acción que cambia algo
exige `--motivo "…"` y deja una fila en `audit_log` con el moderador en `metadata_json`
(`--moderador <nombre>`, o `WOUS_MODERADOR`, o el usuario del sistema).

## Revisar

| Orden | Qué hace |
| --- | --- |
| `reportes` | Los últimos 50 reportes abiertos: motivo, a quién, quién reporta y el mensaje. `--todos` incluye los resueltos. |
| `reporte rpt_…` | La evidencia completa: el mensaje reportado, lo que se dijo justo antes y lo último que dijo la persona. |

La evidencia es lo que **la sala** repartió (el cliente solo dice qué mensaje, por su ID). No hay
más chat guardado: la ventana de cada sala dura 10 minutos y se borra al vaciarse.

## Actuar

| Orden | Efecto | En quien está conectado |
| --- | --- | --- |
| `silenciar <persona> <horas> --motivo …` | No puede escribir en el chat (sí caminar y hacer gestos). Hasta 90 días. | Al siguiente mensaje tras la revisión de la sala (≤ 1 min). |
| `quitar-silencio <persona> --motivo …` | Vuelve a escribir. | Igual. |
| `suspender <persona> --motivo …` | Cuenta `SUSPENDED`, sesiones cerradas. No puede entrar («suspendida temporalmente»). | Sale de la sala en ≤ 1 min. |
| `banear <persona> --motivo …` | Cuenta `BANNED`, sesiones cerradas. | Igual. |
| `reactivar <persona> --motivo …` | De `SUSPENDED` a `ACTIVE`. Una cuenta `BANNED` no se reabre así. | Vuelve a entrar con sesión nueva. |
| `descartar rpt_… --motivo …` | El reporte queda `DISMISSED`. | — |

Con `--reporte rpt_…`, `silenciar`, `suspender` y `banear` cierran ese reporte como `ACTIONED` con
la resolución escrita.

## Qué no hace (todavía)

- No hay filtro de palabras ni moderación automática: se decide leyendo la evidencia.
- No se avisa por correo a la persona sancionada ni a quien reportó.
- Los reportes resueltos no se borran solos: la retención se decide antes de la beta pública (§30).
- Bloquear es de cada persona (desde la plaza) y no pasa por aquí.
