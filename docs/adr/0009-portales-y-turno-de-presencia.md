# ADR-0009 · Portales: la sala la decide D1 y un turno de presencia impide estar en dos

- **Estado:** aceptado · 2026-09-26
- **Contexto:** la Fase 6 pide cruzar de la Plaza al Café (§16), reconexión con snapshot fresco
  (§17) y un DoD estricto: no se entra al Café mandando un `roomId` y un personaje **nunca** queda
  activo en dos salas. Un WebSocket vive atado a un Durable Object: la sala A no puede pasarle el
  socket a la sala B. Hacía falta decidir quién guarda «dónde está» cada personaje y cómo se evita
  que dos pestañas crucen a destiempo y terminen una en cada sala.

## Decisión

1. **Cruzar = cerrar y volver a entrar.** El cliente manda `ENTER_PORTAL { portalId }` (objeto
   estricto: ni sala, ni instancia, ni punto de llegada). La sala valida que el portal exista en su
   mapa, que lo alcances desde donde el servidor te tiene **ahora** (último punto más lo que avanzó
   la intención vigente, con el tope de 150 ms) y que no vayas ya en camino. Si acepta, manda
   `ROOM_TRANSFER` (solo para que la cortina diga «El Café»), cierra con `4011 TRANSFER` y el
   cliente vuelve a abrir `/ws/world` al instante, con la misma URL.
2. **La sala lógica vive en D1.** `characters.last_room_id` (ya en §8) guarda el mapa. `/ws/world`
   lo lee y **no lee nada de la petición**: query, cabeceras y cuerpo no cambian el destino. Solo
   una sala, al validar un portal, lo cambia.
3. **Turno de presencia (`presence_epoch`, migración 0003).** Cada conexión al mundo toma turno con
   `UPDATE … SET presence_epoch = presence_epoch + 1 … RETURNING presence_epoch, last_room_id`: el
   turno y la sala salen de la misma sentencia atómica. El socket lleva su turno en el attachment y
   el cruce se confirma con `UPDATE … WHERE id = ? AND presence_epoch = ?`. Si otra conexión tomó
   turno en medio, el cruce no aplica (0 filas) y ese socket se retira con `REPLACED`. Una conexión
   con turno más viejo que la que ya está en la sala se rechaza al llegar.
4. **El punto de llegada lo guarda el directorio de destino.** Tras confirmar en D1, la sala de
   origen anota en `directory:<destino>` «espera a este personaje en `desde-plaza` hasta T» (30 s).
   La entrada lo consume una vez. Sin anotación (vencida o fallida) apareces en el punto por defecto.
5. **Ventana de gracia (§17) en storage.** Un cierre sin despedida (1006, 1011…) deja el lugar
   guardado 30 s en `ctx.storage` (`ghost:<id>`): los demás te ven quieto y marcado («sin señal»)
   y, si vuelves a tiempo, sigues donde estabas. «Salir» (1000), cerrar la pestaña (1001) y 1005 se
   van en el acto. El lugar guardado ocupa cupo, entra en el snapshot con `away: true` y lo barre la
   misma alarma, que ahora vive mientras haya gente conectada **o** lugares guardados.

## Alternativas descartadas

- **Leer solo `last_room_id` sin turno:** deja una carrera real. La pestaña 2 lee «plaza», la 1
  cruza al Café, la 2 llega a la Plaza vacía de la 1 y la 1 reconecta al Café: una persona en dos
  salas. La ventana es corta (lectura de D1 → fetch al DO) pero es justo lo que el DoD prohíbe.
- **Boleto firmado en la URL de reconexión:** el cliente cargaría el destino (aunque firmado), haría
  falta un secreto más y seguiría sin resolver dos pestañas. El destino ya está en D1.
- **Un Durable Object por personaje:** coherencia fuerte, pero es un objeto nuevo por persona para
  guardar un campo que el plan ya pone en `characters`. Se reconsidera con presencia avanzada (§28).
- **Guardar el lugar de la caída en memoria:** se pierde al hibernar y nadie anunciaría nunca la
  salida (un fantasma para siempre).

## Consecuencias

- Una escritura en D1 por conexión (por PK; la cuenta ya limita 30 conexiones por minuto) y otra
  por cruce. Nunca por movimiento.
- **Cerrar o recargar la página** llega con cierre de despedida (verificado en local con
  Playwright: la sala anuncia la salida en el acto): al volver entras a tu sala en su punto de
  llegada, no donde estabas. Solo una caída de red conserva la posición.
- En desarrollo, el `StrictMode` de React monta dos veces: la primera conexión se aborta (1006),
  deja lugar guardado y la segunda lo hereda al instante. No se ve duplicado.
- El mapa del Café pasó a la versión 2. Un cliente con el mapa en otra versión que la del snapshot
  se detiene con `UPDATE_REQUIRED` en vez de caminar sobre otra colisión.
- Si el directorio de destino falla al anotar la llegada, el cruce sigue (D1 ya lo confirmó) y se
  aparece en el punto por defecto; se registra `room.arrival_failed`.
