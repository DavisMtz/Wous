# ADR-0013 · La Plaza como el centro de Morelia: colisión fina, asientos y placas

- **Estado:** aceptado · 2026-09-27
- **Contexto:** la Plaza de la Fase 4 era una plaza de barrio inventada, de 40×30 tiles, con
  colisión por tile completo y sin nada que hacer más que caminar y cruzar al Café. La plaza
  donde entra todo el mundo tiene que ser el centro histórico de Morelia —la Catedral con la
  Plaza de Armas a un lado y la Plaza Melchor Ocampo al otro—, lo más fiel posible, con sus
  hitboxes y con cosas que se usan: las bancas para sentarse, las placas para leer. El plan ya
  prevé colisión por «collisionGrid / polygons» e «interactables» (§15); esto decide cómo.

## Decisión

1. **El trazo sale del lugar real.** El suelo se trazó sobre OpenStreetMap y la foto de satélite
   del centro (2026): la Catedral de 55 × 78 m con su atrio enrejado, la Plaza de Armas con el
   kiosko al centro, ocho andadores en estrella, cuatro fuentes sobre las diagonales y los
   jardines cercados; la franja de la Plaza Juárez con su andador; la Plaza Melchor Ocampo con
   la estatua en su pileta oscura; Allende al sur con los portales y Madero al norte. Las
   distancias se comprimen (≈ 2.5–3.5 m por tile según la zona); los objetos quedan a escala de
   persona. Lo que no se ve en un plano (materiales, colores, mobiliario, lo que ya no existe)
   sale de una investigación con fotos de Wikimedia Commons, las fichas del IMPLAN y la prensa
   local; ver «Fidelidad» abajo.
2. **La vista mira al sur desde Madero** (el mapa real girado 180°): la fachada principal de la
   Catedral, que da al norte, queda de frente a la cámara, y como en la calle, de frente a ella la
   Plaza de Armas queda a la derecha y la Melchor Ocampo a la izquierda. Lo que da la cara a la
   cámara son la fachada y los portales de Allende; Madero es el borde de abajo.
3. **Colisión más fina que el tile.** `CollisionGrid` tiene `cellsPerTile` (1 en el Café, 4 en
   la Plaza: celdas de 4 px). Las posiciones siguen en tiles; solo la rejilla es más fina. Así un
   andador en diagonal, el borde de una fuente redonda o la reja de un jardín tienen el hitbox que
   se ve, sin escalones de 16 px. Lo sólido de un objeto se declara por partes (`solid`:
   rectángulos en fracciones de tile o círculos) y los jardines cercados son formas del suelo que
   bloquean (`jardin`). El servidor y el cliente arman la misma rejilla con el mismo código.
4. **Formas del suelo (`paint`).** Además del suelo por tile, el mapa trae formas (rectángulos,
   círculos, polígonos y andadores con ancho) que el cliente rasteriza por pixel: jardines,
   glorietas, andadores y pasos peatonales. Solo `jardin` cambia la colisión; las demás son
   dibujo sobre lo que ya se pisa (se valida).
5. **Asientos autoritativos.** El mapa declara asientos (`seats`: pies, hacia dónde mira, salida
   y objeto). El cliente manda `SIT { seatId }` o `STAND {}`, nunca una posición. La sala valida
   que el asiento exista en su mapa, que lo alcances desde donde ELLA te tiene y que nadie más lo
   ocupe (tampoco quien se desconectó y tiene su lugar guardado); no espera nada entre revisar y
   sentar, así que dos personas no quedan en el mismo asiento. Sentado no se camina: un input con
   movimiento te deja de pie en la salida (servidor y cliente hacen lo mismo, sin corrección).
   `PlayerView` y `PlayerStateView` llevan `seat`; errores nuevos `SEAT_NOT_FOUND`, `SEAT_TAKEN`
   y `SEAT_NOT_REACHABLE`. Las sillas del Café también son asientos (Café v3).
6. **Placas que se leen.** `signs` (placa de la UNESCO, las estatuas, la losa del Árbol de los
   Liberales, el kiosko, la puerta de la Catedral) las muestra el cliente sin pasar por la sala: leer no cambia nada
   del mundo. El botón contextual elige lo más cercano entre puerta, asiento libre y placa.
7. **Encuadres de cámara.** `cameraZones` sube la cámara frente a lo alto (el atrio de la
   Catedral) para que se vean las torres, sin sacar a quien juega de la pantalla. Solo cambia lo
   que se ve.
8. **La Catedral, por ahora, no se abre.** Su puerta es una placa («próximamente»); la sala
   interior será otro mapa con su portal, como el Café.
9. **El Café queda bajo los portales de Allende**, frente a la Plaza de Armas, donde de verdad
   están los cafés con mesas bajo los arcos. El Café no cambia por dentro.

## Fidelidad (lo que cambió al contrastar con la investigación)

- **Pisos:** los andadores de la Plaza de Armas son losas gris rosado en hilada corrida
  (`enlosado`); el atrio, losas de cantera clara (`losa`); la Melchor Ocampo, una explanada de
  losas grises con una retícula de bandas oscuras (`explanada`).
- **Melchor Ocampo:** la estatua de bronce (1888) va de pie sobre un dado de piedra oscura, en
  una pileta baja donde la gente se sienta. La fuente norte se quitó en 2008: en su lugar hay
  chorros que salen del piso (`chorros`, se cruzan a pie). Bancas-cubo y macetones junto a la
  reja del atrio, jardineras con bugambilias y naranjos hacia Morelos, postes de dos faroles de
  campana, el asta bandera, jacarandas hacia Madero, un globero y un carrito de churros (los
  dulces típicos se venden en el Mercado de Dulces, no aquí).
- **El Árbol de los Liberales ya no existe** (se perdió antes de 2015 y su reemplazo cayó en
  2022): queda una losa a ras de piso con la frase de Ocampo, que se pisa y se lee.
- **Plaza de Armas:** kiosko octagonal de hierro fundido (1887) sobre su base de cantera gris
  con tableros y una puertita, en una jardinera redonda cercada con un andadorcito hasta la
  puerta; fuentes de taza de cantera gris; pares de pilastras-farol en la boca de cada diagonal
  y una fila por la orilla del andador; los laureles de la India podados en bloque, verde lima,
  con el tronco encalado. En el andador Juárez, la fuente de columna junto a Madero.
- **Portal Allende:** aplanado crema con arcos, pilares y marcos de cantera rosa y balcones de
  herrería negra. **Madero:** doble raya amarilla con boyas y cebras con las franjas a lo largo
  del tráfico.
- **Placas:** los textos siguen a las fuentes (torres de 62 m, 66 con las cruces; más de
  doscientos edificios históricos según la UNESCO). Lo que no se pudo confirmar (de qué lado
  sube la escalera del kiosko) no se dibuja.

## Alternativas descartadas

- **Mapa a escala real:** 330 × 120 tiles; una textura de suelo de 5 000 px no cabe en la GPU de
  muchos teléfonos (2 048 o 4 096) y la plaza se vería vacía con 35 personas. Se quedó en 104 × 49.
- **Seguir con colisión por tile:** los andadores en diagonal y las fuentes redondas se volvían
  escaleras invisibles; la persona chocaba con aire o pisaba la reja.
- **Sentarse solo en el cliente:** cada quien vería a otros parados sobre la banca, y dos
  podrían «ocupar» el mismo lugar.
- **Mapa sin girar (norte arriba):** la cámara vería la espalda de la Catedral y la fachada, lo
  que todo moreliano reconoce, quedaría de espaldas.

## Consecuencias

- La Plaza pasa a la versión 2 y el Café a la 3: un cliente con el mapa viejo recarga al entrar
  (el snapshot trae `mapVersion`).
- La textura del suelo de la Plaza mide 1 664 × 784 px (dentro de 2 048).
- La rejilla de la Plaza tiene 416 × 196 celdas; se arma una vez por isolate y no cambia el
  costo por input.
- Un mapa nuevo con diagonales o curvas usa `cellsPerTile` 4; uno de cuartos rectos puede
  quedarse en 1.
