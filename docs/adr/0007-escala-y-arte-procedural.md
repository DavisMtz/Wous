# ADR-0007 · Pixel art a 16 px: personaje 16×32 y mundo dibujado por código en el cliente

- **Estado:** aceptado · 2026-09-26
- **Contexto:** §34 propone tiles «alrededor de 32×32» y un personaje de «32×48 o 32×64,
  ajustable tras prototipo», y dice que R2 será la fuente de los assets publicados. En la Fase 3
  el probador ya se construyó con personajes de **16×32** compuestos por capas en código
  (`sprite-maps.ts` + `pixel-character.ts`). La Fase 4 tiene que fijar la rejilla del mundo y de
  dónde sale su arte.

## Decisión

1. **Unidad del mundo: tile de 16×16 px de arte.** El personaje mide 16×32 (un tile de ancho,
   dos de alto) y sus pies son la posición autoritativa en tiles (`@wous/game-core`).
2. **Escala entera siempre.** Phaser corre con `pixelArt: true` y la cámara usa un zoom entero
   (2 a 6) calculado del viewport: en teléfono apaisado se ven ~12 tiles de alto y en escritorio,
   de 22 a 30 tiles de ancho.
3. **El arte del mundo se dibuja por código en el cliente** (`apps/web/src/game/world-art/`):
   suelo y objetos se pintan en canvas a partir de `@wous/world-data`, con ruido determinista por
   coordenada, y se registran como texturas de Phaser. No hay PNG del mundo en R2 durante el MVP.
4. Los datos del mapa (`@wous/world-data`) siguen siendo la única fuente: el servidor valida con
   ellos y el cliente los dibuja. Cambiar un mapa cambia la colisión y el dibujo a la vez.

## Alternativas descartadas

- **Tiles de 32 px con personaje de 32×48:** duplicaba el trabajo del probador ya entregado y
  sube cuatro veces el costo de cada pieza de ropa; con zoom entero no se gana nitidez.
- **Hojas PNG en R2 desde ahora:** exigen pipeline de exportación, versiones y caché antes de que
  el arte se estabilice. Se retoma cuando haya artista o piezas que el código no pueda dibujar.

## Consecuencias

- El bundle del juego no descarga imágenes del mundo; el costo es CPU al entrar a una sala
  (se mide y se cachea por mapa y versión).
- Un catálogo futuro de muebles o ropa con arte hecho a mano irá a R2 con IDs del catálogo lógico,
  sin cambiar la rejilla de 16 px.
