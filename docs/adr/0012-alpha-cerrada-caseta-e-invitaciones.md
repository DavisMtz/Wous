# ADR-0012 · Alpha cerrada: la caseta, invitaciones, suspensiones con fin y carga medida

- **Estado:** aceptado · 2026-09-27
- **Contexto:** la Fase 9 pide admin mínimo, suspensión/ban, observabilidad, tableros y consultas
  de logs, pruebas de carga, endurecimiento y contenido mínimo coherente (§27), pero no trae
  Definition of Done. Tres hechos del sistema en producción obligan a decidir:
  1. Se modera con `scripts/moderacion/moderar.mts` (ADR-0010, punto 5): exige la sesión de
     Cloudflare y la máquina de quien despliega. En una alpha viva, quien modera tiene que poder
     actuar desde el teléfono, en el momento.
  2. La portada dice «Alpha cerrada», pero cualquiera con un correo puede registrarse. Cada
     registro gasta cupo diario de Brevo (300 en el plan gratuito) y cada cuenta nueva es alguien
     que nadie invitó.
  3. Suspender es indefinido: para levantar una suspensión de tres días hay que acordarse de
     correr `reactivar`. Y aplica en la sala hasta un minuto después.

## Decisión

1. **La caseta: un panel web solo para staff, con el rol en D1.** Tabla nueva
   `staff(account_id, role, granted_at, note)`, con un solo rol (`ADMIN`) por ahora. El rol **solo
   lo da y lo quita el script** (`moderar.mts … dar-caseta | quitar-caseta`): la web no tiene
   ninguna forma de subir privilegios. `/api/v1/admin/*` exige sesión, cuenta `ACTIVE` y rol, y a
   cualquier otra persona le responde `404 NOT_FOUND`, igual que una ruta que no existe. Toda
   acción lleva motivo obligatorio y deja fila en `audit_log` con `actor_account_id` de quien
   actuó (el script sigue escribiendo `NULL` y el nombre del moderador en `metadata_json`).
   La página vive en `/caseta` y se descarga aparte: quien juega no baja su código.
   Esto **reemplaza el punto 5 del ADR-0010** («sin panel»). La superficie nueva se protege con lo
   mismo que cualquier cuenta —cookie `__Host-` HttpOnly `SameSite=Lax`, `Origin` exacto en toda
   escritura, JSON obligatorio— y no con un secreto aparte que se pueda filtrar.
2. **Lo que se decide en la caseta aplica en la sala en el acto.** Tras escribir en D1, la caseta
   busca la sala de la persona (`last_room_id` + `whereIs` del directorio, como el bloqueo por HTTP
   del ADR-0011) y le pide `recheck()`: la sala vuelve a leer de D1 la situación de quien tiene
   conectado —la misma revisión que ya corre cada minuto— y saca o silencia sin esperar. La sala no
   recibe la sanción por RPC, la lee de la fuente de verdad. Si el aviso falla, la revisión del
   minuto sigue siendo la red.
3. **Suspensión con fecha de fin.** `accounts.suspended_until` (epoch ms; `NULL` con `SUSPENDED` =
   indefinida). Al vencer, la cuenta vuelve a `ACTIVE` sola: el cron de cada 5 minutos la levanta
   con fila de auditoría, y el login también la levanta si llega antes que el cron. El login de una
   cuenta suspendida responde `ACCOUNT_SUSPENDED` con `retryAfterSeconds` hasta el fin: solo
   después de verificar la contraseña, así que no delata nada a quien no es dueño. `BANNED` sigue
   siendo definitivo; la caseta no lo reabre.
4. **Alpha cerrada con invitaciones.** Var `REGISTRATION_MODE` por entorno (`open` | `invite`):
   staging y producción en `invite`, local en `open` (desarrollo y E2E no cambian).
   - Tabla `invitations`: código de 10 caracteres Crockford (50 bits) mostrado como `XXXXX-XXXXX`,
     usos máximos, vencimiento opcional y revocación. En D1 el código nunca está en claro:
     `code_hash` (HMAC con `TOKEN_PEPPER`, como los tokens del ADR-0006) para encontrarlo y
     `code_enc` (AES-GCM con llave derivada del mismo pepper) para que la caseta pueda volver a
     mostrarlo y compartir el enlace `/register?invitacion=…`.
   - El registro valida todo lo demás primero (Turnstile, límites, condiciones, contraseña,
     nombre) y luego **gasta el cupo con un solo `UPDATE … WHERE uses < max_uses … RETURNING`**,
     atómico ante dos registros a la vez. Se gasta **antes** de mirar si el correo ya existe: un
     correo registrado consume la invitación igual y la respuesta es la misma, así una invitación
     no sirve para enumerar cuentas. Si el alta pierde una carrera de nombre, el cupo se devuelve.
   - `accounts.invitation_id` dice con qué invitación entró cada quien.
   - Código nuevo `INVITATION_INVALID` (400, campo `invitationCode`), con el mismo mensaje para una
     invitación inexistente, vencida, agotada o revocada.
5. **Tablero en la caseta; los contadores de logs, por script.** La caseta muestra lo que vive en
   D1 y en los directorios de sala: gente conectada por sala e instancia, cuentas por estado,
   actividad de 24 h y 7 días, moderación, correo e invitaciones. Los contadores del §24 que viven
   en los logs (logins, conexiones, cierres por política, flood, errores, latencias por ruta) se
   consultan con `scripts/observabilidad/tablero.mts`, que usa la API de Workers Observability y
   GraphQL; `docs/runbooks/observabilidad.md` documenta las mismas consultas para el panel de
   Cloudflare. No se agrega Analytics Engine ni ningún binding.
6. **Carga medida en staging con bots sembrados.** `scripts/carga/carga.mts` crea cuentas
   `carga_###` ya `ACTIVE`, con personaje, directamente en D1 (con `wrangler d1 execute`) y les
   acuña sesiones con el `SESSION_PEPPER` del entorno. **Nunca corre contra producción.** Los bots
   caminan con la cadencia real del cliente, hablan y hacen gestos, y miden input→broadcast (su
   propio `seq` de vuelta en `PLAYER_STATE`), el RTT del ping, mensajes y bytes por persona,
   reconexiones y errores; la CPU y duración del Durable Object y el consumo de D1 salen de
   GraphQL para la ventana de cada corrida. Sin endpoint nuevo: sembrar exige las credenciales de
   Cloudflare y el pepper, lo mismo que moderar por script. El prefijo `carga_` queda reservado.
7. **Endurecimiento.** HSTS y `Cross-Origin-Opener-Policy` también en el HTML (antes solo en la
   API); límite de acciones por persona en la caseta; el prefijo `carga_` reservado; errores con
   código estable en todo lo nuevo.

## Definition of Done de la Fase 9

- Solo quien tiene rol entra a la caseta; para el resto la API no existe (404).
- Silenciar, suspender o cerrar una cuenta desde la caseta aplica en su sala en el acto (y, como
  red, en menos de un minuto). Una suspensión con fin se levanta sola.
- Sin invitación válida no se crea cuenta en staging ni en producción, y una invitación no
  permite averiguar si un correo está registrado.
- Toda acción de la caseta queda en `audit_log` con quién, qué, a quién y por qué.
- Carga medida en staging —10, 25 y 45 personas en una sala, y varias instancias a la vez— con
  p95 de input→broadcast, CPU del DO, mensajes por persona, reconexiones, errores y D1, anotada en
  `docs/carga/`.
- Las consultas de observabilidad están escritas y se pueden correr.

## Alternativas descartadas

- **Seguir moderando solo por script:** cumple el ADR-0010 pero no el «admin mínimo» del plan, y
  deja la alpha sin nadie que pueda actuar lejos de la computadora de despliegue.
- **Rol en una columna de `accounts`:** cambiar su `CHECK` más adelante obliga a reconstruir la
  tabla más referenciada de la base. `staff` es chica y se reconstruye sin dolor.
- **Cloudflare Access delante de `/caseta`:** protege bien, pero pide configurar Zero Trust en la
  cuenta y no sabe quién es quién dentro de Wous; la auditoría necesita la cuenta de Wous.
- **Lista de correos permitidos en vez de invitaciones:** obliga a saber de antemano el correo de
  cada persona y no se puede compartir un enlace. `EMAIL_ALLOWLIST` sigue existiendo para otra
  cosa (a quién puede escribir staging).
- **Endpoint de carga protegido con un secreto:** otra llave que filtrar y otra ruta en producción;
  el ADR-0010 ya descartó lo mismo para moderar.
- **Analytics Engine para los contadores:** otro binding y otro costo para datos que los logs
  estructurados ya tienen.

## Consecuencias

- Rotar `TOKEN_PEPPER` invalida también las invitaciones pendientes: no se pueden encontrar ni
  mostrar. Hay que crear otras.
- La web nunca da roles: la primera persona de la caseta en cada entorno se nombra con
  `node scripts/moderacion/moderar.mts <entorno> dar-caseta @usuario --motivo "…"`.
- Un código HTTP nuevo, `INVITATION_INVALID`; `/auth/session` agrega `staffRole` y `/config`,
  `registration`.
- Una sanción desde la caseta cuesta una lectura de D1 y dos RPC (directorio y sala) además de su
  batch; el tablero, una docena de `COUNT` por vista (con índices nuevos por fecha).
- Las cuentas de carga quedan en la D1 de staging y se reutilizan en cada corrida.
- Sigue sin haber correo a la persona sancionada ni retención definida para reportes resueltos:
  ambos se deciden antes de la beta pública (§30).
