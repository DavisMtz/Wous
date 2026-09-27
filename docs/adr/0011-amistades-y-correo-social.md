# ADR-0011 · Amistades: una fila por par con vueltas, solicitudes en la sombra y avisos por correo

- **Estado:** aceptado · 2026-09-27
- **Contexto:** la Fase 8 pide solicitar, aceptar, rechazar y quitar amistades, preferencias de
  correo, los correos FRIEND_REQUEST y FRIEND_ACCEPTED y anti-spam (§20, §27). Su DoD: la relación
  no se duplica, reintentar la misma solicitud no genera más correos y apagar la preferencia impide
  el correo social pero no los de seguridad. El §8 describe `friendships` con los estados
  `BLOCKED` y `blocked_by_id`, pero el ADR-0010 ya sacó los bloqueos a su propia tabla y fijó que
  **el bloqueo gana**. Hacían falta decisiones que el plan no toma.

## Decisión

1. **Una fila por par de cuentas, en orden canónico.** `friendships(account_low, account_high)`
   con UNIQUE: A→B y B→A son el mismo par. `requester_id` y `addressee_id` dicen quién pidió en la
   vuelta actual. Estados: `PENDING`, `ACCEPTED` y `REMOVED`; sin `BLOCKED` ni `blocked_by_id`
   (los bloqueos viven en `blocks`). `ended_reason` (`REJECTED`, `CANCELLED`, `REMOVED`,
   `BLOCKED`) dice cómo terminó. La amistad es entre cuentas; hacia fuera siempre se nombra al
   personaje (MVP: uno por cuenta).
2. **Vueltas para el correo.** Volver a pedir después de un `REMOVED` reutiliza la fila y sube
   `round`. La clave de deduplicación del correo lleva la vuelta:
   `friend-request:<frn>:<vuelta>` y `friend-accepted:<frn>:<vuelta>`. Un doble clic, un reintento
   de red o dos pestañas no cambian la vuelta, así que el índice único del outbox los junta en un
   solo correo. Una solicitud nueva de verdad (otra vuelta) sí avisa. La fila del outbox va en el
   **mismo batch** que el cambio de la amistad y solo se inserta si ese cambio ocurrió
   (`INSERT … SELECT … WHERE EXISTS`).
3. **Solicitud cruzada = aceptar.** Si B le pide a A mientras la de A hacia B sigue pendiente, los
   dos quieren lo mismo: queda aceptada y A recibe FRIEND_ACCEPTED.
4. **Enfriamiento de quien pidió.** Quien mandó la última solicitud del par no puede mandar otra
   hasta 24 h después de que esa vuelta terminó (se la rechazaron, la canceló, se acabó la amistad
   o hubo un bloqueo). La otra persona puede pedir cuando quiera. Además, por cuenta: 20
   solicitudes por hora y 60 acciones sociales cada 10 minutos (RateLimitDO), 500 amistades y 50
   solicitudes salientes pendientes. Los números viven en `@wous/config`.
5. **El bloqueo gana sin delatar a nadie.**
   - Crear un bloqueo (en la sala o por HTTP) termina la relación del par en el mismo batch
     (`REMOVED`, motivo `BLOCKED`).
   - Pedirle amistad a quien te tiene bloqueado **se acepta como enviada** y se guarda con
     `hidden = 1`. Tú la ves pendiente, igual que la de alguien que no contesta; la otra persona
     nunca la ve (ni bloqueada ni después de desbloquear) y no sale correo. Las mismas reglas de
     enfriamiento y topes aplican en los dos caminos, así que la respuesta es idéntica. Si después
     esa persona te pide amistad, la cruzada acepta la tuya: los dos lo quieren.
   - Si el bloqueo es **tuyo**, se te dice que primero desbloquees: es tu propio bloqueo y no
     revela nada.
   - Aceptar exige una solicitud visible y sin bloqueo en ninguna dirección, dentro de la misma
     sentencia (una carrera con un bloqueo no deja una amistad viva). La lista de entrantes vuelve
     a filtrar por bloqueos.
6. **Los IDs de las rutas.** `POST /friends/request { characterId }`, `POST
   /friends/:friendshipId/accept|reject|remove` y `POST /users/:characterId/block`: el `:id` del
   §20 es el **personaje**, porque el ID de cuenta nunca sale del servidor (ni en `PlayerView`).
   `GET /friends` devuelve amigos, entrantes y salientes. `remove` sirve para cancelar tu
   solicitud y para quitar una amistad.
7. **Preferencias.** `GET/POST /api/v1/preferences` exponen solo los dos avisos sociales; el de
   marketing sigue apagado y fuera de la interfaz (§7). Se leen dos veces: al crear la fila del
   outbox (apagada = no hay fila) y al enviar (apagarla después de encolar también detiene el
   correo). Los correos de seguridad no leen preferencias.
8. **El correo social se revisa al salir.** El payload lleva la amistad y su vuelta: si al enviar
   la solicitud ya no está pendiente (se aceptó, se canceló, hubo bloqueo) o la amistad ya no
   sigue, no sale. Solo se envía a cuentas ACTIVE y como mucho 10 avisos sociales por
   destinatario al día, aunque vengan de muchas cuentas: protege su bandeja y el cupo diario de
   Brevo (300 en el plan gratuito).
9. **Bloquear por HTTP llega a la sala.** El ADR-0010 aceptó que desbloquear desde la casa no
   avise a la sala porque ahí el filtro sobra. Bloquear desde la lista de amigos es el caso
   contrario (el filtro faltaría): el endpoint busca la sala de quien bloquea (`last_room_id` + el
   directorio) y le pide aplicar el bloqueo en el acto.

## Alternativas descartadas

- **Una fila por solicitud** (con índice único parcial sobre las vivas): la historia crece sin
  tope y el enfriamiento tendría que buscar la última fila del par.
- **Dedupe solo por amistad** (`friend-request:<frn>:created`, el ejemplo del §7): una solicitud
  legítima meses después no avisaría nunca.
- **Rechazar la solicitud a quien te bloqueó con un error**, o descartarla sin guardarla: la
  respuesta o la lista de salientes delatarían el bloqueo al instante.
- **Buscar gente por nombre de usuario para agregarla:** abre la puerta a encontrar cuentas que no
  conoces. En Wous se conoce a la gente en la plaza; se agrega desde su ficha.
- **Avisar en tiempo real** («X te mandó solicitud») a quien está en otra sala: necesita un canal
  por cuenta que no existe. El correo y la casa cubren el MVP; la presencia de amigos queda para
  después (§28).

## Consecuencias

- Tres códigos HTTP nuevos: `FRIEND_REQUEST_COOLDOWN` (409 con `retryAfterSeconds`),
  `LIMIT_REACHED` (409: amistades, salientes o bloqueos; la interfaz sabe cuál pidió) y
  `BLOCKED_BY_YOU` (409). Aceptar o rechazar algo que ya no está responde `NOT_FOUND`; repetir lo
  que ya pasó responde como la primera vez.
- Una solicitud rechazada desaparece de las salientes de quien la mandó sin aviso: se deduce, como
  en cualquier red social, pero no se distingue de un bloqueo.
- El directorio de salas gana `whereIs` y la sala `applyBlock`, ambos por RPC.
- Un índice nuevo en el outbox, `(account_id, sent_at)`, para contar avisos por destinatario.
- Las solicitudes en la sombra de alguien que te bloqueó siguen pendientes para esa persona hasta
  que las cancela: no caducan solas.
