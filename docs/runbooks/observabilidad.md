# Runbook · Observabilidad

Fase 9 (§24, ADR-0012). Tres lugares, según la pregunta:

| Pregunta | Dónde |
| --- | --- |
| ¿Quién está ahora, cuántas cuentas, reportes, correo, invitaciones? | La caseta → **Tablero** (`/caseta`). Lee D1 y los directorios de sala. |
| ¿Qué pasó en las últimas horas: errores, logins, conexiones, latencias? | `scripts/observabilidad/tablero.mts` (logs + analíticas de Cloudflare). |
| ¿Está vivo? | `GET /api/v1/health` (D1, R2, DOs, cola, correo y secretos, sin revelar valores). |

## El script

```bash
CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… \
  node scripts/observabilidad/tablero.mts <staging|production> [--horas 24]
```

Solo lee. El token necesita «Workers Observability: Read» y «Account Analytics: Read». Workers
Logs guarda 7 días (3 en el plan gratuito): `--horas` va de 1 a 168. Imprime:

1. **Worker (analíticas):** peticiones, errores y CPU p50/p99 por resultado. `clientDisconnected`
   y `responseStreamDisconnected` son WebSockets que se cerraron: normales.
2. **HTTP por ruta:** cuántas, mediana, p95 y p99 de `durationMs` (logs `http.request`) y el
   conteo por código de respuesta.
3. **Durable Objects:** peticiones (cada mensaje de WebSocket es una), errores y CPU. Un socket
   que se cierra cuenta como «error» del DO con `clientDisconnected`: es normal.
4. **D1:** consultas y filas leídas y escritas.
5. **Eventos:** los contadores del §24 a partir de los eventos estructurados (tabla abajo).
6. **Últimos errores y avisos**, con sus campos (sin secretos: `lib/log.ts` los redacta).

## Eventos y qué hacer

| Contador | Evento | Normal | Si se dispara |
| --- | --- | --- | --- |
| registros | `auth.registered` | — | — |
| invitaciones rechazadas | `auth.invitation_rejected` (warn) | alguno suelto | Muchos seguidos: alguien prueba códigos. El límite por IP y Turnstile ya frenan; revisa en la caseta si un código se filtró y revócalo. |
| correos que no salieron / a la DLQ | `email.delivery_failed`, `email.dead_lettered` (error) | 0 | Ver `docs/runbooks/correo.md` (Brevo, cupo diario, DLQ). |
| logins fallidos | `auth.login_failed` | pocos | Muchos para una cuenta: el límite por cuenta la protege; avisa a la persona. |
| conexiones al mundo / salidas | `world.connect`, `room.left` | parejos | Muchas conexiones y pocas salidas por minuto: pestañas en bucle o reconexiones (mira `world.rate_limited`). |
| caídas | `room.dropped` | algunas (redes móviles) | Muchas a la vez: problema de red o del runtime; mira los DO. |
| cierres por faltas | `room.policy_close` (warn) | 0–pocos | Varios de la misma persona en minutos: un cliente que manda de más. Así se encontró el joystick del iPad (27 sep, `efaaeb0`). |
| flood de chat | `room.chat_flood` (warn) | pocos | Muchos de la misma persona: revisa en la caseta y silencia si hace falta. |
| cruces fallidos | `room.portal_failed`, `room.arrival_failed` | 0 | D1 o el directorio no contestan: revisa `/api/v1/health` y los DO. |
| reportes | `room.report` | — | Se atienden en la caseta → **Reportes**. |
| sanciones desde la caseta | `admin.sanction` | — | Cada una está en la bitácora de la persona. |
| suspensiones levantadas | `moderation.suspension_lifted` | — | El cron de 5 min o el login levantaron una suspensión con fin. |
| Origin rechazado | `world.origin_rejected`, `http.origin_rejected` (warn) | alguno | Un sitio ajeno intentando usar Wous desde el navegador de alguien: nada que hacer si solo rebota. |

Otros eventos útiles al investigar: `http.unhandled_error` (error: un 500 con su `requestId`),
`room.review_failed` (la revisión del minuto no pudo leer D1), `admin.recheck_failed` (la caseta no
pudo avisar a una sala; la revisión del minuto lo cubre), `turnstile.*` (verificación caída o
rechazada) y `health.dependency_down`.

## Las mismas consultas en el panel de Cloudflare

Workers & Pages → `wous` (o `wous-staging`) → **Observability** → Query builder:

- **Errores:** filtro `$metadata.level = error`, vista *Events*.
- **Contadores:** cálculo *Count*, agrupar por `event`. Ojo: el panel y la API devuelven 10 grupos
  si no se pide más (el script pide 200).
- **Latencia por ruta:** filtro `event = http.request`; cálculos *Median*, *P95* y *P99* de
  `durationMs`; agrupar por `path`.
- **Una petición concreta:** filtro `requestId = req_…` (el `X-Request-Id` de la respuesta o el
  `requestId` del sobre de error que te mande quien reporta el problema).
- **Una persona en la sala:** filtro `characterId = chr_…`.

## Referencias medidas

- Producción, semana del 20 al 27 de septiembre de 2026: 0 errores del Worker; `/ws/world` p50
  295 ms y p95 983 ms del lado del servidor; login p50 380 ms (Argon2 + Turnstile); 5 cierres por
  faltas de un iPad (corregido en `efaaeb0`).
- Carga en staging: `docs/carga/2026-09-27-staging.md`.
