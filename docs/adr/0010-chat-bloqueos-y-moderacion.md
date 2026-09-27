# ADR-0010 · Chat de sala, bloqueos en tabla propia, evidencia desde la sala y revisión de sockets vivos

- **Estado:** aceptado · 2026-09-26
- **Contexto:** la Fase 7 pide chat de sala, globos, flood limitado, saneado, gestos, bloquear,
  reportar y moderación básica (§18, §19). Su DoD: el HTML de usuario no se ejecuta, el flood se
  limita, los bloqueos se respetan y un reporte conserva evidencia mínima útil. Cuatro decisiones
  no estaban resueltas por el plan, y una de ellas se aparta de él.

## Decisión

1. **Los bloqueos viven en su propia tabla `blocks`, no en `friendships`.** El §8 los pone como
   `friendships.status = 'BLOCKED'` con un solo `blocked_by_id` por par. Esa forma no puede
   representar que A bloquee a B **y** B a A, y quitar uno borraría el otro. Además `friendships`
   todavía no existe (llega en la Fase 8). `blocks(blocker_account_id, blocked_account_id,
   created_at)` con llave primaria en los dos: un bloqueo por dirección, idempotente, con tope de
   500 por cuenta. **Reconciliación en la Fase 8:** el bloqueo gana. Crear un bloqueo deja la
   amistad del par en `REMOVED`, y una solicitud entre dos cuentas con bloqueo en cualquier
   dirección se rechaza sin decirle a quien la manda que lo bloquearon.
2. **Bloquear y reportar pasan por la sala (WebSocket), no por HTTP.** La sala es la que sabe
   quién está y qué se dijo: aplica el bloqueo en el acto a todo lo que reparte y arma la
   evidencia sin viajes extra. Mensajes nuevos: `BLOCK_PLAYER`, `UNBLOCK_PLAYER`,
   `REPORT_PLAYER`. Desde la casa solo se lista y se desbloquea por HTTP (`GET /api/v1/blocks`,
   `DELETE /api/v1/blocks/:characterId`); desbloquear así no avisa a ninguna sala (si seguías
   conectado en otra pestaña, el filtro sobra hasta que vuelves a entrar: sobra, nunca falta). El
   `POST /api/v1/users/:id/block` del §20 llega con la lista de amigos de la Fase 8.
3. **El filtro de bloqueos es del servidor y por destinatario.** Chat y gestos no cruzan un
   bloqueo en ninguna dirección; la persona bloqueada nunca se entera (no recibe nada que lo
   delate). Presencia y movimiento sí se reparten: ocultar avatares rompería el espacio compartido
   y las colisiones. La sala guarda en memoria y en una clave de storage **solo las aristas entre
   gente presente**; quien entra consulta en D1 sus bloqueos con los presentes (una consulta
   indexada, y ninguna si la sala está vacía), y se anota como «entrando» antes de consultar para
   que dos entradas simultáneas no se pierdan el bloqueo entre ellas.
4. **La evidencia de un reporte sale de la ventana reciente de la sala, nunca del cliente.** El
   cliente manda `messageId` (y un motivo de un catálogo cerrado); un `text` en el payload invalida
   el mensaje. La ventana (60 mensajes o 10 minutos) vive en el **storage de la sala**, no en
   memoria: la sala hiberna a los segundos de silencio y quien reporta tarda más que eso en
   decidirse. Se borra al vaciarse la sala. A D1 solo llega lo reportado: el mensaje, lo último de
   la persona reportada si no se eligió mensaje, y hasta 10 mensajes de contexto de los 2 minutos
   anteriores (§18, §30). Un `messageId` de otra persona es un cliente alterado: falta y rechazo.
   El mismo reportante no duplica un reporte de la misma persona en 10 minutos.
5. **Moderación sin panel ni endpoint con secreto.** Un script (`scripts/moderacion/`) sobre
   `wrangler d1 execute` lista reportes, muestra la evidencia y aplica silencio
   (`accounts.chat_muted_until`), suspensión, cierre o descarte, siempre con fila en `audit_log`.
   Moderar exige la sesión de Cloudflare de quien despliega: no hay superficie nueva que atacar.
6. **Los sockets abiertos se revisan cada minuto.** Antes, el handshake exigía cuenta ACTIVE y
   sesión válida, pero un socket abierto no se volvía a mirar: suspender o «cerrar sesión en todos
   lados» no sacaba a nadie hasta que reconectaba. La alarma de la sala (que ya existe mientras
   hay gente) hace una consulta por sala con los presentes (estado de la cuenta, sesión no
   revocada ni vencida y silencio) y saca con `SESSION_ENDED` a quien ya no puede estar. Un
   silencio nuevo aplica al siguiente mensaje.

## Alternativas descartadas

- **Bloqueos en `friendships`** (el §8 tal cual): no representa bloqueos mutuos y ata la Fase 7
  a la 8.
- **Filtrar en el cliente:** el contenido llegaría igual al navegador de quien bloqueó; un
  cliente modificado lo leería. El DoD pide que el bloqueo se respete, no que se esconda.
- **La lista completa de bloqueos en la cabecera de identidad:** hasta cientos de IDs por
  persona en cada entrada, casi siempre de gente que no está en la sala.
- **Guardar todo el chat en D1:** el §30 lo desaconseja y el reporte solo necesita un pedazo.
- **La ventana reciente solo en memoria:** se pierde al hibernar; justo cuando alguien decide
  reportar, la sala ya olvidó el mensaje.
- **Un endpoint de moderación protegido con un secreto:** otra llave que filtrar y otra ruta que
  vigilar, para una alpha que modera una sola persona.

## Consecuencias

- Una consulta a D1 al entrar a una sala con gente (bloqueos) y una por sala y minuto con gente
  (revisión). Ninguna por mensaje.
- Cada mensaje de chat escribe una clave en el storage de la sala (sin esperar confirmación: el
  reparto no se retrasa) y borra la que sale de la ventana.
- Suspender, banear, silenciar o cerrar sesión en todos lados tarda **hasta un minuto** en
  alcanzar a quien ya está conectado.
- El chat de quien entra empieza en blanco: no se reparte historial al llegar.
- Sin filtro de palabras: el §18 no lo pide. Queda pendiente de decidir antes de la beta pública,
  igual que la retención de los reportes resueltos (§30).
- La identidad de la sala viaja codificada en ASCII (`encodeIdentity`): los nombres con acentos
  ya no dependen de una tolerancia del runtime con cabeceras UTF-8.
