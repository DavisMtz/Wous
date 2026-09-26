# Wous — Plan maestro de construcción

> Estado: **fuente de verdad técnica inicial**  
> Objetivo: construir Wous de forma incremental con Claude/Claude Code sin improvisar arquitectura, sin confiar en el cliente y sin mezclar la lógica del juego con servicios externos.

---

## 0. Visión del producto

**Wous** es un mundo social online 2D en pixel art con personajes humanos. El usuario podrá registrarse, verificar su correo, crear y personalizar un personaje, entrar a espacios compartidos, caminar, ver a otros jugadores en tiempo real, hablar, usar emotes, agregar amigos y, en fases posteriores, obtener monedas, ropa, jugar minijuegos y decorar espacios propios.

Inspiración de producto: mundo social por salas al estilo de los grandes juegos sociales 2D, pero con identidad propia y personajes humanos.

### MVP jugable

El MVP se considera completo cuando una persona puede:

1. Abrir Wous desde PC o teléfono.
2. Registrarse con correo, nombre de usuario y contraseña.
3. Recibir un correo de verificación mediante **Brevo**.
4. Verificar el correo.
5. Iniciar/cerrar sesión de forma segura.
6. Crear un personaje humano básico.
7. Entrar a una Plaza compartida.
8. Ver a otros jugadores conectados.
9. Caminar con controles adecuados al dispositivo.
10. Ver el movimiento interpolado de los demás.
11. Hablar mediante chat de sala.
12. Usar emotes.
13. Pasar de Plaza a Café mediante un portal validado por servidor.
14. Desconectarse y reconectarse sin corromper el estado.
15. Recibir correos de seguridad y notificaciones sociales permitidas.

El MVP **no** necesita todavía tienda, economía, minijuegos, casas, comercio entre jugadores ni decenas de mapas.

---

# 1. Principios no negociables

1. **El servidor es autoritativo.** El cliente solicita acciones; el servidor decide si suceden.
2. **Nunca confiar en precio, saldo, posición final, propiedad de objetos, tiempo, rol o recompensa enviados por el navegador.**
3. **D1 guarda la verdad persistente.**
4. **Durable Objects guardan y coordinan el estado vivo de las salas.**
5. **R2 guarda recursos pesados y contenido estático del juego cuando corresponda.**
6. **Cloudflare Queues desacopla correo/notificaciones de las peticiones del usuario.**
7. **Brevo solo entrega correo.** Brevo no es la fuente de verdad de cuentas ni preferencias.
8. **Nunca llamar a Brevo dentro del camino crítico de registro, login, compra o gameplay.** Se crea un evento/outbox y se encola.
9. **Una caída de Brevo no debe tirar Wous.**
10. **Autenticación por cookie HttpOnly segura**, no tokens de sesión en `localStorage`.
11. **Contrato compartido y validado** para API y WebSocket.
12. **TypeScript estricto.** No introducir `any` salvo adaptación explícita de una API externa.
13. **Migraciones D1 versionadas y forward-only.**
14. **Toda operación sensible es idempotente cuando sea razonable.**
15. **No implementar una fase posterior para “adelantar” si la fase actual no cumple su Definition of Done.**

---

# 2. Stack inicial

## Cliente

- TypeScript.
- React para UI, autenticación, paneles, inventario y overlays.
- Phaser para mundo 2D, cámara, sprites, animaciones, colisiones visuales e input de gameplay.
- Vite para build.
- Zod para validación de contratos compartidos.

## Backend Cloudflare

- Cloudflare Worker como entrada HTTP, API y router de WebSockets.
- Durable Objects:
  - `ROOM`: una instancia de mundo/sala.
  - `ROOM_DIRECTORY`: asignación de instancias por sala lógica.
  - `RATE_LIMIT`: límites estrictos para endpoints sensibles.
- D1: datos persistentes.
- R2: sprites, mapas visuales, audio y otros assets.
- Cloudflare Queues:
  - `EMAIL_QUEUE`.
  - `EMAIL_DLQ` para mensajes que agotaron reintentos.
- Turnstile para registro, recuperación de contraseña y otros endpoints susceptibles a automatización.
- Brevo Transactional Email para correo.

## Calidad

- pnpm workspaces.
- Vitest para unidad/integración.
- Playwright para E2E.
- Wrangler para desarrollo y despliegue.
- ESLint + Prettier o una herramienta equivalente elegida una sola vez para todo el monorepo.

Usar versiones estables fijadas en el lockfile. No depender de `latest` en CI.

---

# 3. Arquitectura general

```text
Browser
│
├─ React UI
├─ Phaser Game
└─ InputManager
       │
       ├─ Keyboard/Mouse
       ├─ Touch
       └─ Gamepad (preparado, no obligatorio en MVP)
       │
       ▼
Normalized GameInput
       │
       ├──────── HTTPS ────────┐
       │                       │
       └────── WebSocket ──────┤
                               ▼
                     Cloudflare Worker
                       │      │      │
                       │      │      └── Turnstile
                       │      │
                       │      ├──────── D1
                       │      │
                       │      ├──────── R2
                       │      │
                       │      └──────── EMAIL_QUEUE ──► Brevo
                       │
                       ├──────── ROOM_DIRECTORY DO
                       │
                       └──────── ROOM DO
                                  │
                                  ├─ sockets
                                  ├─ posiciones
                                  ├─ chat temporal
                                  ├─ emotes
                                  └─ interacción de sala
```

### Regla de separación

- **Cliente:** experiencia, presentación y predicción visual.
- **Worker HTTP:** autenticación, cuentas, datos persistentes y entrada a servicios.
- **Room Durable Object:** presente de una sala.
- **D1:** verdad durable.
- **R2:** recursos.
- **Queue/Brevo:** entrega asíncrona de notificaciones.

---

# 4. Estructura del repositorio

```text
Wous/
├─ apps/
│  ├─ web/
│  │  ├─ src/
│  │  │  ├─ app/
│  │  │  ├─ auth/
│  │  │  ├─ game/
│  │  │  │  ├─ scenes/
│  │  │  │  ├─ entities/
│  │  │  │  ├─ input/
│  │  │  │  ├─ network/
│  │  │  │  └─ rendering/
│  │  │  ├─ ui/
│  │  │  └─ services/
│  │  └─ public/
│  │
│  └─ worker/
│     └─ src/
│        ├─ index.ts
│        ├─ http/
│        │  ├─ middleware/
│        │  └─ routes/
│        ├─ auth/
│        ├─ accounts/
│        ├─ characters/
│        ├─ notifications/
│        ├─ email/
│        ├─ world/
│        ├─ durable-objects/
│        │  ├─ RoomDO.ts
│        │  ├─ RoomDirectoryDO.ts
│        │  └─ RateLimitDO.ts
│        └─ webhooks/
│
├─ packages/
│  ├─ contracts/
│  │  ├─ http/
│  │  ├─ websocket/
│  │  └─ domain/
│  ├─ game-core/
│  │  ├─ movement/
│  │  ├─ collision/
│  │  ├─ rooms/
│  │  └─ interactions/
│  ├─ world-data/
│  │  ├─ maps/
│  │  ├─ portals/
│  │  └─ validation/
│  └─ config/
│
├─ database/
│  ├─ migrations/
│  └─ seeds/
│
├─ docs/
│  ├─ adr/
│  ├─ protocol/
│  └─ runbooks/
│
├─ PLAN_CONSTRUCCION_WOUS.md
├─ CLAUDE.md
├─ pnpm-workspace.yaml
└─ package.json
```

No crear paquetes por moda. Cada paquete debe tener una razón clara y dependencias unidireccionales.

---

# 5. Entornos

Definir tres entornos desde el inicio:

### local

- D1 local.
- assets locales.
- correo en modo `log`, sin enviar mensajes reales.
- Turnstile con claves de prueba.

### staging

- D1 independiente.
- R2 independiente.
- Queue independiente.
- Durable Objects independientes.
- Brevo habilitado solo hacia correos de prueba/controlados.

### production

- recursos totalmente separados.
- secretos únicamente vía Cloudflare Secrets.

Nunca compartir D1 entre staging y producción.

### Variables/bindings previstos

```text
DB
ASSETS_BUCKET
EMAIL_QUEUE
ROOM
ROOM_DIRECTORY
RATE_LIMIT

APP_ENV
APP_ORIGIN
SESSION_PEPPER
TOKEN_PEPPER
TURNSTILE_SECRET_KEY
BREVO_API_KEY
BREVO_WEBHOOK_SECRET
MAIL_FROM_NAME
MAIL_FROM_EMAIL
BREVO_TEMPLATE_VERIFY_EMAIL
BREVO_TEMPLATE_WELCOME
BREVO_TEMPLATE_PASSWORD_RESET
BREVO_TEMPLATE_PASSWORD_CHANGED
BREVO_TEMPLATE_FRIEND_REQUEST
BREVO_TEMPLATE_FRIEND_ACCEPTED
```

Los secretos no se incluyen en `.dev.vars.example`; ahí solo se documentan los nombres.

---

# 6. Identidad y autenticación

## Estados de cuenta

```text
PENDING_EMAIL
ACTIVE
SUSPENDED
BANNED
DELETED
```

Solo `ACTIVE` puede entrar al mundo.

## Registro

Endpoint conceptual:

```http
POST /api/v1/auth/register
```

Payload:

```json
{
  "email": "usuario@example.com",
  "username": "David",
  "password": "...",
  "turnstileToken": "...",
  "termsVersion": "2026-01"
}
```

### Secuencia exacta

1. Validar JSON y tamaño máximo.
2. Normalizar correo para comparación.
3. Normalizar username para unicidad sin destruir el valor visible.
4. Validar Turnstile en servidor.
5. Aplicar rate limit por IP anonimizada/hash y por correo normalizado.
6. Verificar política de username.
7. Verificar política de contraseña.
8. Comprobar unicidad.
9. Hash de contraseña.
10. Crear `account` en `PENDING_EMAIL`.
11. Crear token criptográficamente aleatorio de verificación.
12. Guardar **solo hash del token** en D1, nunca el token en claro.
13. Expiración inicial de verificación: 30 minutos.
14. Crear `notification_outbox` con `EMAIL_VERIFY`.
15. Intentar publicar su ID en `EMAIL_QUEUE` usando `ctx.waitUntil`.
16. Responder sin esperar a Brevo.

La respuesta no debe revelar detalles útiles para enumeración de cuentas.

## Verificación de correo

El enlace de Brevo apunta a una ruta de frontend:

```text
/verify-email?token=<token>
```

No consumir el token mediante `GET` automático. Clientes y scanners de correo pueden visitar enlaces.

La UI muestra “Verificar correo” y ejecuta:

```http
POST /api/v1/auth/verify-email
```

```json
{ "token": "..." }
```

Servidor:

1. Hashea el token recibido con el mismo esquema.
2. Busca token válido, no usado y no expirado.
3. Marca token como usado.
4. Cambia cuenta a `ACTIVE`.
5. Registra auditoría.
6. Encola `WELCOME_EMAIL`.
7. Puede crear sesión inmediatamente y devolver estado autenticado.

## Reenvío de verificación

```http
POST /api/v1/auth/resend-verification
```

- cooldown mínimo sugerido: 60 segundos.
- máximo inicial sugerido: 5 por cuenta/día.
- invalidar tokens anteriores o mantener solo el más reciente como válido.
- respuesta genérica para evitar enumeración.

## Login

```http
POST /api/v1/auth/login
```

1. Turnstile adaptativo si hay abuso o después de fallos; se puede requerir siempre en MVP para simplificar.
2. Rate limit.
3. Buscar cuenta.
4. Verificar hash de contraseña.
5. Rechazar `PENDING_EMAIL`, `SUSPENDED` y `BANNED` con códigos de dominio controlados.
6. Generar token de sesión aleatorio de 256 bits o más.
7. Guardar solo hash del token en D1.
8. Enviar token en cookie:

```text
HttpOnly
Secure
SameSite=Lax
Path=/
```

No guardar sesión en localStorage.

## Sesiones

Sesión inicial:

- expiración absoluta sugerida: 30 días.
- `last_seen_at` no debe escribirse en cada request; actualizar como máximo cada ~15 minutos.
- logout revoca sesión actual.
- “cerrar todas las sesiones” revoca todas las sesiones de la cuenta.

WebSocket autentica usando la misma cookie y valida `Origin`.

## Recuperación de contraseña

```http
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
```

- Turnstile obligatorio en solicitud.
- respuesta siempre genérica.
- token aleatorio de un solo uso.
- almacenar hash del token.
- expiración sugerida: 20 minutos.
- al restablecer contraseña: revocar todas las sesiones activas.
- enviar `PASSWORD_CHANGED` una vez terminado.

## Hash de contraseña

Objetivo: Argon2id compatible con el runtime de Workers y medido con benchmarks reales. Si la implementación escogida no es viable por CPU/runtime, usar un esquema sólido disponible mediante Web Crypto y documentar la decisión en ADR antes de cambiar el algoritmo.

Nunca inventar criptografía propia.

---

# 7. Brevo y sistema de correo

## Regla de arquitectura

```text
Domain event
   ↓
notification_outbox en D1
   ↓
EMAIL_QUEUE
   ↓
Email consumer
   ↓
Brevo Transactional API
   ↓
Webhook Brevo
   ↓
D1 delivery events/status
```

## Configuración inicial de Brevo

Antes de producción:

1. Configurar remitente.
2. Configurar dominio de envío.
3. Completar DNS requerido para autenticación del dominio.
4. Configurar DMARC apropiado para el dominio.
5. Crear API key de producción exclusivamente para Wous.
6. Guardar API key como secreto de Cloudflare.
7. Crear templates transaccionales.
8. Configurar webhook de eventos transaccionales hacia Wous.
9. Proteger webhook con secreto/header de alta entropía.

No poner la API key de Brevo en frontend, R2, D1 ni GitHub.

## Templates mínimos

### EMAIL_VERIFY

Parámetros:

```text
displayName
verificationUrl
expiresMinutes
```

### WELCOME_EMAIL

```text
displayName
appUrl
```

### PASSWORD_RESET

```text
displayName
resetUrl
expiresMinutes
```

### PASSWORD_CHANGED

```text
displayName
securityUrl
```

### FRIEND_REQUEST

```text
displayName
actorDisplayName
friendsUrl
```

### FRIEND_ACCEPTED

```text
displayName
actorDisplayName
friendsUrl
```

## Tipos de correo

### Seguridad/operación — no desactivables

- verificación de correo.
- recuperación de contraseña.
- contraseña modificada.
- cambio sensible de cuenta.
- suspensión/ban cuando proceda.

### Sociales — configurables

- solicitud de amistad.
- amistad aceptada.
- futuras invitaciones/eventos.

### Marketing — separado

No mezclar marketing con notificaciones transaccionales. Consentimiento separado y apagado por defecto mientras no exista una política de marketing definida.

## Outbox

Tabla `notification_outbox` debe contener al menos:

```text
id
account_id
type
dedupe_key
payload_json
status
attempts
available_at
created_at
queued_at
sent_at
provider_message_id
last_error
```

Estados:

```text
PENDING
QUEUED
PROCESSING
SENT
FAILED
```

`dedupe_key` debe tener índice único cuando el evento sea naturalmente deduplicable.

Ejemplos:

```text
verify:<accountId>:<verificationTokenId>
password-reset:<resetTokenId>
friend-request:<friendshipId>:created
```

Cloudflare Queue entrega con semántica de reintento; el consumidor debe ser idempotente dentro de lo posible.

## DLQ

Tras agotar reintentos, el mensaje va a `EMAIL_DLQ`.

Debe existir un runbook para:

1. identificar mensajes fallidos;
2. revisar `last_error`;
3. corregir configuración/proveedor;
4. reenviar explícitamente si corresponde.

## Webhook de Brevo

Ruta:

```http
POST /api/v1/webhooks/brevo
```

Eventos que interesa registrar al inicio:

```text
sent/request
delivered
deferred
soft_bounce
hard_bounce
blocked
invalid
error
```

`opened` y `click` no son necesarios para el funcionamiento del MVP y pueden omitirse para reducir tracking innecesario.

El webhook:

1. valida secreto/header.
2. valida esquema.
3. deduplica evento del proveedor.
4. guarda evento resumido.
5. actualiza estado de entregabilidad cuando sea necesario.
6. en hard bounce/invalid/blocked marca el correo como problemático para evitar ciclos de envío inútiles.

Nunca permitir que un webhook de Brevo cambie saldo, inventario, rol o permisos del juego.

---

# 8. Modelo D1 inicial

## accounts

```text
id TEXT PK
email TEXT NOT NULL
email_normalized TEXT UNIQUE NOT NULL
username TEXT NOT NULL
username_normalized TEXT UNIQUE NOT NULL
password_hash TEXT NOT NULL
status TEXT NOT NULL
email_verified_at INTEGER NULL
email_deliverability TEXT NOT NULL DEFAULT 'UNKNOWN'
terms_version TEXT NOT NULL
terms_accepted_at INTEGER NOT NULL
created_at INTEGER NOT NULL
updated_at INTEGER NOT NULL
```

## sessions

```text
id TEXT PK
account_id TEXT NOT NULL
token_hash TEXT UNIQUE NOT NULL
created_at INTEGER NOT NULL
last_seen_at INTEGER NOT NULL
expires_at INTEGER NOT NULL
revoked_at INTEGER NULL
user_agent_summary TEXT NULL
```

Índices:

```text
(account_id, revoked_at)
(expires_at)
```

## email_verification_tokens

```text
id TEXT PK
account_id TEXT NOT NULL
token_hash TEXT UNIQUE NOT NULL
expires_at INTEGER NOT NULL
used_at INTEGER NULL
created_at INTEGER NOT NULL
```

## password_reset_tokens

Misma filosofía que verificación, con expiración independiente.

## characters

```text
id TEXT PK
account_id TEXT UNIQUE NOT NULL
display_name TEXT NOT NULL
created_at INTEGER NOT NULL
updated_at INTEGER NOT NULL
last_room_id TEXT NULL
```

MVP: un personaje por cuenta. El esquema deja abierta una migración futura a varios personajes.

## character_appearance

```text
character_id TEXT PK
body_id TEXT NOT NULL
skin_tone_id TEXT NOT NULL
hair_id TEXT NOT NULL
hair_color_id TEXT NOT NULL
top_id TEXT NOT NULL
bottom_id TEXT NOT NULL
shoes_id TEXT NOT NULL
accessory_id TEXT NULL
updated_at INTEGER NOT NULL
```

Los IDs deben apuntar a definiciones válidas del catálogo de contenido.

## friendships

Una sola relación por par de cuentas/personajes.

```text
id TEXT PK
requester_id TEXT NOT NULL
addressee_id TEXT NOT NULL
status TEXT NOT NULL
created_at INTEGER NOT NULL
accepted_at INTEGER NULL
blocked_by_id TEXT NULL
```

Estados:

```text
PENDING
ACCEPTED
BLOCKED
REMOVED
```

Agregar restricción lógica/índice para impedir duplicados del mismo par sin importar el orden.

## notification_preferences

```text
account_id TEXT PK
friend_request_email INTEGER NOT NULL DEFAULT 1
friend_accepted_email INTEGER NOT NULL DEFAULT 1
marketing_email INTEGER NOT NULL DEFAULT 0
updated_at INTEGER NOT NULL
```

## notification_outbox

Definida en sección de Brevo.

## email_delivery_events

```text
id TEXT PK
outbox_id TEXT NULL
provider_message_id TEXT NULL
provider_event_id TEXT NULL
event_type TEXT NOT NULL
occurred_at INTEGER NOT NULL
created_at INTEGER NOT NULL
metadata_json TEXT NULL
```

No almacenar payloads completos indefinidamente si contienen datos innecesarios.

## audit_log

```text
id TEXT PK
actor_account_id TEXT NULL
action TEXT NOT NULL
target_type TEXT NOT NULL
target_id TEXT NOT NULL
reason TEXT NULL
metadata_json TEXT NULL
created_at INTEGER NOT NULL
```

Acciones sensibles únicamente; no convertirlo en un log de cada movimiento.

---

# 9. IDs y tiempo

- IDs públicos: UUID/ULID o equivalente no secuencial.
- No exponer IDs incrementales si se introducen internamente.
- El navegador nunca es fuente de verdad del tiempo.
- Toda expiración y cooldown depende del reloj del Worker/servidor.
- Timestamps persistidos en UTC como epoch milisegundos o segundos; elegir uno y no mezclar.

---

# 10. Personaje y creación inicial

Flujo:

```text
Cuenta ACTIVE
   ↓
¿Tiene personaje?
   ├─ Sí → World Entry
   └─ No → Character Creator
```

Endpoint:

```http
POST /api/v1/characters
```

El cliente solo manda IDs seleccionados de opciones permitidas.

Servidor valida:

- sesión.
- todavía no existe personaje.
- display name permitido.
- cada pieza existe.
- cada pieza pertenece al set inicial permitido.
- combinación es compatible.

El cliente jamás puede crear un personaje con un asset arbitrario enviado por URL.

---

# 11. Sistema de dispositivos e input

Wous debe adaptarse a PC, teléfono, tablet/híbrido y dejar preparada la entrada de gamepad.

## No detectar únicamente por User-Agent

Construir `DeviceProfile` mediante capacidades:

```ts
type DeviceProfile = {
  hasTouch: boolean;
  maxTouchPoints: number;
  coarsePointer: boolean;
  hover: boolean;
  hasKeyboardEvidence: boolean;
  hasMouseEvidence: boolean;
  hasGamepad: boolean;
  viewportWidth: number;
  viewportHeight: number;
  orientation: 'portrait' | 'landscape';
};
```

Además mantener:

```text
lastActiveInputMethod:
KEYBOARD_MOUSE | TOUCH | GAMEPAD
```

Puede cambiar en runtime sin recargar.

## InputManager

```text
KeyboardAdapter ─┐
MouseAdapter ────┤
TouchAdapter ────┼─► InputManager ─► GameInput
GamepadAdapter ──┘
```

Contrato normalizado:

```ts
type GameInput = {
  seq: number;
  moveX: number; // -1..1
  moveY: number; // -1..1
  interact: boolean;
  emote?: string;
};
```

El backend nunca debe recibir “W key”, “joystick left” o coordenadas de UI.

## PC

- WASD.
- flechas.
- E para interacción.
- Enter para chat.
- clic donde sea apropiado para UI, no como requisito de movimiento en MVP.

## Móvil

MVP orientado a landscape.

- joystick virtual izquierdo.
- botón contextual derecho.
- emotes accesibles mediante botón secundario/overlay.
- chat plegable.
- botones con área táctil suficiente.
- no depender de hover.

Botón contextual:

```text
cerca de puerta → Entrar
cerca de silla → Sentarse (fase de interacciones)
cerca de objeto → Interactuar
```

En portrait se muestra UI de rotación o un layout limitado; no intentar mantener dos experiencias completas en MVP.

## Híbridos

Si un dispositivo táctil comienza a usar teclado/mouse, cambiar hints y ocultar controles táctiles después de un pequeño debounce. Si vuelve a tocar, reactivar Touch UI.

---

# 12. Protocolo WebSocket

Ruta conceptual:

```text
/ws/world
```

Handshake:

1. validar `Origin`.
2. validar cookie de sesión.
3. validar account `ACTIVE`.
4. cargar character.
5. resolver sala lógica.
6. pedir instancia a `ROOM_DIRECTORY`.
7. conectar al `ROOM` correspondiente.

## Envelope

Todos los mensajes:

```json
{
  "v": 1,
  "type": "PLAYER_INPUT",
  "id": "evt_...",
  "seq": 123,
  "payload": {}
}
```

No aceptar mensajes sin validación runtime.

## Cliente → servidor

MVP:

```text
PLAYER_INPUT
CHAT_SEND
EMOTE_PLAY
INTERACT
ENTER_PORTAL
PING
```

## Servidor → cliente

```text
ROOM_SNAPSHOT
PLAYER_JOINED
PLAYER_LEFT
PLAYER_STATE
CHAT_MESSAGE
EMOTE_PLAYED
INTERACTION_RESULT
ROOM_TRANSFER
PONG
ERROR
```

## Códigos de error

Usar códigos, no texto para lógica:

```text
AUTH_REQUIRED
ACCOUNT_NOT_ACTIVE
INVALID_MESSAGE
INVALID_STATE
RATE_LIMITED
ROOM_FULL
INVALID_MOVEMENT
PORTAL_NOT_FOUND
PORTAL_NOT_REACHABLE
CHAT_REJECTED
FORBIDDEN
```

---

# 13. Mundo, salas e instancias

## Modelo

```text
World
└─ Zone
   └─ LogicalRoom
      ├─ Instance 01
      ├─ Instance 02
      └─ Instance 03
```

Primer mundo:

```text
Centro
├─ Plaza
└─ Café
```

## Capacidad inicial

Por instancia:

```text
softLimit = 35
hardLimit = 45
```

Valores configurables, no mágicos dispersos.

## ROOM_DIRECTORY Durable Object

Un DO por sala lógica, por ejemplo:

```text
directory:plaza
```

Responsabilidades:

- conocer instancias activas/recentes.
- recibir ocupación.
- elegir instancia apropiada.
- crear nueva instancia lógica cuando sea necesario.
- intentar mantener amigos juntos en fases posteriores.

MVP: elegir instancia con espacio; sin algoritmos sociales.

## ROOM Durable Object

Ejemplo de ID lógico:

```text
room:plaza:01
```

Responsabilidades:

- aceptar WebSockets autenticados reenviados por Worker.
- mantener jugadores conectados.
- validar movimientos.
- broadcast de estado.
- chat temporal.
- emotes.
- portales/interacciones.
- snapshot para nuevos jugadores.
- límites por conexión.

Usar la WebSocket Hibernation API de Durable Objects. No mantener intervalos permanentes sin necesidad porque impedirían hibernación.

---

# 14. Movimiento autoritativo

## Objetivo

Render cliente fluido sin necesitar 60 mensajes/s.

Parámetros iniciales de prueba, configurables:

```text
client render: requestAnimationFrame
input send while moving: 12 Hz
input send on direction change/release: inmediato
remote interpolation buffer: ~100 ms
max accepted server movement delta: ~150 ms
```

Ajustar después de mediciones reales.

## Regla

El cliente manda **intención**, no posición final:

```json
{
  "type": "PLAYER_INPUT",
  "seq": 382,
  "payload": {
    "moveX": 1,
    "moveY": 0
  }
}
```

Servidor:

1. descarta secuencias antiguas.
2. toma su propio tiempo.
3. calcula `dt` desde último input aceptado, con cap.
4. normaliza vector para impedir velocidad diagonal extra.
5. calcula desplazamiento según velocidad del servidor.
6. resuelve colisión contra mapa lógico.
7. actualiza estado autoritativo.
8. emite `PLAYER_STATE`.

Cliente local predice inmediatamente y corrige suavemente ante divergencia.

Clientes remotos interpolan entre estados autoritativos.

Nunca guardar cada posición en D1.

---

# 15. Mapa lógico y colisiones

El mapa visual y el mapa autoritativo deben derivar de datos versionados compatibles.

Tipos mínimos:

```text
WALKABLE
BLOCKED
PORTAL
INTERACTION
SPAWN
```

Cada mapa tiene:

```text
mapId
version
bounds
spawnPoints
collisionGrid / polygons
portals
interactables
```

La colisión autoritativa vive en datos accesibles al backend. Phaser no es la única autoridad.

---

# 16. Portales y cambio de sala

Cliente:

```json
{
  "type": "ENTER_PORTAL",
  "payload": { "portalId": "plaza-cafe" }
}
```

Servidor valida:

1. portal existe.
2. jugador está suficientemente cerca.
3. estado permite transición.
4. destino existe.
5. jugador tiene permisos.
6. `ROOM_DIRECTORY` encuentra destino.

Flujo:

```text
Room A
→ marca jugador TRANSITIONING
→ resuelve Room B
→ Room A deja de anunciar jugador
→ Room B acepta jugador
→ cliente recibe ROOM_TRANSFER + token/handshake interno si se requiere
→ cliente carga snapshot de Room B
→ estado IN_ROOM
```

No permitir que un personaje quede activo en dos salas.

---

# 17. Snapshot y reconexión

Al entrar a una sala:

```json
{
  "type": "ROOM_SNAPSHOT",
  "payload": {
    "room": {},
    "players": [],
    "interactables": [],
    "serverTime": 0
  }
}
```

No reproducir historial completo.

## Reconexión

Estados de cliente:

```text
OFFLINE
CONNECTING
ONLINE
RECONNECTING
```

Una caída corta debe intentar reconectar con backoff.

Ventana inicial sugerida para conservar presencia visual: 20–30 s, pero sin escribir un timer continuo por jugador. Diseñar mediante marca temporal y cleanup oportunista/alarms solo cuando realmente sea necesario.

Al volver:

- validar sesión otra vez.
- recuperar sala si sigue válida.
- recibir snapshot nuevo.
- no confiar en estado local anterior.

---

# 18. Chat y moderación mínima

MVP de chat:

- chat de sala.
- longitud máxima.
- UTF-8 saneado.
- rate limit por conexión.
- bloqueo de payloads de control.
- no renderizar HTML enviado por usuario.

El cliente renderiza texto, nunca HTML arbitrario.

Rate limit inicial sugerido:

```text
5 mensajes / 10 s
```

Configurable.

No persistir indefinidamente todo el chat en D1 en MVP. Mantener ventana reciente en estado de sala. Cuando un usuario reporte, guardar el mensaje reportado y contexto mínimo necesario en una futura tabla de moderación.

Antes de beta pública deben existir al menos:

- bloquear usuario.
- reportar usuario/mensaje.
- mute temporal de moderación.
- suspensión/ban.
- auditoría de acciones de moderación.

---

# 19. Emotes

Cliente solicita ID permitido:

```text
wave
laugh
heart
thumbs_up
```

Servidor valida enum/catálogo y cooldown.

Luego broadcast:

```text
EMOTE_PLAYED
```

No aceptar URL de asset o código de animación desde el cliente.

---

# 20. Social y amigos

Fase posterior al mundo básico, pero prevista desde el esquema.

Comandos HTTP:

```text
POST /api/v1/friends/request
POST /api/v1/friends/:id/accept
POST /api/v1/friends/:id/reject
POST /api/v1/friends/:id/remove
POST /api/v1/users/:id/block
```

Una solicitud aceptada genera evento de dominio.

```text
FRIEND_REQUEST_CREATED
FRIEND_REQUEST_ACCEPTED
```

Si la preferencia lo permite, crear outbox para Brevo.

### Anti-spam de correo social

Una persona no debe poder usar solicitudes de amistad para bombardear el correo de otra.

Aplicar:

- una relación pendiente por par.
- cooldown al recrear solicitud.
- rate limit por actor.
- `dedupe_key` de notificación.
- no reenviar email por clicks/reintentos duplicados.

---

# 21. Economía e inventario — fase posterior

No implementar antes de que el MVP realtime sea estable.

Principios ya decididos:

- cliente nunca manda precio confiable.
- cliente nunca manda recompensa confiable.
- transacciones monetarias tienen ledger.
- compra sensible lleva `requestId` idempotente.

Tablas futuras:

```text
wallets
currency_ledger
inventory_items
purchase_transactions
```

Ejemplo de compra:

```text
BUY_ITEM(itemId, requestId)
→ server obtiene definición y precio
→ verifica saldo
→ transacción D1
→ ledger -precio
→ inventario +item
→ resultado
```

Nunca hacer `balance -= clientPrice`.

---

# 22. Seguridad HTTP

Aplicar desde la primera fase:

- HTTPS únicamente en producción.
- CORS same-origin salvo decisión explícita.
- validar `Origin` en WebSockets y acciones sensibles.
- límites de tamaño de request.
- esquemas Zod.
- cookies seguras.
- CSP.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy` restrictiva apropiada.
- HSTS cuando dominio y despliegue estén estables.
- Turnstile con validación server-side.
- nunca confiar en token Turnstile solo porque existe en frontend.
- rate limit de auth.
- mensajes de error que no enumeren cuentas.
- secretos exclusivamente en bindings/secrets.

No registrar contraseñas, cookies de sesión, tokens de verificación/reset ni API keys.

---

# 23. Rate limiting

## Auth

`RateLimitDO` puede agrupar límites por hash de IP/ruta y por identidad normalizada cuando corresponda.

No persistir IP cruda más tiempo del necesario. Si se requiere correlación, usar HMAC/hash con secreto rotatable y buckets temporales.

Valores iniciales deben quedar en config y probarse; no dispersar números por código.

Ejemplos iniciales:

```text
register: 5 / 15 min por IP hash
login: 10 / 10 min por IP hash + límite por cuenta
forgot-password: 5 / hora por destino + IP
resend-verification: 5 / día por cuenta
```

## Room

Rate limit en memoria/estado del `RoomDO` por socket:

```text
chat
emotes
interactions
portal requests
malformed messages
```

Un cliente que excede repetidamente límites puede ser desconectado.

---

# 24. Observabilidad

Desde el primer despliegue registrar eventos estructurados.

Nunca depender solo de `console.log("algo falló")`.

Campos sugeridos:

```text
level
event
requestId
accountId (si aplica)
roomInstanceId (si aplica)
errorCode
durationMs
environment
```

No incluir secretos.

Métricas/contadores conceptuales:

```text
registrations_started
registrations_completed
email_verify_enqueued
email_sent
email_delivery_failed
login_success
login_failed
ws_connections
ws_disconnects
room_population
invalid_ws_messages
chat_rate_limited
room_transfer_failed
```

Crear runbooks en `docs/runbooks/` para correo, D1 y realtime cuando entren a producción.

---

# 25. Testing

## Unit tests

Obligatorios para:

- normalización de email/username.
- validadores.
- token expiry.
- session validation.
- movimiento.
- normalización diagonal.
- colisión.
- portales.
- dedupe de notificaciones.
- reglas de amistad.

## Integración Worker

- registro crea cuenta + token + outbox.
- registro **no** llama Brevo directamente.
- verificación activa cuenta una sola vez.
- token expirado falla.
- login crea sesión.
- reset revoca sesiones.
- queue consumer transforma outbox en payload Brevo.
- webhook protegido actualiza delivery status.

En tests, Brevo se mockea. Nunca enviar correo real desde CI.

## Durable Objects

Simular:

- dos clientes entran.
- snapshot correcto.
- movimiento válido.
- speed hack rechazado/corregido.
- colisión.
- desconexión.
- room full.
- transferencia plaza → café.
- mensajes inválidos.
- rate limits.

## E2E Playwright

Mínimo:

1. registro.
2. simulación/verificación controlada.
3. login.
4. crear personaje.
5. abrir dos contextos de navegador.
6. ambos entran a Plaza.
7. A se mueve y B observa.
8. A envía chat y B recibe.
9. A cambia a Café.
10. logout.

Agregar viewport móvil y emulación touch para probar controles.

---

# 26. CI/CD

En cada PR/commit relevante:

```text
install --frozen-lockfile
↓
typecheck
↓
lint
↓
unit tests
↓
integration tests
↓
build web
↓
build worker
```

E2E puede ejecutarse en pipeline separado/staging si el costo/tiempo crece.

No desplegar producción si typecheck o tests fallan.

D1 migrations se prueban en entorno no productivo antes de producción.

---

# 27. Fases de construcción

## Fase 0 — Bootstrap del monorepo

### Construir

- pnpm workspace.
- `apps/web`.
- `apps/worker`.
- packages compartidos.
- TypeScript strict.
- lint/format.
- Vitest.
- Playwright preparado.
- Wrangler con environments.
- health endpoint.

### Definition of Done

- `pnpm install` limpio.
- `pnpm typecheck` pasa.
- `pnpm test` pasa.
- web build pasa.
- Worker local responde `/api/v1/health`.
- ningún secreto en repo.

---

## Fase 1 — Infra Cloudflare y D1

### Construir

- D1 binding.
- primeras migraciones.
- Queue y DLQ.
- Durable Object bindings/migrations.
- R2 binding.
- configuración local/staging/prod.
- helper de IDs y tiempo.
- error envelope HTTP.
- request ID middleware.

### DoD

- migraciones aplican desde DB vacía.
- health reporta dependencias sin revelar secretos.
- un test puede escribir/leer D1.
- un mensaje de prueba puede entrar a Queue en entorno controlado.

---

## Fase 2 — Registro, login, Brevo y seguridad de cuenta

### Construir

- accounts.
- session cookies.
- Turnstile.
- register.
- verify email.
- resend verification.
- login/logout.
- forgot/reset password.
- outbox.
- EMAIL_QUEUE consumer.
- Brevo adapter.
- webhook Brevo.
- preferencias iniciales.
- rate limiting de auth.

### DoD

- usuario no verificado no entra al mundo.
- correo de verificación sale por Queue/Brevo, no directo desde request.
- token es single-use y expira.
- reset de password revoca sesiones.
- API key Brevo solo existe en Cloudflare Secret.
- tests cubren happy path y abuso básico.
- una caída simulada de Brevo no rompe el registro ya persistido.

---

## Fase 3 — Creación de personaje

### Construir

- catálogo mínimo de cuerpo/piel/cabello/top/bottom/shoes.
- endpoint de creación.
- UI React.
- renderer de preview.
- persistencia.

### DoD

- solo account `ACTIVE`.
- un personaje por cuenta.
- assets arbitrarios rechazados.
- recarga conserva apariencia.

---

## Fase 4 — Phaser + InputManager

### Construir

- Game bootstrap.
- Plaza local sin multiplayer.
- movimiento local.
- cámara.
- KeyboardAdapter.
- TouchAdapter.
- DeviceProfile.
- hints dinámicos.
- modo landscape móvil.

### DoD

- PC funciona con WASD/flechas.
- móvil funciona con joystick táctil.
- cambiar entre touch y keyboard actualiza UI sin reload.
- gameplay no conoce teclas concretas, solo `GameInput`.

---

## Fase 5 — Realtime / RoomDO

### Construir

- WebSocket authenticated handshake.
- Hibernation API.
- `ROOM_DIRECTORY`.
- `ROOM`.
- snapshot.
- join/leave.
- movimiento autoritativo.
- client prediction.
- remote interpolation.
- límites de capacidad.

### DoD

- 2+ navegadores se ven.
- movimiento razonablemente fluido.
- cliente modificado no puede teletransportarse enviando coordenadas.
- desconectar elimina/expira presencia correctamente.
- una sala idle puede hibernar; no hay loop/timer permanente innecesario.

---

## Fase 6 — Portales, Café y reconexión

### Construir

- mapa Café.
- portal Plaza ↔ Café.
- validación por proximidad.
- room transfer.
- reconnection flow.
- loading transitions.

### DoD

- no se puede entrar a Café enviando un `roomId` arbitrario.
- personaje nunca queda activo en dos salas.
- reconexión recibe snapshot fresco.

---

## Fase 7 — Chat, emotes y seguridad social básica

### Construir

- chat sala.
- bubbles/UI.
- rate limit.
- sanitización.
- emotes.
- block/report mínimo.
- moderación básica.

### DoD

- HTML/script de usuario no se ejecuta.
- flood se limita.
- bloqueos se respetan.
- reporte conserva evidencia mínima útil.

---

## Fase 8 — Amigos + notificaciones por correo

### Construir

- friend request/accept/reject/remove.
- preferencias de email.
- email FRIEND_REQUEST.
- email FRIEND_ACCEPTED.
- anti-spam/dedupe.

### DoD

- relación no se duplica.
- no es posible generar múltiples correos por reintentar la misma solicitud.
- preferencia OFF impide correo social pero no emails críticos de seguridad.

---

## Fase 9 — Alpha cerrada

### Construir/validar

- admin mínimo.
- suspensión/ban.
- observabilidad.
- dashboards/log queries.
- pruebas de carga.
- hardening.
- contenido mínimo coherente.

### Load tests iniciales

Probar por separado:

```text
10 conexiones por Room
25
45
```

Luego varias instancias simultáneas.

Medir:

- p95 del input→broadcast.
- CPU/duración DO.
- mensajes por jugador.
- reconexiones.
- errores.
- consumo D1.

No declarar capacidad basándose en estimaciones; medir.

---

# 28. Después del MVP

Orden sugerido:

```text
Inventario
→ catálogo/ropa
→ moneda + ledger
→ tienda
→ minijuego 1
→ recompensas
→ más mapas
→ apartamentos
→ muebles
→ eventos
→ presencia avanzada
→ grupos/fiestas
```

Cada sistema económico debe construirse después de establecer ledger e idempotencia.

---

# 29. Decisiones explícitamente aplazadas

No resolver antes de necesitarlo:

- trading jugador-jugador.
- marketplace.
- dinero real.
- guilds/clanes.
- mascotas.
- PvP.
- voz.
- mundo sin instancias.
- varios personajes por cuenta.
- native apps.
- IA en NPCs.

No añadir por “ya que estamos”.

---

# 30. Edad, privacidad y lanzamiento público

Antes de una beta pública abierta se debe definir formalmente el público objetivo y las reglas de edad. Mientras esa decisión no exista, tratar el producto como alpha cerrada y evitar diseñar flujos que asuman acceso infantil sin requisitos adicionales.

Minimización de datos:

- no pedir fecha de nacimiento exacta si el producto no la necesita.
- no guardar IP cruda indefinidamente.
- no guardar historial completo de chat por defecto.
- separar consentimiento de marketing.
- ofrecer controles claros de notificaciones sociales.

Revisar requisitos legales aplicables antes del lanzamiento público; este documento es arquitectura técnica, no asesoría legal.

---

# 31. Convenciones de dominio

## Commands

Expresan intención:

```text
REGISTER_ACCOUNT
VERIFY_EMAIL
CREATE_CHARACTER
JOIN_ROOM
MOVE_PLAYER
SEND_CHAT
PLAY_EMOTE
ENTER_PORTAL
SEND_FRIEND_REQUEST
```

## Events

Expresan algo ya ocurrido:

```text
ACCOUNT_REGISTERED
EMAIL_VERIFIED
CHARACTER_CREATED
PLAYER_JOINED_ROOM
PLAYER_MOVED
CHAT_MESSAGE_ACCEPTED
PLAYER_ENTERED_ROOM
FRIEND_REQUEST_CREATED
```

No mezclar command y event.

## Servicios externos

Crear adapters:

```text
TurnstileVerifier
BrevoEmailProvider
Clock
IdGenerator
PasswordHasher
```

La lógica de dominio no debe importar SDK de Brevo directamente.

---

# 32. Contratos HTTP

Respuesta exitosa estándar cuando sea útil:

```json
{
  "data": {},
  "requestId": "req_..."
}
```

Error:

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "No se pudo iniciar sesión"
  },
  "requestId": "req_..."
}
```

El frontend decide por `code`, nunca por comparar texto de `message`.

---

# 33. Estados del jugador

Máquina de estados mínima:

```text
OFFLINE
↓
AUTHENTICATED
↓
LOADING_WORLD
↓
IN_ROOM
↔ TRANSITIONING
↓
RECONNECTING
```

Futuros estados exclusivos:

```text
IN_MINIGAME
EDITING_HOME
```

No permitir estados incompatibles simultáneos mediante booleanos dispersos.

---

# 34. Catálogo y assets

Pixel art inicial:

- tiles base: alrededor de 32×32.
- personaje visual aproximado: 32×48 o 32×64, ajustable tras prototipo.
- render con `image-rendering: pixelated` donde aplique.

Capas de personaje:

```text
body
skin
hair
hairColor
top
bottom
shoes
accessory
```

No generar un sprite completo por cada combinación si puede componerse por capas.

R2 será la fuente de assets publicados, pero el catálogo lógico debe estar versionado y validado para que el servidor sepa qué IDs son legales.

---

# 35. Primer backlog exacto para Claude

Claude debe comenzar aquí y no saltar directamente al juego.

### WOU-001 Bootstrap

- crear workspace.
- crear React/Vite/TS.
- crear Worker TS.
- shared tsconfig.
- scripts `dev`, `build`, `typecheck`, `test`, `lint`.

### WOU-002 Contratos

- package `contracts`.
- HTTP error envelope.
- IDs/tipos base.
- versionado de WS.

### WOU-003 Cloudflare config

- `wrangler` local/staging/prod.
- bindings declarados sin secretos.
- Durable Object migrations.

### WOU-004 D1 migration 0001

Crear:

```text
accounts
sessions
email_verification_tokens
password_reset_tokens
notification_preferences
notification_outbox
email_delivery_events
audit_log
```

### WOU-005 Auth foundations

- normalizers.
- password hasher adapter.
- random token helper.
- token hash helper.
- session service.

### WOU-006 Turnstile + RateLimit

- verifier adapter.
- `RateLimitDO`.
- middleware.

### WOU-007 Registration

- route.
- use case.
- tests.
- outbox event.

### WOU-008 Email queue

- queue consumer.
- Brevo adapter.
- mock transport local.
- retry behavior.

### WOU-009 Verification

- page UI.
- endpoint POST.
- single-use.
- welcome email.

### WOU-010 Login/logout

- secure session cookie.
- guards.
- tests.

### WOU-011 Password reset

- request.
- email.
- reset.
- session revocation.

### WOU-012 Brevo webhook

- auth secret.
- schema.
- delivery event storage.

Solo después de WOU-001 a WOU-012 empezar Character Creator.

---

# 36. Checklist antes de cada PR/commit de Claude

Claude debe comprobar:

- [ ] No añadió secretos.
- [ ] No rompió TypeScript strict.
- [ ] No introdujo `any` sin justificación.
- [ ] No confió en datos sensibles del cliente.
- [ ] Añadió/actualizó validación runtime.
- [ ] Añadió tests de la nueva regla.
- [ ] D1 cambió solo mediante migration.
- [ ] Los errores tienen códigos estables.
- [ ] Brevo no se llama desde el request handler principal.
- [ ] Operaciones sensibles son idempotentes o documentan por qué no.
- [ ] Logs no contienen secretos/tokens.
- [ ] La UI móvil no depende de hover.
- [ ] La lógica de juego recibe inputs normalizados.

---

# 37. Criterio de éxito técnico del primer gran hito

El primer hito real de Wous queda definido como:

> Dos personas con cuentas verificadas pueden abrir Wous desde dispositivos diferentes, crear su personaje, entrar a la misma Plaza, verse en tiempo real, caminar con controles apropiados a PC/touch, chatear, usar un emote y atravesar un portal hacia Café, con el servidor como autoridad y sin que Brevo forme parte del camino crítico del gameplay.

Cuando esto funcione de forma estable, recién entonces Wous está listo para crecer hacia economía, ropa, minijuegos y apartamentos.

---

# 38. Regla final para Claude

**No optimizar por cantidad de funcionalidades. Optimizar por coherencia del sistema.**

Si Claude descubre que una tarea requiere cambiar una decisión estructural de este documento:

1. detener esa parte del cambio;
2. crear/proponer un ADR en `docs/adr/`;
3. explicar problema, alternativas, impacto y migración;
4. no cambiar silenciosamente la arquitectura.

Wous debe crecer como un sistema mantenible, no como una acumulación de features.