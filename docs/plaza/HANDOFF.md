# La Plaza de Morelia · relevo para quien sigue

Documento para el agente que continúe la Plaza de Wous en un chat nuevo. Reúne lo que se pidió, lo
que ya existe, cómo está hecho, lo que se encontró investigando el centro de Morelia, las
referencias y un plan para lo que falta. Escrito el 27 de septiembre de 2026, al cerrar la sesión
que hizo la Plaza v2; actualizado el 28 por la sesión que la hizo al doble (Plaza v3, ADR-0014).

**Orden de lectura sugerido:** este documento completo → `CLAUDE.md` → `PLAN_CONSTRUCCION_WOUS.md`
(§1, §13–17, §25, §34, §36–38) → `docs/adr/0007-escala-y-arte-procedural.md` →
`docs/adr/0013-plaza-de-morelia-asientos-y-placas.md` →
`docs/adr/0014-plaza-al-doble-y-suelo-en-trozos.md` → `docs/plaza/investigacion.md` (larga:
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

1. ~~**Agrandar el mapa**~~ **hecho** (§6): se le mostró una maqueta con capturas a 1.5×, 2×,
   2.5× y 3× y eligió **2×** (1.4 m por tile, ADR-0014).
2. **Detallar el entorno al máximo**, fiel al centro real (§7): **hecho un pase grande** en la
   sesión v3; lo que falta está en §7.
3. **Nutrirlo de interacción y feedback** (§8): **hecho en buena parte** (agua viva, palomas,
   pregones, campanadas, noche y Luces de Catedral); lo que sigue está en §8.
4. **Pendiente, no ahora:** entrar a la Catedral (será otro mapa con su portal, como el Café). Su
   puerta hoy es una placa que dice «pronto se podrá entrar».

**Lo que el usuario valora (visto en la sesión):** fidelidad al lugar real, respaldada por
investigación y no de memoria; cosas que se usan (sentarse, leer); ver avances con capturas.
Aprobó desplegar a producción al terminar la Fase 9 («una vez que termine, se despliega
directamente en la producción»). Esa aprobación fue para aquel trabajo: **pregúntale antes de
desplegar lo tuyo.**

---

## 2. Estado al cerrar esta sesión

- **Fases 0–9 del plan: hechas.** El PR #1 ya se fusionó a `main`.
- **La Plaza v3 (el doble de grande, ADR-0014) está en producción** (`https://wous.logidma.com`)
  **y en staging** (`https://wous-staging.logidma.workers.dev`) desde el 28 de septiembre de 2026,
  con el visto bueno del usuario («Despliega a producción»). Salió del commit `1527528` de la rama
  `claude/plaza-wous-morelia-1j16v9` (PR #2): mientras ese PR no se fusione, `main` va detrás de
  lo desplegado.
- **Producción tiene registro solo por invitación.** Las invitaciones se crean en la caseta
  (`/caseta`), y el rol de la caseta solo lo da el script
  `node scripts/moderacion/moderar.mts <entorno> dar-caseta @usuario --motivo "…"` (nunca la web).
- En esa rama también: el pase de detalle (§7) y la interacción y el ambiente (§8), en commits
  aparte.
- `pnpm test` en verde: worker 184, contratos 38, world-data 26, game-core 14, web 49. E2E de la
  Plaza, portales y multijugador en verde con la v3 (ver §3 para correrlos en la nube).

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
pnpm build                        # una vez: el Worker local sirve apps/web/dist y sin él no arranca
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
| `node scripts/plaza/pasillos.mts y:96:80.6:20.5 x:20.5:96:145.875` | Holgura de cada tramo de una ruta a pie (cuánto puede ir corrido el E2E sin chocar) |
| `node e2e/scripts/pieza.mjs morelia bancaCurva '[…]' banca.png 8` | Una pieza del arte sola y ampliada (corre el código del juego en la página de desarrollo) |
| `node e2e/scripts/cuadros.mjs "<url sin ?quieto>" prefijo 4 150` | Capturas seguidas, para revisar lo que se mueve (agua, palomas, campanadas, fuegos) |
| `node scripts/plaza/referencias.mts` | Baja las 27 fotos y el extracto de OSM |
| `node e2e/scripts/captura.mjs "<url>" salida.png 1400 900` | Captura del juego (usa `WOUS_CHROMIUM` si existe) |

**El banco de la Plaza** (solo desarrollo, sin sesión ni servidor):
`http://localhost:5173/dev-plaza.html?quieto&en=x,y&zoom=N` pone a la persona en cualquier punto
(tiles) con zoom fijo; `zoom=1` y una ventana de 3328×1568 muestran el mapa entero; `?hora=HH:MM`
(y `?sabado`) fija la hora de Morelia del ambiente. `?spawn=desde-cafe`,
`?mapa=cafe`. Ahí también se sienta uno y se leen las placas sin servidor. El juego expone
`window.__wousJuego` (posición, sala, remotos…) solo en desarrollo.

**Tiempos de referencia en la nube:** las pruebas de world-data, menos de un segundo; un E2E de la
Plaza con el banco, ~7 s; `portales.spec.ts`, ~80 s (la ruta al Café es el doble de larga); las del
worker (en workerd) son las que más tardan.

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
  - `paint`: formas (`rect`, `circle`, `path` con ancho, `polygon`; `src/shapes.ts`) que el cliente
    rasteriza por pixel. Solo `jardin` (pasto con reja baja verde) y `jardinera` (pasto con reja
    negra de postes, la del kiosko) estorban (`BLOCKING_SHAPES`); en cada celda manda la última
    forma que la cubre (un andador pintado encima de un jardín lo abre). La `cebra` solo va sobre
    `calle`.
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
- `src/maps/plaza.ts` (≈1330 líneas) — la Plaza v3. Helpers: `banca(id, x, y, mira, material)`
  (cantera o hierro), `cubo`, `lugaresDe` (los asientos de cada banca), `fuente`, `bordeDeFuente`
  (frente y costados), `arbol(id, x, y, especie)` (laurel, fresno, liquidámbar, jacaranda, naranjo),
  `farol(id, x, y, tipo)` (linternas, campanas, globos), `pilastra`, `nicho`, `hilera`, `reja`,
  `porton`, `rejaConPortones`, `casa`, `portal`, `comercios`, `mesaDePortal`/`sillasDePortal`.
  El trazo son constantes con nombre sacadas del OSM a 1.4 m por tile (`CASAS_Y`, `PILARES_Y`,
  `ALDAMA`, `CERRADA`, `PORTAL_ALLENDE`, `REJA_*`, `CATEDRAL_HUELLA`, `KIOSKO`, `JARDIN`, `FUENTES`…).
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

- `game/phaser/world-scene.ts` — arma la escena: **el suelo va en trozos de 512 px**
  (`phaser/suelo.ts`, ADR-0014): los que se ven se pintan al entrar y los demás uno por cuadro con
  tope de 4 ms, del más cercano al más lejano (`groundPainter(map).paint(región)`); cada trozo es
  su textura `suelo:<mapa>:<versión>:<i>:<j>` y su `depth` los ordena (en el renderer de canvas,
  sin eso, quedaba una costura de 1 px). Cada objeto es su propia textura con `depth` = línea de
  sus pies (lo que pisa más abajo se dibuja encima); los `occluder` se vuelven translúcidos si te
  tapan. Zoom entero de 2 a 6 según el viewport (`layoutCamera`). Encuadres (`lookUp`) con
  suavizado. Acciones: `nearestInteraction` → botón «E» (o la estrella en táctil) → portal,
  sentarse, levantarse o placa.
- `game/world-art/` — **todo el arte es código** (ADR-0007): canvas a 1×, ruido determinista.
  - `paint.ts` (pincel, `hash`, letreros de 3×5), `world-palette.ts` (paletas; varias salen de la
    investigación), `ground.ts` (materiales por pixel y por región, calles con carriles según su
    tramo, guarniciones, rejas de jardines y de la jardinera, luminarias, sombras horneadas),
    `objects.ts` (despacho por `kind`/`variant`, cuadros de animación, profundidad, sombras),
    `relieve.ts` (pinta en 3/4 algo descrito por columnas de voxeles: la banca curva), `fauna.ts`
    (las palomas). Cada pieza puede declarar sus faroles (`Art.luces`) para la noche.
  - `catedral.ts` (canvas 640×896 para la huella de 40×56), `allende.ts` (los portales, los
    comercios y el Café, las mesas bajo los arcos, las casas de Allende, la Cerrada de San
    Agustín), `morelia.ts` (reja y portones, kiosko, fuentes de taza, estatua de Juárez, placa,
    bancas de cantera y de hierro, laureles, liquidámbares, fresnos, faroles, postes de globos),
    `plazas.ts` (monumento de Ocampo, fuentes danzantes, asta, jardineras, macetones, faroles de
    campana, pilastras, fuente de columna, globero, churros, losa de los Liberales), `interior.ts`
    (el Café).
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
- `e2e/tests/plaza.spec.ts` (banca en `?en=151.5,88.25`, placa UNESCO en `?en=137.1,88`, puerta
  de la Catedral en `?en=66.5,78.3`), `portales.spec.ts` (ruta a pie al Café),
  `multijugador.spec.ts` (caminar 0.8 s hacia arriba).
  **Caminar en E2E:** soltar una tecla tarda (sin GPU y con la sala corrigiendo, el toque más corto
  llegó a recorrer 1.7 tiles en la nube); `caminarHasta` de `portales.spec.ts` mide esa inercia en
  cada toque, suelta antes para que la deje en la meta y, si falta menos de lo que avanza un toque,
  primero se aleja. Diseña las rutas por pasillos de ±0.6 tiles o más y mídelas con
  `scripts/plaza/pasillos.mts`. Si un tramo termina contra una pared, su tolerancia debe incluir el
  tope (la puerta del Café: la pared deja a los pies en y 15.16).

---

## 5. El mapa hoy (Plaza v3)

**Orientación (ADR-0013):** la vista mira **al sur desde Madero** (el mapa real girado 180°). La
fachada de la Catedral, que da al norte, queda de frente; la Plaza de Armas (poniente) a la
derecha; la Melchor Ocampo (oriente) a la izquierda; la calle Allende (sur) arriba con sus
portales; Madero (norte) abajo.

**Escala (ADR-0014):** **1.4 m por tile**, trazada sobre el OSM con
`node scripts/plaza/osm.mts --escala 1.4` (`x = (X0 − este) / escala`, `y = (Y0 − sur) / escala`,
en metros de una proyección local centrada en la Catedral, 19.70225, −101.19231). 208 × 98 tiles
(3328 × 1568 px).

**Bandas de izquierda a derecha (x):** azoteas 0–2 · Morelos (calle) 2–7 · banqueta 7–9 · Melchor
Ocampo 9–41 · reja oriente del atrio 41 · Catedral 46–86 · atrio poniente 86–115.5 · reja poniente
115.5 (de y 42.5 a Madero; al sur, abierto) · Plaza Juárez 116–135.5 (andador de la estatua en
126.5, hileras de laureles en 121 y 132) · andador Juárez 135.5–139 (losa) con su hilera en 140.3 ·
Plaza de Armas 141–197 (jardín cercado 145.5–190.5) · banqueta 197–199 · Abasolo 199–205 ·
azoteas 205–208.

**De arriba abajo (y):** casas de Allende (x 7–67, pie en 15) · García Obeso (x 67–73, sube al
sur) · Portal Aldama (x 73–130.75) y Portal Allende (x 141–204.75): frente de y 9 a 18, andador
cubierto 15–18, pilares cada 3 tiles en 18 · Cerrada de San Agustín entre los dos (x 131–141, losa
10–18, el templo al fondo) · empedrado de Allende 16–20 · banqueta norte 20–21 · plazas 21–88 (el
atrio es `losa` hasta la reja de Madero, en 86.5, con tres portones) · banqueta de Madero 88–91 ·
Madero (calle) 91–98.

| Qué | Dónde (tiles) |
| --- | --- |
| Spawn `entrada` | (66.5, 80.6), en el atrio frente a la puerta mayor, mirando arriba |
| Puerta del Café (portal `plaza-cafe`) | (145.875, 15.1), alcance 1.4; spawn `desde-cafe` (145.875, 15.75) |
| Catedral (huella) | x 46–86, y 21–77; placa `puerta-catedral` en (66.5, 77.5) |
| Portones de la reja | Madero: centros x 57.5, 66.5 (mayor), 75.5; oriente: y 27, 40.8, 79; poniente: y 51, 79 |
| Kiosko | centro (168, 61), base r 3.5; jardinera de reja negra r 5; anillo r 8.2; placa en (168, 65.8) |
| Fuentes de la Plaza de Armas | (154.5, 41.8), (181.5, 41.8), (153.15, 77.83), (182.85, 77.83); r 1.8 |
| Fuente de columna (Plaza Juárez) | (126.5, 83.2), r 2.1 |
| Estatua de Juárez / placa | (126.5, 27.5) / (126.5, 29.1) |
| Placa de la UNESCO | (137.1, 87.2), en el andador Juárez junto a Madero |
| Monumento a Ocampo | huella (18, 29) 5×6.5; placa en (20.5, 35.9); dos lugares en su orilla |
| Fuentes danzantes | (17.6, 76) 5×6, se pisan |
| Losa de los Liberales | (11, 36.4), se pisa; placa en (11.9, 38) |
| Asta bandera | (26.5, 53) |
| Mesas de café (Portal Allende) | 6 mesas bajo los arcos, dos sillas cada una; el arco del Café queda libre |
| Bancas curvas del kiosko | 8, en la orilla del anillo (r 7.6), una por tramo entre andadores; 20 lugares |
| Esculturas de los mártires | contra el muro poniente de las naves (x 83), y 57.2 y 62.4; placa en (84.9, 60.6) |
| Vendedores | globero (23, 45), churros (28.5, 64.5), gazpacho (57, 16.6) y (132.6, 11.5), elotes (142.2, 26.2), bolero (138.3, 38.4) |
| Encuadre de la Catedral | x 41–115.5, y 67–91, sube 12 tiles |

Números: 296 objetos, 176 asientos, 7 placas, 1 puerta. Rejilla de 832×392 celdas (≈10 ms).

**Ruta a pie de la entrada al Café** (la de `portales.spec.ts`; direcciones de pantalla): a la
derecha hasta x 96 por el atrio, hacia arriba por el atrio poniente (sin reja al sur, como el real)
hasta el empedrado de Allende (y 20.5), a la derecha hasta x 145.875 y arriba hasta la puerta
(y 15.3). ≈35 s a pie. Ojo con el giro: en pantalla, derecha = poniente, izquierda = oriente,
arriba = sur, abajo = norte.

---

## 6. Tarea 1 · Agrandar el mapa (hecha: ADR-0014)

**Hecha en la sesión del 28/09/2026.** Se le mostró al usuario una maqueta (la v2 ampliada pixel
por pixel en el banco) a 1.5×, 2×, 2.5× y 3×, en el teléfono y en la computadora, y eligió **2×**.
Lo que sigue queda como registro de cómo se midió y decidió; el resultado está en §5.

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

### Cómo se hizo

1. **ADR-0014**: 1.4 m por tile, suelo en trozos, versión 3 del mapa.
2. **Suelo en trozos de 512 px** (`phaser/suelo.ts` + `groundPainter` en `ground.ts`): lo visible
   al entrar, el resto uno por cuadro; se verificó pixel por pixel contra el suelo de una pieza.
3. **Retrazo con el OSM** a 1.4: calles, andadores, rejas, fuentes, los árboles (los de pasto),
   las arcadas (19 arcos el Aldama, 21 el Allende) y la Cerrada de San Agustín.
4. **Arte redibujado** para la huella nueva (no ampliado): la Catedral (640×896 px), el kiosko,
   los portales, los comercios, las casas, la reja y sus portones, el monumento a Ocampo, los
   árboles; y piezas nuevas: mesas de café, bancas de hierro, liquidámbares, postes de globos.
5. **Cámara:** encuadre de la Catedral más alto (`lookUp` 12) para que se vean las torres.
6. **Servidor:** sin cambios de protocolo; `version` 3 y `lugarValido` para los fantasmas.
7. **Pruebas** de §4.5 rehechas; la ruta de E2E va por pasillos medidos con `pasillos.mts`.

---

## 7. Tarea 2 · Detallar el entorno

**Ya está (v2, el pase de fidelidad y el de la v3):** Catedral con torres (la oriente con los
cuerpos altos salmón), relojes, campanarios, cúpula de azulejo en rombos, bóvedas rojas, ábside,
el anexo blanco de marcos rojos con su cupulita y la puerta mayor; las **esculturas de los
mártires** junto al muro poniente, en su corralito, con su placa; reja del atrio con ocho portones
de copete y jarrones y sus faroles de brazo; atrio de cantera clara. Plaza de Armas: kiosko
octagonal con su cúpula y su jardinera de reja negra, el **anillo de bancas curvas con respaldo
calado de óculos**, cuatro fuentes de taza con sus **luminarias empotradas**, jardines con reja
verde, ejes y diagonales, laureles podados en bloque, fresnos, liquidámbares, jacarandas,
pilastras-farol. Plaza Juárez: estatua, bancas de hierro verde botella, fuente de columna, placa de
la UNESCO. Melchor Ocampo: explanada con su retícula, monumento, fuentes danzantes, bancas-cubo,
macetones, jardineras con bugambilias y naranjos, faroles de campana, asta. Allende: casas de dos
pisos, el Portal Aldama, la Cerrada de San Agustín con el templo al fondo y el Portal Allende con
faroles colgantes bajo los letreros, comercios, el Café y **mesas de café bajo los arcos**. Madero
con postes negros de doble brazo y globos, doble raya amarilla, boyas y cebras. Vendedores: globero,
churros, **gazpacho** detrás de la Catedral y hacia San Agustín, **elotes** con sombrilla roja y un
**bolero**.

**Falta o se puede mejorar (con la sección de `investigacion.md` que lo describe):**

- **Catedral (§1):** las portadas laterales (Guadalupe, San José) apenas se verían en la vista
  cenital; los escalones del atrio (4 en la puerta trasera); palomas en las cornisas.
- **Plaza de Armas (§2):** cenefas de flores por temporada (cempasúchil en noviembre, nochebuenas
  en diciembre): el suelo se podría pintar según el mes del servidor.
- **Portales (§3):** nombres reales como referencia (hoy son giros genéricos; el OSM trae Café
  Michelena, la Churrería, una nevería, farmacias: `osm.mts --json`).
- **Madero (§5.2):** las guarniciones amarillas (verificar); del otro lado de Madero (Palacio de
  Gobierno, portales Hidalgo y Galeana) no se ve nada: la cámara mira al sur.
- **Melchor Ocampo (§4):** el Hotel Los Juaninos y su terraza quedan fuera del mapa (a la izquierda
  solo hay azoteas).
- **Ambiente (§2.9, §6):** la Danza de los Viejitos los sábados, el tranvía turístico, los
  organilleros.
- **Lo que no se pudo confirmar (§9 de la investigación):** de qué lado sube la escalera del
  kiosko (hoy no se dibuja), si Madero tiene camellón físico en 2026, si los toldos siguen
  iguales, el color actual del Portal Allende, si las letras «MORELIA» son permanentes, las horas
  exactas de las fuentes danzantes. No inventes: si algo no se confirma, no se dibuja, se dice en
  la placa o queda anotado como supuesto.

---

## 8. Tarea 3 · Interacción y feedback

Hoy se puede: caminar con colisión fina; **sentarse en 176 lugares** (bancas, cubos, la orilla de
las fuentes de frente y de lado, las bancas curvas del kiosko, las sillas de las mesas del Portal
Allende) y en las 8 sillas del Café; **leer 7 placas**; entrar al Café. En táctil, la acción es la
estrella del HUD; con teclado, «E».

**El ambiente** (`apps/web/src/game/ambiente/`, `phaser/ambiente.ts` y `phaser/noche.ts`) es del
cliente. Lo que depende de la hora sale del reloj del servidor (`RoomState.serverNow`) pasado a la
hora de Morelia (UTC−6, sin horario de verano), así que todos lo ven a la vez; lo demás (palomas,
pregones) cada quien lo ve a su modo. Con movimiento reducido (`quiet`) nada se mueve.

- **La marca:** una flechita flota sobre lo que harías con «E» (`dondeSeMarca` en la escena).
- **Agua viva:** las fuentes tienen cuadros (`cuadrosDe`, `paintObject(o, cuadro)`); las fuentes
  danzantes bailan en dos turnos de ≈3 h (`TURNOS_DANZANTES`: 10–13 y 17–20; la nota de MiMorelia
  no da las horas: **es un supuesto**) y quien las cruza prendidas salpica.
- **Palomas** (`PARVADAS`): picotean, dan saltitos y vuelan si alguien se acerca; regresan al rato.
- **Pregones** (`PREGONES`): los vendedores te ofrecen lo suyo al pasar, sin compras.
- **Campanadas:** a cada hora, un toque por hora; la campana grande se mece en su vano
  (`campanasDeCatedral`, `campanaSola`) y salen ondas.
- **Día y noche** (`solDeMorelia`, `nocheDe`): velo de noche con una hora de crepúsculo; halos en
  las luces que declara cada pieza de arte (`Art.luces`); luminarias del piso; la Catedral
  iluminada (focos dorados, portada azul).
- **Luces de Catedral** (`lucesDeCatedral`): los sábados, a oscuras a las 20:58 y fuegos de 21:00 a
  21:07 mientras la iluminación vuelve.
- En el banco: `?hora=HH:MM` y `?sabado` fijan la hora del ambiente; `e2e/scripts/cuadros.mjs` saca
  capturas seguidas (sin `?quieto`, para ver lo que se mueve) y `e2e/scripts/pieza.mjs` pinta una
  pieza sola y ampliada.

Reglas para lo nuevo: si otros lo ven, pasa por la sala (contrato en `@wous/contracts`, validación
en ambos lados, límite de ritmo, prueba de integración). Si es solo ambiente, puede ser del
cliente, determinista por la hora del servidor. **Nada de economía** (el plan la deja para después
del MVP: comprar churros no), ni NPCs con IA (§29), ni cosas «ya que estamos» (§29). No hay sistema
de audio: agregarlo pide ADR (assets en R2, silencio por defecto, políticas de autoplay, botón de
silencio).

**Lo que sigue, de más a menos valor:**

1. **Más lugares para sentarse:** los escalones del atrio, los bordes de las jardineras de la
   Melchor Ocampo.
2. **Adornos de temporada** por la fecha del servidor (septiembre: banderas; noviembre: catrinas y
   cempasúchil; diciembre: nochebuenas).
3. **Audio** (campanas, pregones, fuegos, agua): pide ADR.
4. **Pose de sentarse con transición corta** y polvito o salpicadura al caminar por cada material.
5. **La Danza de los Viejitos** los sábados por la noche (figuras animadas del cliente, sin IA).
6. **El kiosko como escenario:** poder subir (necesita saber de qué lado está la escalera y un
   segundo nivel de piso: ADR).
7. **Cruzar Madero por las cebras** (hoy la calle bloquea): pide diseño (¿coches?).

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
- Desde la nube, Chromium no abre staging ni producción: el proxy firma con su propia CA y la
  confianza no se toca. Se verifica con `curl`, comparando el hash de cada archivo servido con
  `apps/web/dist` (`/index.html` redirige con 307 a `/`: se compara `/`). `/ws/world` sin sesión
  responde 401 con `--http1.1`; por HTTP/2 se pierde el `Upgrade` y sale 426.
- Con el token de API de la nube, el deploy de producción ató `wous.logidma.com` sin el error
  10000 del que avisa CLAUDE.md (el dominio ya estaba atado).
- Un mapa con versión nueva hace recargar a quien tenga el viejo; los lugares guardados que ya no
  caben entran por el spawn (`lugarValido`).
- La prueba de carga (`scripts/carga/carga.mts`) necesita el `SESSION_PEPPER` de staging. Se
  cambió en esta sesión y el valor no quedó en ningún lado (ni en el repo ni lo tiene el usuario):
  si hace falta, genera uno nuevo y súbelo con `wrangler secret bulk` (nunca `secret put` por
  tubería). Cambiarlo cierra las sesiones de staging, que es de pruebas.

---

## 13. Pendientes y deuda conocida

- La bandera y los árboles siguen quietos (el agua, las palomas y la noche ya se mueven).
- El horario de las fuentes danzantes (10–13 y 17–20) es un supuesto: la fuente solo dice «dos
  turnos de ≈3 h, mañana y tarde».
- Las campanadas y los fuegos se ven solo si la cámara alcanza las torres: frente a la fachada, con
  zoom 3, quedan arriba de la pantalla (se ven desde los costados del atrio o con zoom 2). Los
  fuegos revientan frente a las torres, no encima, para que se vean desde el atrio.
- La noche es un velo a pantalla completa con luces aditivas: en render por software (CI, sin GPU)
  baja ≈15 % los cuadros; en un teléfono con GPU no se nota.
- Del otro lado de Madero (Palacio de Gobierno, portales Hidalgo y Galeana) y de Abasolo (Portal
  Matamoros) no se ve nada: la cámara mira al sur y esos frentes dan la espalda.
- La Catedral no se abre: la sala interior será otro mapa con su portal (como el Café).
- La frase de la losa de los Liberales viene de la prensa (Quadratín, 2022): si encuentras una
  fuente primaria (foto de la losa), confírmala.

---

## 14. Prompt para el chat nuevo

Pégalo tal cual (ajusta la rama si el PR #2 ya se fusionó):

```text
Vas a continuar la Plaza de Wous: el centro histórico de Morelia (la Catedral con la Plaza de Armas
y la Plaza Melchor Ocampo). Repo DavisMtz/Wous; si el PR #2 ya está fusionado, trabaja desde main
en una rama nueva; si no, desde la rama claude/plaza-wous-morelia-1j16v9.

Lee primero docs/plaza/HANDOFF.md completo (ahí está todo: lo que pedí, cómo está hecho, la
investigación, las referencias y lo que falta), después CLAUDE.md, las secciones del plan que ahí se
indican y los ADR 0007, 0013 y 0014.

La Plaza ya está al doble de grande (v3), con un pase de detalle y con interacción y ambiente
(agua viva, palomas, pregones, campanadas, la noche y las Luces de Catedral). Sigue con lo que el
documento lista como pendiente en §7 y §8, empezando por lo de más valor, fiel al lugar real.
Entrar a la Catedral queda para después.

Enséñame avances con capturas. Antes de desplegar a producción, pregúntame.
```
