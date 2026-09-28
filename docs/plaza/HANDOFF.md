# La Plaza de Morelia · relevo para quien sigue

Documento para el agente que continúe la Plaza de Wous en un chat nuevo. Reúne lo que se pidió, lo
que ya existe, cómo está hecho, lo que se encontró investigando el centro de Morelia, las
referencias y un plan para lo que falta. Escrito el 27 de septiembre de 2026, al cerrar la sesión
que hizo la Plaza v2.

**Orden de lectura sugerido:** este documento completo → `CLAUDE.md` → `PLAN_CONSTRUCCION_WOUS.md`
(§1, §13–17, §25, §34, §36–38) → `docs/adr/0007-escala-y-arte-procedural.md` →
`docs/adr/0013-plaza-de-morelia-asientos-y-placas.md` → `docs/plaza/investigacion.md` (larga:
consúltala por secciones). Al final hay un prompt listo para pegar en el chat nuevo (§14).

---

## 1. Lo que pidió el usuario

El usuario escribe en español, desde el teléfono, de forma oral. Sus pedidos sobre la Plaza, tal
cual:

> «Quiero que analices cómo es Morelia, Michoacán, específicamente el centro. En el centro hay una
> catedral, en la catedral tiene dos plazas a un lado. Bueno, pues quiero que la plaza donde
> inicia […] sea precisamente inspirado lo más cercano que pueda a el centro de Morelia. Entonces,
> haz que se vea de esa forma. Lo más fiel posible. Trabaja y detállalo tanto los hitbox como
> interacciones, es decir, que las bancas te permitan sentarte, como las cosas características. Así
> que primero haz una investigación sobre cómo están estas plazas. Luego haz una búsqueda visual
> sobre cómo está construida y cómo se caracteriza. Después inicia planificando cómo hacer
> funcionar los componentes, luego conviértelos en pixel art, haz todo el mapeo, revisa el mapeo,
> coloca los objetos usables y después coloca en algún sitio el café que quede bien, el café que ya
> existe actualmente y próximamente podremos hacer el entrar a la catedral, pero eso déjalo
> pendiente.»

Y al ver el resultado:

> «Estoy viendo lo que estás haciendo y me gusta, pero me gustaría que el mapa sea un poco más
> grande porque para que sea un poco más realista […] respecto al personaje. Y sabes, tal vez para
> hacer que otra gente se enfoque específicamente en toda esa solicitud, en detallar al máximo todo
> el entorno y en directamente a nutrir todo de interacción, feedback y demás, […] me gustaría que
> dejaras todos los hallazgos, todas las referencias y todo en un documento listo para otro agente
> nuevo.»

**Lo que te toca, en orden:**

1. **Agrandar el mapa** para que la escala sea más realista respecto al personaje (§6). «Un poco
   más grande» es vago: propón una escala con capturas y confírmala con el usuario antes de
   rehacer todo.
2. **Detallar el entorno al máximo**, fiel al centro real (§7).
3. **Nutrirlo de interacción y feedback** (§8).
4. **Pendiente, no ahora:** entrar a la Catedral (será otro mapa con su portal, como el Café). Su
   puerta hoy es una placa que dice «pronto se podrá entrar».

**Lo que el usuario valora (visto en la sesión):** fidelidad al lugar real, respaldada por
investigación y no de memoria; cosas que se usan (sentarse, leer); ver avances con capturas.
Aprobó desplegar a producción al terminar la Fase 9 («una vez que termine, se despliega
directamente en la producción»). Esa aprobación fue para aquel trabajo: **pregúntale antes de
desplegar lo tuyo.**

---

## 2. Estado al cerrar esta sesión

- **Fases 0–9 del plan: hechas.** La Fase 9 (alpha cerrada: la caseta, invitaciones, suspensiones
  con fin, observabilidad, carga medida) y la Plaza v2 están **en producción**
  (`https://wous.logidma.com`) y en staging (`https://wous-staging.logidma.workers.dev`).
- **Todo está en la rama `claude/woz-workers-analysis-my1k8g`, PR #1 de `DavisMtz/Wous`, sin
  fusionar a `main` todavía.** Si el PR ya se fusionó, parte de `main` en una rama nueva; si no,
  parte de esa rama (o pídele al usuario que lo fusione primero). `main` no tiene la Plaza v2.
- **Producción tiene registro solo por invitación.** Las invitaciones se crean en la caseta
  (`/caseta`), y el rol de la caseta solo lo da el script
  `node scripts/moderacion/moderar.mts <entorno> dar-caseta @usuario --motivo "…"` (nunca la web).
- `pnpm test` en verde: worker 184, contratos 38, world-data 19, game-core 14, web 38. E2E de la
  Plaza, portales, multijugador, charla y caseta en verde (ver §3 para correrlos en la nube).

---

## 3. Arranque en un contenedor nuevo

El repo pide **Node 24** y **pnpm 12.6** (`packageManager`). En la nube el contenedor trae Node 22.

```bash
# Node 24 (si `node --version` no es 24.x): bájalo y ponlo primero en el PATH.
curl -fsSL https://nodejs.org/dist/v24.21.0/node-v24.21.0-linux-x64.tar.xz | tar -xJ -C "$HOME"
export PATH="$HOME/node-v24.21.0-linux-x64/bin:$PATH"
corepack enable pnpm            # o usa el pnpm que ya traiga el contenedor
pnpm install

# Worker local: secretos de desarrollo (cualquier valor largo sirve en local).
cp apps/worker/.dev.vars.example apps/worker/.dev.vars   # y rellena; el Turnstile de prueba está ahí
pnpm db:migrate:local
pnpm dev                          # Worker :8787 + Vite :5173

# E2E en la nube: sin Chrome instalado, apunta al Chromium del contenedor.
export WOUS_CHROMIUM=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome | head -1)
pnpm --filter @wous/e2e exec playwright test tests/plaza.spec.ts --project=escritorio --workers=1

# Referencias (fotos de Commons + OSM) a carpetas ignoradas por git.
node scripts/plaza/referencias.mts
```

**Herramientas de esta carpeta:**

| Comando | Para qué |
| --- | --- |
| `node scripts/plaza/validar.mts` | `validateWorld` + tamaño, objetos, asientos y tiempo de la rejilla, en segundos |
| `node scripts/plaza/osm.mts --escala 1.4 --svg plano.svg --json elementos.json --con-mapa` | El OSM real en tiles a la escala que pidas, con rejilla; `--con-mapa` encima la Plaza de hoy escalada |
| `node scripts/plaza/referencias.mts` | Baja las 27 fotos y el extracto de OSM |
| `node e2e/scripts/captura.mjs "<url>" salida.png 1400 900` | Captura del juego (usa `WOUS_CHROMIUM` si existe) |

**El banco de la Plaza** (solo desarrollo, sin sesión ni servidor):
`http://localhost:5173/dev-plaza.html?quieto&en=x,y&zoom=N` pone a la persona en cualquier punto
(tiles) con zoom fijo; `zoom=1` y una ventana de 1664×784 muestran el mapa entero. `?spawn=desde-cafe`,
`?mapa=cafe`. Ahí también se sienta uno y se leen las placas sin servidor. El juego expone
`window.__wousJuego` (posición, sala, remotos…) solo en desarrollo.

**Tiempos de referencia en la nube:** las pruebas de world-data, menos de un segundo; un E2E de la
Plaza con el banco, ~7 s; `portales.spec.ts`, ~70 s; las del worker (en workerd) son las que más
tardan.

---

## 4. Cómo está hecha la Plaza

La regla de fondo (§1 del plan): **el servidor es autoritativo** y los datos del mapa son la única
fuente. El mismo `@wous/world-data` lo usan la sala (colisión, asientos, puertas) y el cliente
(dibujo). Cambiar el mapa cambia a la vez lo que se ve y lo que choca.

### 4.1 Datos: `packages/world-data`

- `src/types.ts` — el esquema. `MapDef` = `width`/`height` (tiles), `cellsPerTile`, `ground`
  (un `GroundKind` por tile), `objects`, `spawns`, `defaultSpawn`, `portals`, `seats`, `signs`,
  `cameraZones`, `paint` y `version`.
  - `GroundKind`: `fachada`, `azotea`, `calle`, `seto`, `pared` bloquean (`BLOCKING_GROUND`);
    `banqueta`, `enlosado` (Plaza de Armas), `losa` (atrio), `explanada` (Melchor Ocampo),
    `empedrado` (Allende), `portal`, `ladrillo`, `pasto`, `duela`, `mosaico` se pisan.
  - `paint`: formas (`rect`, `circle`, `path` con ancho, `polygon`) que el cliente rasteriza por
    pixel. Solo `jardin` (pasto con reja baja) estorba; en cada celda manda la última forma que la
    cubre (un andador pintado encima de un jardín lo abre). La `cebra` solo va sobre `calle`.
  - `MapObject`: huella en tiles (acepta fracciones) + `kind` + `variant` + `solid` opcional
    (rectángulos o círculos relativos a la huella). Sin `solid`, estorba toda la huella, salvo los
    de `NON_SOLID` (`papel-picado`, `tapete`, `focos`, `comercios`, `chorros`); `solid: []` = se pisa.
  - `Seat`: pies, `facing`, `exit` (donde se queda de pie), `object`, `lift` (px que sube el dibujo).
  - `Sign`: punto, `reach`, `label` del botón, `title` y párrafos. Lo muestra el cliente; no pasa
    por la sala.
  - `CameraZone`: rectángulo donde la cámara sube `lookUp` tiles (frente a la Catedral).
- `src/index.ts` — `buildCollisionGrid`, `collisionGrid` (cache), `canReachPortal/Seat/Sign`,
  `nearestInteraction` (lo más cercano entre puerta, asiento libre y placa), `walkableFrom`
  (malla cada ¼ de tile) y **`validateWorld`**: IDs únicos, objetos dentro, spawns donde se puede
  estar, sólido dentro de la huella, asientos con salida pisable a ≤ 1.6, formas sobre suelo
  pisable, y **que desde el spawn por defecto se llegue a pie a cada spawn, puerta, asiento y
  placa** (una reja sin portón rompe la prueba).
- `src/maps/plaza.ts` (≈930 líneas) — la Plaza v2. Helpers: `banca(id, x, y, mira)`, `cubo`,
  `lugaresDe` (los asientos de cada banca), `fuente`, `bordeDeFuente`, `arbol`, `farol`,
  `pilastra`, `jacaranda`, `reja`, `porton`, `edificio`, `nicho`. Constantes: `KIOSKO`,
  `KIOSKO_BASE`, `ANILLO`, `EJE`, `JARDIN`, `FUENTES`, `PORTAL_X`, `PUERTA_CAFE`.
- `src/maps/cafe.ts` — el Café (v3): 22×15, `cellsPerTile` 1, sus 8 sillas son asientos.

### 4.2 Colisión y movimiento: `packages/game-core`

- `CollisionGrid` con `cellsPerTile` (4 en la Plaza: celdas de 4 px). **`isBlocked` recibe celdas,
  no tiles.** `blockRect` (fracciones, por centro de celda) y `blockWhere` (función en tiles).
- Huella de los pies: 0.6 × 0.32 tiles; 4.2 tiles/s; pasos de ≤ ¼ de tile, eje por eje (se
  desliza por las paredes). Cliente y servidor corren el mismo código.

### 4.3 Servidor: `apps/worker`

- `durable-objects/RoomDO.ts` — la sala (Hibernation, ADR-0008). `SIT { seatId }` / `STAND {}`
  (contratos en `packages/contracts/src/websocket/messages.ts`): el asiento existe en su mapa, lo
  alcanzas (`SEATS.reach` 1.3 al asiento o a su salida) desde donde la sala te tiene, está libre
  (tampoco lo tiene un fantasma) y no insistes antes de 300 ms. Errores `SEAT_NOT_FOUND`,
  `SEAT_TAKEN`, `SEAT_NOT_REACHABLE`. Un input con movimiento levanta en la salida.
- Fantasmas (ADR-0009): quien se desconecta guarda su lugar 30 s. **`lugarValido`** revisa el lugar
  heredado contra el mapa actual: si una versión nueva lo dejó dentro de algo sólido (o el asiento
  ya no existe), la persona entra por el spawn. Con eso, cambiar el mapa en caliente es seguro.
- `world/players.ts` — el attachment (≤ 2048 bytes): posición, intención, `st` (asiento).
- Capacidad por sala: 35 suave, 45 dura (`ROOM_CAPACITY`); medida con carga (docs/carga).

### 4.4 Cliente: `apps/web`

- `game/phaser/world-scene.ts` — arma la escena: **el suelo entero es UNA textura**
  (`paintGround(map)`, 1664×784 px hoy) y cada objeto es su propia textura con `depth` = línea de
  sus pies (lo que pisa más abajo se dibuja encima); los `occluder` se vuelven translúcidos si te
  tapan. Zoom entero de 2 a 6 según el viewport (`layoutCamera`). Encuadres (`lookUp`) con
  suavizado. Acciones: `nearestInteraction` → botón «E» (o la estrella en táctil) → portal, sentarse,
  levantarse o placa.
- `game/world-art/` — **todo el arte es código** (ADR-0007): canvas a 1×, ruido determinista.
  - `paint.ts` (pincel, `hash`, letreros de 3×5), `world-palette.ts` (paletas; varias salen de la
    investigación), `ground.ts` (materiales por pixel, guarniciones, reja baja de jardines,
    sombras horneadas), `objects.ts` (despacho por `kind`/`variant`, profundidad, sombras).
  - `catedral.ts` (canvas 320×528 para la huella de 20×25), `morelia.ts` (portales, comercios y el
    Café, casas, reja y portones, kiosko, fuentes de taza, estatua de Juárez, placa, bancas,
    laureles, fresnos, faroles), `plazas.ts` (monumento de Ocampo, fuentes danzantes, asta,
    jardineras, macetones, faroles de campana, pilastras, fuente de columna, globero, churros,
    losa de los Liberales), `interior.ts` (el Café).
- `game/phaser/persona.ts` y `game/rendering/pixel-character.ts` — el personaje 16×32 y su pose
  sentada (`SIT_FRAME`, piernas en `sprite-maps.ts`). `game/network/room-state.ts` interpola a los
  demás (sentarse es un salto, no un deslizamiento). `app/plaza/Placa.tsx` muestra las placas.

### 4.5 Pruebas que dependen de coordenadas (a revisar si cambias el mapa)

- `packages/world-data/test/world.test.ts` — casi todas: bloqueos por punto, rutas a pie, asientos,
  placas, kiosko, Ocampo.
- `apps/worker/test/world-core.test.ts` (subir desde la entrada choca con la escalinata),
  `world-socket.test.ts` («las paredes del mapa»: bajo el portal del Café), `world-portals.test.ts`
  (spawn `desde-cafe`, `mapVersion`), `world-seats.test.ts` (lugar guardado dentro de la Catedral).
- `apps/web/test/red.test.ts` (IDs de asientos).
- `e2e/tests/plaza.spec.ts` (banca en `?en=76,43.2`, placa UNESCO, puerta de la Catedral),
  `portales.spec.ts` (ruta a pie al Café), `multijugador.spec.ts` (caminar 0.8 s hacia arriba).
  **Caminar en E2E:** soltar una tecla tarda (sin GPU, casi un tile); `caminarHasta` de
  `portales.spec.ts` camina a toquecitos midiendo, y cada tramo pide la holgura de su pasillo.
  Diseña las rutas por pasillos de ±0.6 tiles o más.

---

## 5. El mapa hoy (Plaza v2)

**Orientación (ADR-0013):** la vista mira **al sur desde Madero** (el mapa real girado 180°). La
fachada de la Catedral, que da al norte, queda de frente; la Plaza de Armas (poniente) a la
derecha; la Melchor Ocampo (oriente) a la izquierda; la calle Allende (sur) arriba con sus
portales; Madero (norte) abajo.

**Escala medida:** ≈ **2.8 m por tile** en ambos ejes, ajustada a mano sobre el OSM (± 2 tiles).
`scripts/plaza/osm.mts` reproduce esa transformación: `x = (93.9 − este) / escala`,
`y = (68.2 − sur) / escala`, en metros de una proyección local centrada en la Catedral
(19.70225, −101.19231).

**Bandas de izquierda a derecha (x):** azoteas 0–1 · Morelos (calle) 2–3 · banqueta 4 · Melchor
Ocampo 5–21 · reja del atrio 22.25 · Catedral 24–44 · atrio poniente 44–55.5 · reja poniente 55.5
(del sur hasta la mitad) · andador Juárez 56–68 (arriates de laureles en 57.8 y 62.8) · Plaza de
Armas 69–99 (jardín cercado 71.5–95.5) · banqueta 99 · Abasolo (calle) 100–101 · azoteas 102–103.

**De arriba abajo (y):** fachadas de Allende 0–6 (con portales en x 56–99, andador cubierto en
y 5–6) · banqueta 7 · empedrado 8–9 · banqueta 10 · plazas 11–44 (el atrio es `losa` 11–41; su
reja norte en y 41.5 con tres portones) · banqueta de Madero 45 · Madero (calle) 46–48.

| Qué | Dónde (tiles) |
| --- | --- |
| Spawn `entrada` | (34, 39.9), en el atrio frente a la puerta mayor, mirando arriba |
| Puerta del Café (portal `plaza-cafe`) | (72.875, 5.1), alcance 1.4; spawn `desde-cafe` (72.875, 5.75) |
| Catedral (huella) | x 24–44, y 11–36; placa `puerta-catedral` en (34, 36.4) |
| Portones de la reja norte | x 25.5–28, 32.5–35.5 (mayor), 40–42.5; oriente y 20–22.5; poniente y 28.5–31 |
| Kiosko | base en (83.5, 30.6), r 2.55; jardinera r 3.6; andadorcito a su puerta; placa en (83.5, 33.6) |
| Fuentes de la Plaza de Armas | (76.06, 20.58), (90.94, 20.58), (76.06, 37.32), (90.94, 37.32); r 1.4 |
| Fuente de columna (andador Juárez) | (61, 41.6), r 1.3 |
| Estatua de Juárez / placa | (61, 13.4) / (61, 14.9) |
| Placa de la UNESCO | (66.1, 44.0) |
| Monumento a Ocampo | huella (9.5, 15) 4×3; placa en (11.5, 18.7); dos lugares en su orilla |
| Fuentes danzantes | (9.5, 36.5) 4×4, se pisan |
| Losa de los Liberales | (5.5, 18.3), se pisa; placa en (6.3, 18.9) |
| Asta bandera | (14, 27) |
| Encuadre de la Catedral | x 22–56, y 33–46, sube 6 tiles |

Números: 163 objetos, 74 asientos, 6 placas, 1 puerta. Rejilla de 416×196 celdas (2 ms).

**Ruta a pie de la entrada al Café** (la de `portales.spec.ts`; direcciones de pantalla): a la
derecha hasta x 49 por el atrio, hacia arriba por el atrio poniente (sin reja de ese lado, como la
real) hasta el empedrado de Allende (y 8.5), a la derecha hasta x 72.875 y arriba hasta la puerta.
Ojo con el giro: en pantalla, derecha = poniente, izquierda = oriente, arriba = sur, abajo = norte.

---

## 6. Tarea 1 · Agrandar el mapa

### El problema, medido

- El personaje mide 16×32 px (ADR-0007): ~1.7 m en 2 tiles → **a escala de persona, 1 tile ≈ 0.85 m**.
- El trazo va a **2.8 m por tile**: el mundo está **~3.3× comprimido** respecto a quien camina.
  Una Catedral de 55 × 78 m ocupa 20 × 25 tiles, que a escala de persona serían 17 × 21 m.
- El mobiliario (bancas de 2 tiles, faroles, cubos) ya está a escala de persona; lo que se ve
  «chico» es la arquitectura y las distancias.

### Opciones (salen de `node scripts/plaza/osm.mts --escala …`)

| m por tile | × hoy | Mapa (tiles) | Suelo (px) | Catedral (tiles) | Kiosko | Plaza de Armas |
| --- | --- | --- | --- | --- | --- | --- |
| 2.8 (hoy) | 1× | 104 × 49 | 1664 × 784 | 19.5 × 27.9 | 4 × 4 | 27.8 × 34.6 |
| 2.0 | 1.4× | 146 × 69 | 2336 × 1104 | 27.3 × 39.1 | 5.7 | 38.9 × 48.4 |
| 1.87 | 1.5× | 156 × 73 | 2496 × 1168 | 29.2 × 41.8 | 6.1 | 41.6 × 51.8 |
| **1.4** | **2×** | **208 × 98** | **3328 × 1568** | **38.9 × 55.8** | **8.1** | **55.5 × 69.1** |
| 1.12 | 2.5× | 260 × 122 | 4160 × 1952 | 48.7 × 69.8 | 10.1 | 69.4 × 86.4 |
| 1.0 | 2.8× | 291 × 137 | 4656 × 2192 | 54.5 × 78.2 | 11.3 | 77.8 × 96.8 |
| 0.85 | 3.3× (escala de persona) | 343 × 161 | 5488 × 2576 | 64.1 × 91.9 | 13.3 | 91.5 × 113.9 |

**Recomendación:** empezar por **2× (1.4 m por tile)** y confirmarlo con el usuario con capturas del
banco antes de rehacer todo. Es «un poco más grande» y se nota. La escala de persona completa
(3.3×) deja una plaza enorme y vacía para 35–45 personas por sala, y torres de más de 1000 px que
nunca caben en pantalla. Entre 2× y 2.5× está el punto medio. Mantén las alturas un poco
exageradas respecto al piso (como hoy): en 3/4 cenital se lee mejor.

### Qué crece y qué no

- **Crece con el factor:** la huella de la Catedral y su arte, el atrio, la reja y sus tramos, el
  kiosko y su jardinera, las fuentes (radio), los jardines, los andadores, las calles, los portales
  (arcos de ~3.5–4 m: con 1.4 m/tile, un arco cada 2.5–3 tiles, casi igual que hoy), las casas.
- **No crece (ya está a escala de persona):** bancas, cubos, faroles, pilastras, placas, puestos,
  macetones, la persona. Lo que sí cambia es **cuántos** caben: con el doble de espacio hacen falta
  más bancas, árboles y faroles. Usa los 114 árboles reales del OSM (`--json`) como guía.

### Cómo hacerlo (plan técnico)

1. **ADR-0014** antes de tocar nada (§38): escala nueva, textura de suelo en trozos, versión 3 del
   mapa. Cita ADR-0007 y ADR-0013.
2. **Suelo en trozos.** Hoy `paintGround` pinta UNA textura; más de 2048 px de lado no entra en la
   GPU de muchos teléfonos. Parte el suelo en trozos de ≤ 1024 px (o 2048), cada uno su textura
   (`suelo:plaza:3:i:j`) con `depth` −10, y pinta solo lo que se necesita (o todo al entrar, si se
   mide que cabe en tiempo). `materialBuffer` ya trabaja por pixel: se puede acotar a una región.
   Mide el tiempo de pintado en un teléfono modesto (hoy 1.3 Mpx; a 2× son 5.2 Mpx).
3. **Retrazar con el OSM:** `node scripts/plaza/osm.mts --escala 1.4 --svg plano.svg --json
   elementos.json --con-mapa`. El SVG trae la rejilla cada tile (marcas cada 5 y 10) y, en rojo,
   la Plaza de hoy escalada: sirve para ver qué se descuadra. Reescribe `plaza.ts` con constantes
   derivadas de la escala (no números sueltos), versión 3.
4. **Arte que crece:** `catedral()` está dibujada para 20 tiles de ancho (canvas 320×528). Hay que
   dibujarla para la huella nueva (parametrízala por ancho o redibújala). Lo mismo el kiosko
   (hoy 112×216 px para 6 tiles), `portal(w)` y `comercios(w)` (ya aceptan ancho),
   `fuenteDeTaza(r)` y `fuenteDeColumna(r)` (ya aceptan radio), `edificio(w)`.
5. **Cámara:** el zoom entero (2–6, `layoutCamera`) sigue igual; revisa el encuadre de la Catedral
   (`cameraZones`, `lookUp`) para que se vean las torres, y `LOOK_MARGIN_TILES`.
6. **Servidor:** nada cambia en el protocolo. La rejilla a 2× son 832×392 celdas (bien) y
   `validateWorld` sigue en milisegundos. Sube `version` (los clientes con el mapa viejo recargan
   al entrar) y confía en `lugarValido` para los fantasmas.
7. **Pruebas:** todas las de §4.5. Rehaz las rutas de E2E con pasillos anchos.
8. **Revisión visual:** capturas del banco con `zoom=1` (mapa entero) y `zoom=2`/`3` por zonas;
   compáralas con las fotos (`docs/plaza/referencias/`).

---

## 7. Tarea 2 · Detallar el entorno

Qué ya está (v2 + pase de fidelidad) y qué falta, según `investigacion.md`.

**Ya está:** Catedral con torres, relojes, cúpula de azulejo en rombos, bóvedas rojas, puerta
mayor con reja; reja del atrio con portones de copete y jarrones; atrio de cantera clara; Plaza de
Armas con kiosko octagonal (base gris con tableros y puertita, columnas torsas y barandal negros,
techo de lámina con crestería, plafón miel), jardinera cercada, cuatro fuentes de taza de cantera
gris, jardines con reja baja verde, ejes y diagonales, laureles podados en bloque (lima, tronco
encalado), fresnos, pilastras-farol en las entradas y en fila por la orilla; andador Juárez con sus
hileras de laureles, bancas, estatua, fuente de columna y placa de la UNESCO; Melchor Ocampo con
explanada gris y retícula, monumento a Ocampo, fuentes danzantes, bancas-cubo y macetones junto a
la reja, jardineras con bugambilias y naranjos, postes de faroles de campana, asta con la bandera,
jacarandas, globero, carrito de churros y la losa de los Liberales; portales de Allende (aplanado
crema, arcos de cantera, balcones negros) con comercios y el Café; casas de dos pisos; Madero con
doble raya amarilla, boyas y cebras.

**Falta o se puede mejorar (con la sección de `investigacion.md` que lo describe):**

- **Catedral (§1):** la torre oriente con los cuerpos altos **salmón** (hoy iguales); portadas
  laterales (Guadalupe al oriente, San José al poniente) con relieves; muros de las naves con
  óculos, ventanas enrejadas y faroles de pared; el anexo blanco con marcos rojos junto a la torre
  oriente y su cupulita; las **esculturas de los mártires** adosadas al muro del lado de la Plaza
  de Armas, cada una en su corralito de reja; faroles de brazo en los pilares de los portones
  (4 al frente); escalones del atrio.
- **Plaza de Armas (§2):** el **anillo de bancas curvas con respaldo calado de óculos** alrededor
  del kiosko; **bancas de hierro fundido verde botella** bajo los laureles del andador; la reja de
  la jardinera del kiosko es **negra** (hoy sale verde, como la de los jardines); luminarias
  empotradas junto a las fuentes; liquidámbar entre los árboles; cenefas de flores por temporada.
- **Portales (§3):** faroles hexagonales colgantes (se quitaron porque tapaban los letreros: hay
  que acomodarlos); las **mesas de café bajo los arcos** (mesas de madera clara y sillas); nombres
  reales como referencia (el OSM trae Café Michelena, la Churrería, una nevería, farmacias; ver
  `--json`). El Portal Allende es el tramo de Abasolo a Hidalgo; al oriente sigue el Aldama.
- **Madero (§5.2):** los postes son **negros, altos, de doble brazo con faroles de globo blanco**
  (hoy son de tres linternas); guarniciones amarillas.
- **Melchor Ocampo (§4):** el hotel Los Juaninos y las casas del lado de Morelos (hoy solo
  azoteas); los faroles altos de doble brazo con globos.
- **Ambiente (§2.9, §6):** palomas; boleros; elotes con sombrilla roja; gazpacho detrás de la
  Catedral; la Danza de los Viejitos los sábados; el tranvía turístico.
- **Lo que no se pudo confirmar (§9 de la investigación):** de qué lado sube la escalera del
  kiosko (hoy no se dibuja), si Madero tiene camellón físico en 2026, si los toldos siguen
  iguales, el color actual del Portal Allende, si las letras «MORELIA» son permanentes. No
  inventes: si algo no se confirma, no se dibuja o se dice en la placa.

---

## 8. Tarea 3 · Interacción y feedback

Hoy se puede: caminar con colisión fina, **sentarse** en 74 lugares (y en las 8 sillas del Café),
**leer 6 placas**, entrar al Café. En táctil, la acción es la estrella del HUD; con teclado, «E».

Reglas para lo nuevo: si otros lo ven, pasa por la sala (contrato en `@wous/contracts`, validación
en ambos lados, límite de ritmo, prueba de integración). Si es solo ambiente (palomas, agua,
campanas), puede ser del cliente, determinista por la hora del servidor. **Nada de economía** (el
plan la deja para después del MVP: comprar churros no), ni NPCs con IA (§29), ni cosas «ya que
estamos» (§29). No hay sistema de audio: agregarlo pide ADR (assets en R2, silencio por defecto,
políticas de autoplay, botón de mute).

**Ideas, de más a menos valor:**

1. **Mesas del café bajo los portales**, con sus sillas como asientos (como las del Café). Es de
   lo más característico del lugar.
2. **Más lugares para sentarse:** toda la orilla de las fuentes (no solo el frente), los escalones
   del atrio, las bancas curvas del kiosko, los bordes de las jardineras.
3. **Agua viva:** las fuentes animadas (el borbotón, la copa que rebosa) y las **fuentes
   danzantes** que se prenden y apagan (en la realidad, dos turnos de ~3 h); pisar los chorros
   salpica. Hoy todo es estático.
4. **Palomas** en el piso y las cornisas, que vuelan al acercarte (solo cliente).
5. **Feedback de interacción:** resaltar lo que está al alcance (contorno o flechita sobre la
   banca/placa), pose de sentarse con una transición corta, polvito o salpicadura al caminar por
   cada material.
6. **Día y noche con la hora de Morelia** (la del servidor): faroles que se encienden, la Catedral
   iluminada.
7. **Eventos del calendario:** campanadas cada hora (visual si no hay audio), **«Luces de
   Catedral» los sábados a las 21:00** (se apaga todo, luces y fuegos artificiales), adornos de
   temporada (septiembre: banderas; noviembre: catrinas y cempasúchil; diciembre: nochebuenas).
8. **Vendedores con pregón** en burbuja («¡Churros calientitos!») al acercarte (sin comprar).
9. **El kiosko como escenario:** poder subir (necesita saber de qué lado está la escalera y un
   segundo nivel de piso: ADR).
10. **Cruzar Madero por las cebras** (hoy la calle bloquea): pide diseño (¿coches?).

---

## 9. Hallazgos de la investigación (resumen)

Todo con fuentes en `docs/plaza/investigacion.md`. Lo esencial:

- Todo es **cantera rosa** (beige rosado al sol, malva en sombra); desde arriba, los techos de la
  Catedral son **rojo terracota** con pretiles claros.
- **La fachada de la Catedral mira al norte, a Madero**, no a una plaza: por eso el mapa está
  girado 180°. Plaza de Armas al poniente, Melchor Ocampo al oriente.
- Torres de **62 m (66 con las cruces)**: fuste liso ~43 %, cuerpo cuadrado con reloj, cuerpo
  octagonal, linternilla con cupulín de gajos, cruz. Cúpula del crucero con **azulejo azul y blanco
  en rombos**.
- **Reja atrial** de hierro (1854) con 8 portones de pilares de cantera con jarrones y **copete
  semicircular con medallón**; tres dan a Madero.
- **Plaza de Armas (de los Mártires):** kiosko octagonal de hierro fundido de **1887**, caminos
  diagonales, 4 fuentes de tazón de cantera gris, **laureles de la India podados en bloque con el
  tronco encalado** (la firma visual número uno), pilastras-farol en pares en las entradas.
- **Melchor Ocampo:** explanada de losas grises con retícula de bandas oscuras; estatua de bronce
  (1888, Primitivo Miranda) sobre dado oscuro; **la fuente norte se quitó en 2008** y hay chorros
  a ras de piso; **el Árbol de los Liberales ya no existe** (queda una losa con la frase de Ocampo:
  «Ser liberal en todo cuesta trabajo porque se requiere ser hombre en todo», según Quadratín,
  2022); asta bandera muy alta; bugambilias.
- **Portales** (fichas del IMPLAN): Allende al sur (de Abasolo a Hidalgo, aplanado crema), Aldama
  su continuación, Hidalgo y Galeana al norte de Madero (toldos verdes festoneados), Matamoros al
  poniente sobre Abasolo (toldos guinda del Virrey de Mendoza).
- **Madero:** ~4 carriles, doble raya amarilla con boyas, cebras; se cierra los domingos y el sábado
  en la noche.

---

## 10. Referencias

- `docs/plaza/investigacion.md` — la investigación completa: rasgos esenciales, paleta de ~40
  colores con hex, cada zona en detalle, proporciones para el sprite, catálogo de fotos (§7),
  fuentes (§8) y dudas abiertas (§9).
- `docs/plaza/referencias.json` — las 27 fotos (Wikimedia Commons: página, autor, licencia,
  encuadre) y el extracto de OSM (bbox, URL, licencia).
- `node scripts/plaza/referencias.mts` — baja todo a `docs/plaza/referencias/` y
  `docs/plaza/osm/` (**ignoradas por git**). Las fotos son CC BY-SA / dominio público: se usan para
  dibujar, no se suben al repo. El OSM es © OpenStreetMap contributors (ODbL). El recorte de
  satélite (Esri) que se consultó no se guarda: su licencia no lo permite.
- Las fotos más útiles: `catedral_fachada_norte_frontal.jpg` (proporciones de la fachada),
  `plaza_armas_kiosco.jpg`, `plaza_armas_andador_ficus_bancas_cantera.jpg`,
  `plaza_melchor_ocampo_explanada.jpg`, `catedral_y_plaza_melchor_ocampo_estatua.jpg`,
  `portal_cafe_mesas_bajo_arcos.jpg`, `vista_alta_centro_desde_poniente.jpg`.

---

## 11. Reglas del repo que aplican aquí

- Lee `CLAUDE.md` completo: reglas no negociables, trampas del entorno y cómo se trabaja.
- **Cambio estructural = ADR** en `docs/adr/` (§38). La escala nueva lo es.
- Textos, comentarios y commits **en español**, con el tono del repo (`feat(plaza): …`,
  `fix(sala): …`). La interfaz no depende de hover; el juego solo recibe `GameInput` normalizado.
- Cada cambio de mapa: `validateWorld` en verde, versión del mapa arriba, pruebas de §4.5
  actualizadas, capturas revisadas.
- Antes de cada commit: `pnpm typecheck`, `pnpm lint` (`pnpm exec biome check --write .`),
  `pnpm test`, `pnpm build`, y `git status` sin archivos de secretos. **El repo es público.**
- Heredocs largos en Bash se truncan: los archivos se escriben con la herramienta de escritura.

---

## 12. Desplegar (solo con el visto bueno del usuario)

- Staging: `pnpm build`, luego en `apps/worker`: `wrangler d1 migrations apply DB --remote --env
  staging` (solo si hay migraciones nuevas) y `wrangler deploy --env staging`. Producción, igual
  con `--env production`. Sin `secrets.*.json`, `wrangler deploy` hereda los secretos declarados.
- Las credenciales de Cloudflare no están en el repo: las da el usuario (`CLOUDFLARE_ACCOUNT_ID`,
  `CLOUDFLARE_API_TOKEN` en el entorno). No las escribas en archivos del repo ni en logs.
- Verificar después: `/api/v1/health` (migraciones y secretos), `/api/v1/config` (registro por
  invitación), `/api/v1/admin/*` en 404 sin rol, y que el chunk de la Plaza nueva se sirve.
- Un mapa con versión nueva hace recargar a quien tenga el viejo; los lugares guardados que ya no
  caben entran por el spawn (`lugarValido`).
- La prueba de carga (`scripts/carga/carga.mts`) necesita el `SESSION_PEPPER` de staging. Se
  cambió en esta sesión y el valor no quedó en ningún lado (ni en el repo ni lo tiene el usuario):
  si hace falta, genera uno nuevo y súbelo con `wrangler secret bulk` (nunca `secret put` por
  tubería). Cambiarlo cierra las sesiones de staging, que es de pruebas.

---

## 13. Pendientes y deuda conocida

- El suelo es una sola textura: tope de ~2048 px por lado (ver §6).
- Todo es estático: agua, chorros, bandera, árboles.
- La reja de la jardinera del kiosko sale verde (la real es negra): `paintFences` no distingue.
- Los faroles colgantes de los portales se quitaron; hay que volver a ponerlos sin tapar letreros.
- Del otro lado de Madero (Palacio de Gobierno, portales Hidalgo y Galeana) y de Abasolo (Portal
  Matamoros) no se ve nada: la cámara mira al sur y esos frentes dan la espalda.
- La Catedral no se abre: la sala interior será otro mapa con su portal (como el Café).
- La frase de la losa de los Liberales viene de la prensa (Quadratín, 2022): si encuentras una
  fuente primaria (foto de la losa), confírmala.

---

## 14. Prompt para el chat nuevo

Pégalo tal cual (ajusta la rama si el PR #1 ya se fusionó):

```text
Vas a continuar la Plaza de Wous: el centro histórico de Morelia (la Catedral con la Plaza de Armas
y la Plaza Melchor Ocampo). Repo DavisMtz/Wous; si el PR #1 ya está fusionado, trabaja desde main
en una rama nueva; si no, desde la rama claude/woz-workers-analysis-my1k8g.

Lee primero docs/plaza/HANDOFF.md completo (ahí está todo: lo que pedí, cómo está hecho, la
investigación, las referencias y el plan), después CLAUDE.md, las secciones del plan que ahí se
indican y los ADR 0007 y 0013.

Lo que quiero, en orden:
1. Que el mapa sea más grande, más realista respecto al personaje. Propón la escala con capturas
   antes de rehacer todo (el documento recomienda empezar en 2×).
2. Detallar el entorno al máximo, fiel al lugar real, con las referencias del documento.
3. Llenarlo de interacción y feedback.
Entrar a la Catedral queda para después.

Enséñame avances con capturas. Antes de desplegar a producción, pregúntame.
```
