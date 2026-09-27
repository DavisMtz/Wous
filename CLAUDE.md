# Wous — guía para Claude

Fuente de verdad técnica: **`PLAN_CONSTRUCCION_WOUS.md`**. Léelo antes de cambiar arquitectura.
Si una tarea exige cambiar una decisión estructural: detente, escribe un ADR en `docs/adr/` y no
cambies la arquitectura en silencio (§38).

## Estado de las fases

| Fase | Estado |
| --- | --- |
| 0 · Bootstrap del monorepo | ✅ hecha |
| 1 · Infra Cloudflare y D1 | ✅ hecha · staging en `wous-staging.logidma.workers.dev` |
| 2 · Registro, login, Brevo | ✅ hecha · correo real verificado en staging |
| 3 · Creación de personaje | ✅ hecha · el probador |
| 4 · Phaser + InputManager | ✅ hecha · la Plaza (`/plaza`), arte por código (ADR-0007) |
| 5 · Realtime / RoomDO | ✅ hecha · `/ws/world`, RoomDO con Hibernation (ADR-0008) |
| 6 · Portales, Café y reconexión | ✅ hecha · el Café, `ENTER_PORTAL`, turno de presencia y ventana de gracia (ADR-0009) |
| 7 · Chat, emotes y seguridad social | ✅ hecha · chat de sala, gestos, bloqueos y reportes por la sala; moderación por script (ADR-0010) |
| 8 · Amigos + correo social | ✅ hecha · tu banda (`/friends`, la foto de grupo), solicitudes con vueltas y en la sombra, avisos por correo (ADR-0011) |
| 9 · Alpha cerrada | ⏳ |

No se empieza una fase sin cumplir el Definition of Done de la anterior (§1.15).

## Comandos

```bash
pnpm install          # pnpm 12; solo esbuild y workerd pueden correr scripts (allowBuilds)
pnpm dev              # Worker en :8787 + Vite en :5173 (Vite reenvía /api y /ws)
pnpm typecheck        # regenera worker-configuration.d.ts y corre tsc en todo
pnpm lint             # Biome (lint + formato); `pnpm exec biome check --write .` corrige
pnpm test             # unidad + integración (el Worker corre dentro de workerd)
pnpm test:e2e         # Playwright con el Chrome instalado
pnpm build            # web → apps/web/dist, luego dry-run del Worker
pnpm deploy:staging   # migraciones remotas + deploy de wous-staging
node scripts/moderacion/moderar.mts <local|staging|production> reportes   # moderación (docs/runbooks/moderacion.md)
```

## Reglas que no se negocian (resumen de §1 y §36)

- El servidor es autoritativo: el cliente manda intención, nunca posición final, precio, saldo,
  rol, tiempo ni recompensa.
- Validación runtime con los esquemas de `@wous/contracts` en ambos lados.
- D1 solo cambia por migración en `database/migrations/` (forward-only).
- Errores con códigos estables; el frontend decide por `code`, nunca por el texto.
- Brevo nunca en el camino de la petición: outbox en D1 → `EMAIL_QUEUE` → consumidor.
- Nada de secretos, tokens ni cookies en logs, en el repo (es **público**) ni en `localStorage`.
- Tiempo en epoch **ms**; IDs `<prefijo>_<ULID>` (ADR-0004).
- La UI móvil no depende de hover; el juego solo recibe `GameInput` normalizado.

## Secretos

Viven en `apps/worker/secrets.*.json` y `.dev.vars` (ignorados). Se suben con
`wrangler secret bulk <archivo> --env <entorno>`; **nunca** `secret put` por tubería (mete un salto
de línea en el valor). Antes de cada commit: `git status` sin ningún archivo de secretos.

## Trampas del entorno (Windows, sin admin)

- Node portable en `C:\Users\seguimientos\.local\node`; pnpm instalado ahí.
- Toda orden con red (install, wrangler remoto) necesita el sandbox desactivado.
- `wous.logidma.com` va en `routes` con `custom_domain: true` (entorno production) y funciona con la
  sesión OAuth de `wrangler login`. En otros proyectos con **token de API** eso fallaba con
  `Authentication error [10000]`: si algún día se despliega con token, atar el dominio por API.
- Heredocs largos en Bash se truncan: los archivos se escriben con la herramienta de escritura.
- `apps/web/dev-plaza.html?quieto&spawn=desde-cafe` abre la Plaza sin sesión (solo desarrollo);
  `?mapa=cafe` abre el Café y las puertas cruzan sin servidor. El E2E lee posición, sala e ID de
  `window.__wousJuego`, que solo existe con `import.meta.env.DEV` (compara por ID: otras pruebas
  pueden dejar gente en la misma plaza).
- Localmente, cerrar una pestaña llega a la sala con cierre de despedida (se va en el acto) y el
  doble montaje de `StrictMode` como 1006 (lugar guardado que hereda la segunda conexión). Ver ADR-0009.
- Toda migración nueva cambia el conteo que revisa `test/health.test.ts`.
- El Worker local (:8787) sirve el último `apps/web/dist` con la CSP real de `_headers`: la cookie de
  `localhost` vale en ambos puertos, así que una cuenta creada por :5173 prueba el build de producción.
- Chat (Fase 7): el texto se sanea con `sanitizeChat` de contracts y se pinta SIEMPRE como texto (nodo
  de React o canvas de Phaser); nunca `innerHTML`. La evidencia de un reporte sale de la ventana
  `chat:*` del storage de la sala, nunca del cliente. Bloquear filtra en el servidor (por
  destinatario) y en el cliente se esconde lo ya dicho (`ocultos`).
- Los botones del HUD que se usan jugando (gestos, nombres del chat, «Gente aquí») llevan
  `onMouseDown={(e) => e.preventDefault()}`: con ratón no se quedan el foco, y Enter sigue abriendo
  el chat en vez de reactivar el botón. Con teclado se llega igual con Tab.
- La suite E2E completa con 2 workers da falsos rojos por RAM en esta máquina; cada archivo por
  separado (`--workers=1`) es la prueba que cuenta.
- Amistades (Fase 8, ADR-0011): van por HTTP (`/api/v1/friends…`), no por la sala. Una fila por
  par (`account_low`/`account_high`) y una `round` que sube en cada solicitud nueva: la clave de
  dedupe del correo lleva la vuelta. Pedirle a quien te bloqueó guarda la solicitud con
  `hidden = 1` (quien pide la ve enviada; la otra persona nunca). Bloquear (sala o
  `POST /users/:characterId/block`) termina la amistad en el mismo batch (`addBlock`), y el de HTTP
  avisa a la sala de quien bloquea por RPC (`whereIs` + `applyBlock`).
- La marca de amistad en la plaza sale de `RoomState.friends` (lo llena `setFriends` con la lista
  HTTP), no de la sala. `apps/web/dev-amigos.html` abre tu banda sin sesión:
  `?caso=vacio|album|cargando|error`, `?abrir=Nombre&paso=bloquear`, `?quieto`.
- Capturas de revisión de tu banda: `WOUS_CAPTURAS=1 pnpm exec playwright test
  tests/amigos-capturas.spec.ts --project=escritorio`.
