# ADR-0014 · La Plaza al doble: 1.4 m por tile, suelo en trozos y versión 3 del mapa

- **Estado:** aceptado · 2026-09-28
- **Contexto:** la Plaza v2 (ADR-0013) traza el centro de Morelia a ≈2.8 m por tile, pero la
  persona mide 16×32 px (ADR-0007): a su escala, un tile son ≈0.85 m. El mundo queda ≈3.3 veces
  comprimido frente a quien camina: la Catedral, de 55 × 78 m, ocupa 20 × 25 tiles y se ve chica
  junto a la persona. El usuario pidió un mapa «más grande, más realista respecto al personaje».
  Se le mostró una maqueta con capturas a 1.5×, 2×, 2.5× y 3× (en el teléfono y en la
  computadora) y eligió **2×**. A esa escala el suelo mide 3 328 × 1 568 px: ya no cabe en una sola
  textura en muchos teléfonos (2 048 px de lado) y pintarlo de una vez tarda (≈0.7 s en escritorio,
  varias veces más en un teléfono modesto).

## Decisión

1. **Escala de la Plaza v3: 1.4 m por tile** (el doble de la v2), trazada otra vez sobre el
   OpenStreetMap con `scripts/plaza/osm.mts --escala 1.4`: 208 × 98 tiles. Las posiciones salen del
   OSM (andadores, rejas, fuentes, estatuas, los 114 árboles, las arcadas de los portales) y se
   escriben como constantes con nombre, no como números sueltos.
2. **Qué crece y qué no.** Crecen con el trazo la arquitectura y las distancias: la Catedral
   (≈40 × 56 tiles), el atrio y su reja, el kiosko (≈8 tiles, como el real de 11 m), las fuentes, los
   jardines, los andadores, las calles y el fondo de los portales (≈3 tiles: caben las mesas del
   café bajo los arcos). No crecen el mobiliario ni la persona, que ya estaban a escala de persona
   (bancas, cubos, faroles, pilastras, placas, puestos); con más espacio caben **más**, y los
   árboles se acercan a su tamaño real (los laureles podados miden 4–5 m de copa). Las alturas se
   comprimen un poco frente al piso (≈0.8), como en la v2: en 3/4 cenital se lee mejor.
3. **El arte se redibuja a la escala nueva, no se amplía.** La Catedral, el kiosko, los portales y
   las piezas que crecen se dibujan por código para su huella (ADR-0007). La maqueta con que se
   decidió la escala (la v2 ampliada pixel por pixel en el banco de desarrollo) se quitó al
   terminar: solo servía para esa decisión.
4. **El suelo se pinta en trozos de 512 px.** El material de cada pixel se calcula una vez por mapa;
   cada trozo es su propia textura (`suelo:<mapa>:<versión>:<i>:<j>`). Al entrar se pintan los
   trozos que se ven; los demás, uno por cuadro con un tope de tiempo, del más cercano al más
   lejano, y cualquiera que entre en la vista antes de tiempo se pinta en el acto. Cuando ya se
   pintó todo se suelta el buffer de materiales. Las texturas viven en el administrador de Phaser:
   volver del Café no repinta nada.
5. **Versión 3 del mapa.** El snapshot trae `mapVersion`: un cliente con la v2 recarga al entrar, y
   los lugares guardados que ya no caben (ADR-0009) entran por el spawn (`lugarValido`). El
   protocolo no cambia.

## Alternativas descartadas

- **1.5×:** «un poco más grande» al pie de la letra y más cosas por pantalla en el teléfono, pero la
  Catedral seguía compacta y bajo los portales no cabían las mesas del café.
- **2.5× o más:** casi escala de persona; mucho caminar (≈44 s de la entrada al Café) y, con 35–45
  personas por sala, una plaza vacía. En el teléfono casi solo se veía piso.
- **Una sola textura de suelo:** pasa de 2 048 px y el primer cuadro esperaba a pintar 5 Mpx.
- **Zoom no entero para ver más en el teléfono:** rompe la nitidez del pixel art (ADR-0007).

## Consecuencias

- La rejilla de colisión de la Plaza pasa a 832 × 392 celdas (`cellsPerTile` 4); se arma una vez
  por isolate y `validateWorld` sigue en milisegundos.
- Caminar de la entrada al Café toma ≈35 s (antes ≈18 s). La velocidad no cambia.
- Todas las pruebas que dependen de coordenadas (world-data, sala, E2E) se rehacen con las rutas
  nuevas; las rutas de E2E van por pasillos anchos.
- Este ADR complementa al ADR-0013 (colisión fina, asientos, placas, encuadres): todo eso sigue
  igual, a la escala nueva.
