# Runbook · Correo (outbox → cola → Brevo)

```
petición ─► D1: notification_outbox (PENDING) ─► EMAIL_QUEUE ─► consumidor ─► Brevo
                     ▲                                  │ reintentos (30 s → 15 min)
                     └── barrido cada 5 min ◄───────────┘ 5 intentos → EMAIL_DLQ → FAILED
```

Brevo nunca está en el camino de la petición: si Brevo o la cola caen, la fila queda en D1 y el
barrido programado (`*/5 * * * *`) la vuelve a encolar.

## Estados de `notification_outbox`

| Estado | Significa |
| --- | --- |
| `PENDING` | Guardada; aún no llega a la cola (o la cola falló). El barrido la rescata a los 2 min. |
| `QUEUED` | En la cola, o esperando un reintento tras un fallo transitorio (`last_error` lo dice). |
| `PROCESSING` | El consumidor la tomó. Si se queda así, la cola la reentrega. |
| `SENT` | Brevo la aceptó (`provider_message_id`). El token cifrado ya se borró. |
| `FAILED` | Permanente o agotó reintentos. Ver `last_error`. |

## 1. Encontrar los fallidos

```bash
cd apps/worker
npx wrangler d1 execute DB --remote --env production --command \
  "SELECT id, type, attempts, last_error, created_at FROM notification_outbox
   WHERE status = 'FAILED' ORDER BY created_at DESC LIMIT 50"
```

`last_error` típicos:

| Error | Causa y arreglo |
| --- | --- |
| `Brevo 401` | La llave caducó o se revocó. Probar con `curl -H "api-key: …" https://api.brevo.com/v3/account`; rotar en `secrets.<env>.json` y `wrangler secret bulk`. `secret list` solo dice que existe, no que funcione. |
| `Brevo 400` | Plantilla o parámetros inválidos. Revisar `BREVO_TEMPLATE_*` en `wrangler.jsonc` y `node scripts/correo/plantillas.mjs --subir`. |
| `Sin plantilla de Brevo para …` | Falta el ID en `vars`. |
| `correo marcado como no entregable` | Rebote duro o bloqueo reportado por el webhook. No reintentar: pedir otro correo a la persona. |
| `destinatario fuera de la lista permitida del entorno` | Solo si un entorno declara `EMAIL_ALLOWLIST` (hoy vacía en todos: se envía a cualquier dirección). |
| `token ilegible (¿rotó TOKEN_PEPPER?)` | Se rotó el pepper: la persona debe pedir otro enlace. |
| `agotó reintentos (DLQ)` | Cinco fallos transitorios seguidos: mirar el `last_error` anterior en la misma celda. |

## 2. Reenviar (solo si tiene sentido)

Los enlaces de verificación y reset caducan (30 y 20 min) y su token cifrado se borra al fallar:
**no se reenvían**; la persona pide otro desde la web. Solo se reenvían correos sin token
(bienvenida, contraseña cambiada, amistad) una vez corregida la causa:

```bash
npx wrangler d1 execute DB --remote --env production --command \
  "UPDATE notification_outbox SET status = 'PENDING', attempts = 0, last_error = NULL,
     available_at = 0 WHERE id = 'obx_…' AND secret_enc IS NULL"
```

El siguiente barrido (≤ 5 min) lo encola.

## 3. ¿Llegó el correo?

Mirar los eventos de Brevo, no la bandeja: `GET https://api.brevo.com/v3/smtp/statistics/events?limit=20&sort=desc&email=<destino>`
(`requests` → `delivered` / `softBounces` / `blocked`). `/v3/smtp/emails` tarda minutos en indexar.
Los eventos también quedan en `email_delivery_events` vía el webhook.

## Configuración

- Remitente `Wous <wous@logidma.com>` (dominio `logidma.com` autenticado en Brevo).
- Plantillas: fuente en `scripts/correo/plantillas.mjs`, HTML generado en
  `apps/worker/email-templates/`; se suben con `node scripts/correo/plantillas.mjs --subir`.
- Webhooks transaccionales (uno por entorno) con `Authorization: Bearer <BREVO_WEBHOOK_SECRET>`.
- Plan gratuito de Brevo: 300 correos al día para toda la cuenta.
