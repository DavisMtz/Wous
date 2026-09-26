# ADR-0008 · La sala en tiempo real: estado en attachments, lotes y directorio pegajoso

- **Estado:** aceptado · 2026-09-26
- **Contexto:** §12–§17 piden WebSocket autenticado, Hibernation API, movimiento autoritativo, sin
  bucles permanentes y sin posiciones en D1. Faltaba decidir dónde vive el estado de cada jugador,
  cómo se reparten los estados sin inundar la sala y cómo llega la identidad al Durable Object.

## Decisión

1. **Identidad por cabecera interna.** `GET /ws/world` valida Origin exacto, cookie, cuenta
   `ACTIVE` y personaje; después arma `X-Wous-Identity` (JSON) en una `Request` **nueva** hacia el
   `RoomDO`. Nada de lo que manda el cliente llega tal cual a la sala. El Worker responde con HTTP
   simple (401/403/409/429) porque el navegador no puede leer el status de un upgrade fallido: el
   cliente que no llega a abrir consulta `/auth/session`.
2. **Estado del jugador en el attachment de su socket** (`serializeAttachment`, <1 KB medido; el
   tope del runtime es 2 KB). Sobrevive a la hibernación sin escribir storage. La sala solo guarda
   en storage su mapa e instancia.
3. **Movimiento solo al llegar un input** (§14): se avanza con la intención anterior durante el
   tiempo del servidor transcurrido (tope 150 ms), se resuelve colisión con el mismo
   `@wous/game-core` que predice el cliente y se adopta la intención nueva normalizada. Los payloads
   son objetos estrictos: un `x`/`y` colado invalida el mensaje.
4. **Estados por lotes.** Cada input marca al jugador como «sucio»; un temporizador de
   `NETWORK.stateFlushMs` manda un solo `PLAYER_STATE` con todos los cambios y se apaga. Sin
   movimiento no hay temporizador. Con 35 personas a 12 Hz son ~15 envíos por segundo por persona
   en vez de ~420.
5. **Ping sin despertar.** `setWebSocketAutoResponse` contesta `WS_PING_TEXT` byte a byte. La
   presencia vence (`NETWORK.staleAfterMs`) por limpieza oportunista en cada evento y por una alarma
   que **solo existe mientras hay gente**; al salir el último se borra.
6. **Directorio pegajoso.** `directory:<mapa>` elige la primera instancia bajo el límite suave y abre
   otra cuando todas lo alcanzan; quien ya está en una instancia vuelve a ella (otra pestaña o
   reconexión), y la sala reemplaza su socket viejo (`CONNECTION_REPLACED`) heredando su lugar, sin
   anunciar una salida. La sala rechaza con `ROOM_FULL` al límite duro por si dos asignaciones se
   cruzan.
7. **Capacidad configurable.** `ROOM_CAPACITY` en `@wous/config`; las pruebas la bajan con
   `ROOM_SOFT_LIMIT`/`ROOM_HARD_LIMIT` (bindings que los entornos reales no declaran).

## Alternativas descartadas

- **Bucle de simulación a tasa fija en la sala:** impide hibernar y gasta CPU con la sala quieta.
- **Estado en `ctx.storage` por jugador:** una escritura por input; los attachments ya persisten.
- **Difusión inmediata de cada input:** crece con el cuadrado de la gente en la sala.

## Consecuencias

- **Sesión revocada ≠ socket cerrado.** «Cerrar sesión en todos lados» revoca en D1, pero un socket
  abierto sigue en la sala hasta que se cae o se reconecta (entonces el Worker ya no lo deja
  entrar). Aceptado para la Fase 5; cerrar sockets al revocar se evaluará con la moderación (Fase 7).
- La hibernación real solo se observa desplegado (miniflare implementa la API pero no hiberna). Lo
  comprobable en pruebas es que la sala vacía no deja alarma ni temporizadores.
- Si un jugador suelta la tecla y su último input se pierde, el servidor lo deja donde lo llevó el
  tope de 150 ms: el cliente corrige hacia la posición autoritativa.
- **Pestaña en segundo plano.** Chrome estrangula los temporizadores (uno por minuto tras ~5 min
  oculta); por eso la ventana de presencia es de 120 s y no de 60. Si aun así vence, el socket se
  cierra con 4010 y al volver la persona reaparece en la entrada (el socket viejo ya no hereda lugar).
- **`ROOM_FULL` al reconectar.** El directorio no conoce a quien nunca llegó a entrar y su ocupación
  llega con un instante de atraso; el margen entre límite suave (35) y duro (45) lo vuelve raro, y el
  cliente reintenta con espera creciente.
- **`connect-src 'self'` y `wss:`.** Verificado en Chrome (cero violaciones); Safari lo acepta desde
  la 15.4. Un «Reconectando…» eterno en un Safari viejo sería esto.
