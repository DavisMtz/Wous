# Runbook · Moderación

Se modera desde **la caseta** (`/caseta`, Fase 9, ADR-0012) o desde la terminal con
`scripts/moderacion/moderar.mts` (Fase 7, ADR-0010). La caseta es lo del día a día (funciona desde
el teléfono y aplica en la sala en el acto); el script es la **única** forma de dar o quitar el rol
de la caseta y sirve si la web no está disponible.

## Quién atiende la caseta

El rol vive en la tabla `staff` y solo lo da el script: la web no tiene ninguna forma de subir
privilegios. Hace falta la sesión de Cloudflare de quien despliega (`wrangler login`, o
`CLOUDFLARE_API_TOKEN`) y, en staging o producción, correr fuera del sandbox (tiene red).

```bash
node scripts/moderacion/moderar.mts production dar-caseta @usuario --motivo "Modera la alpha"
node scripts/moderacion/moderar.mts production caseta             # quién la atiende
node scripts/moderacion/moderar.mts production quitar-caseta @usuario --motivo "…"
```

Aplica en la siguiente petición de esa persona (el rol se lee de D1 en cada una). En su casa
aparece el botón **La caseta**. Para cualquier otra persona `/caseta` la regresa a su casa y la API
`/api/v1/admin/*` responde 404, como si no existiera.

## La caseta

Arriba dice en qué entorno estás (**Local**, **Staging** o **Producción**). Cuatro pestañas:

- **Tablero:** gente conectada por sala e instancia, cuentas por estado, actividad de 24 h y 7 días,
  reportes abiertos, correo del día (Brevo gratuito: 300 al día) e invitaciones. Los contadores de
  logs (errores, logins, latencias) están en `docs/runbooks/observabilidad.md`.
- **Reportes:** los abiertos (o todos). Cada uno trae la evidencia que guardó la sala: lo que se dijo
  antes, el mensaje reportado resaltado o lo último que dijo la persona. Desde ahí se **atiende**
  (silenciar, suspender, cerrar la cuenta, cerrar sus sesiones; opcionalmente se dan por atendidos
  los demás reportes abiertos de esa persona) o se **descarta**.
- **Personas:** busca por `@usuario`, nombre del personaje, correo o ID (`acc_…`, `chr_…`). La ficha
  muestra correo, desde cuándo, invitación con la que entró, sesiones, silencio o suspensión
  vigentes, reportes y la **bitácora** (quién hizo qué y por qué).
- **Invitaciones:** crear, copiar el enlace y revocar (ver abajo).

Todo lo que cambia algo pide **motivo** y queda en `audit_log` con quien actuó. Nadie puede
sancionarse a sí mismo ni sancionar a otra persona del staff desde la caseta (primero se le quita
el rol con el script).

| Acción | Efecto | En quien está conectado |
| --- | --- | --- |
| Silenciar (1 h, 1 día, 3 días, 1 semana) | No escribe en el chat; sí camina y hace gestos. | En el acto: la caseta le pide a su sala que revise. |
| Quitar el silencio | Vuelve a escribir. | En el acto. |
| Suspender (1 día … 30 días, o hasta nuevo aviso) | `SUSPENDED` y sesiones cerradas. Al intentar entrar ve «suspendida hasta el …». **Con fecha, se levanta sola** (cron de 5 min o al intentar entrar). | Sale de la sala en el acto. |
| Reactivar | De `SUSPENDED` a `ACTIVE`. | Entra con sesión nueva. |
| Cerrar sus sesiones | Cierra todas sus sesiones (p. ej., le robaron la contraseña). | Sale en el acto; puede volver a entrar. |
| Cerrar la cuenta | `BANNED`, definitivo (la caseta no la reabre). Pide confirmar. | Sale en el acto. |

Si el aviso a la sala falla, la revisión que cada sala hace cada minuto aplica igual.

## Invitaciones (alpha cerrada)

Con `REGISTRATION_MODE=invite` (staging y producción) solo se crea cuenta con un código válido.

1. En **Invitaciones**: para quién es, cuántas cuentas puede abrir (1–50) y cuántos días sirve
   (7, 30 o 90). Sale un código `XXXXX-XXXXX` y el enlace `https://…/register?invitacion=…`.
2. Comparte el enlace: el registro llega con el código puesto. También se puede dictar (se lee sin
   importar mayúsculas, espacios o guiones, y `O`/`I`/`L` cuentan como `0`/`1`).
3. La lista muestra usos, cuentas creadas, vencimiento y quién la hizo; **Revocar** la desactiva
   (lo ya registrado se queda).

El código se guarda cifrado y con HMAC (`TOKEN_PEPPER`): rotar ese secreto invalida las
invitaciones pendientes. Una invitación inexistente, vencida, agotada o revocada responde siempre
el mismo error; un correo que ya tenía cuenta gasta el cupo igual (así no sirve para averiguar
quién está registrado).

## El script

```bash
node scripts/moderacion/moderar.mts <local|staging|production> <orden> [argumentos] [opciones]
```

A quién se nombra: `chr_…`, `acc_…` o `@usuario`. Todo lo que cambia algo exige `--motivo "…"` y
deja fila en `audit_log` con el moderador en `metadata_json` (`--moderador <nombre>`, o
`WOUS_MODERADOR`, o el usuario del sistema).

| Orden | Qué hace |
| --- | --- |
| `reportes [--todos]` | Los últimos 50 reportes abiertos (o todos). |
| `reporte rpt_…` | La evidencia completa de un reporte. |
| `silenciar <persona> <horas> --motivo …` | Silencio de chat hasta 90 días. |
| `quitar-silencio <persona> --motivo …` | Quita el silencio. |
| `suspender <persona> [--horas N] --motivo …` | Suspende; con `--horas`, se levanta sola al vencer. |
| `banear <persona> --motivo …` | Cierra la cuenta. |
| `reactivar <persona> --motivo …` | De `SUSPENDED` a `ACTIVE`. |
| `descartar rpt_… --motivo …` | Reporte `DISMISSED`. |
| `caseta` | Quién atiende la caseta. |
| `dar-caseta <persona> --motivo …` / `quitar-caseta …` | Da o quita el rol. |

Con `--reporte rpt_…`, `silenciar`, `suspender` y `banear` cierran ese reporte como `ACTIONED`.
Desde el script, lo que se decide llega a quien está conectado en la revisión del minuto.

## Qué no hace (todavía)

- No hay filtro de palabras ni moderación automática: se decide leyendo la evidencia.
- No se avisa por correo a la persona sancionada ni a quien reportó (se ve al intentar entrar).
- Los reportes resueltos no se borran solos: la retención se decide antes de la beta pública (§30).
- Bloquear es de cada persona (desde la plaza o su banda) y no pasa por aquí.
