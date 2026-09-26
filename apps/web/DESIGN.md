---
name: Wous
description: Un puesto de paca bajo la lona donde tu personaje en pixel art se prueba su look y sale a la plaza.
colors:
  lona-rosa: "#d81b72"
  lona-rosa-hondo: "#a10f57"
  lona-rosa-luz: "#ff72b4"
  lona-azul: "#1e4bd2"
  lona-azul-hondo: "#0f2c86"
  lona-azul-luz: "#5a86ff"
  lona-verde: "#0f8a4a"
  lona-verde-hondo: "#075a2f"
  lona-verde-luz: "#39c47a"
  lona-amarilla: "#f5c518"
  lona-amarilla-hondo: "#b98a00"
  lona-amarilla-luz: "#ffe57a"
  lona-naranja: "#ee5f16"
  lona-naranja-hondo: "#a8390a"
  lona-naranja-luz: "#ff9a55"
  fosfo-amarillo: "#efff3a"
  fosfo-naranja: "#ff7a21"
  fosfo-verde: "#5dff86"
  rojo-plumon: "#c8141c"
  plumon: "#17101b"
  plumon-suave: "#4a3a51"
  ciruela: "#2b1238"
  cartulina: "#fffbf1"
  cartulina-borde: "#e9dfc8"
  papel: "color-mix(in oklab, var(--lona-luz, #ff72b4) 9%, var(--cartulina))"
  blanco: "#ffffff"
  masking: "#e9dbb1"
  madera: "#d7a064"
  madera-sombra: "#a36b33"
  cuerda: "#efe2c4"
  cuerda-sombra: "#b7a47c"
  asfalto: "#2e2632"
  asfalto-luz: "#3b3240"
  banqueta: "#9c8f95"
typography:
  display:
    fontFamily: "Big Shoulders Display Variable, Arial Narrow, sans-serif"
    fontSize: "clamp(4.4rem, 3rem + 7vw, 6rem)"
    fontWeight: 900
    lineHeight: 0.8
    letterSpacing: "0.012em"
  firma:
    fontFamily: "Big Shoulders Display Variable, Arial Narrow, sans-serif"
    fontSize: "2.3rem"
    fontWeight: 900
    lineHeight: 0.8
    letterSpacing: "0.012em"
  headline:
    fontFamily: "Big Shoulders Display Variable, Arial Narrow, sans-serif"
    fontSize: "clamp(2.1rem, 1.6rem + 2.4vw, 3.5rem)"
    fontWeight: 850
    lineHeight: 0.92
  title:
    fontFamily: "Big Shoulders Display Variable, Arial Narrow, sans-serif"
    fontSize: "clamp(2.05rem, 1.6rem + 1.6vw, 2.85rem)"
    fontWeight: 850
    lineHeight: 1.04
  subtitle:
    fontFamily: "Big Shoulders Display Variable, Arial Narrow, sans-serif"
    fontSize: "clamp(1.18rem, 1.1rem + 0.4vw, 1.4rem)"
    fontWeight: 800
    lineHeight: 1
  lead:
    fontFamily: "Bricolage Grotesque Variable, system-ui, sans-serif"
    fontSize: "clamp(1.18rem, 1.1rem + 0.4vw, 1.4rem)"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "Bricolage Grotesque Variable, system-ui, sans-serif"
    fontSize: "clamp(1rem, 0.97rem + 0.15vw, 1.06rem)"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Bricolage Grotesque Variable, system-ui, sans-serif"
    fontSize: "0.98rem"
    fontWeight: 750
    lineHeight: 1.5
  label-caps:
    fontFamily: "Bricolage Grotesque Variable, system-ui, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 800
    lineHeight: 1.5
    letterSpacing: "0.06em"
  plumon:
    fontFamily: "Permanent Marker, Segoe Print, cursive"
    fontSize: "1.32rem"
    fontWeight: 400
    lineHeight: 1.1
rounded:
  trazo: "7px 12px 9px 13px / 12px 8px 13px 9px"
  trazo-chico: "5px 8px 6px 9px / 8px 5px 9px 6px"
  hoja: "3px 5px 4px 6px"
  carton: "4px 9px 5px 10px"
  redondo: "50%"
spacing:
  s-1: "4px"
  s-2: "8px"
  s-3: "12px"
  s-4: "16px"
  s-5: "24px"
  s-6: "32px"
  s-7: "48px"
  s-8: "64px"
  s-9: "96px"
components:
  cartulina-fosfo:
    backgroundColor: "{colors.fosfo-amarillo}"
    textColor: "{colors.plumon}"
    typography: "{typography.plumon}"
    rounded: "{rounded.trazo}"
    padding: "12px 24px"
    height: "54px"
  cartulina-fosfo-hover:
    backgroundColor: "color-mix(in oklab, #efff3a 86%, white)"
  cartulina-trazo:
    backgroundColor: "transparent"
    textColor: "{colors.plumon}"
    rounded: "{rounded.trazo}"
    padding: "12px 24px"
    height: "54px"
  estrella:
    backgroundColor: "{colors.fosfo-naranja}"
    textColor: "{colors.plumon}"
    size: "clamp(168px, 17vw, 216px)"
  hoja:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.plumon}"
    rounded: "{rounded.hoja}"
    padding: "clamp(30px, 4vw, 44px) clamp(20px, 3.4vw, 40px) clamp(24px, 3vw, 34px)"
    width: "min(100%, 500px)"
  campo:
    backgroundColor: "{colors.blanco}"
    textColor: "{colors.plumon}"
    rounded: "{rounded.trazo-chico}"
    padding: "12px 14px"
    height: "52px"
  chip:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.plumon}"
    typography: "{typography.label}"
    rounded: "{rounded.trazo-chico}"
    padding: "8px 16px"
    height: "44px"
  chip-pressed:
    backgroundColor: "{colors.fosfo-amarillo}"
  pestana:
    backgroundColor: "transparent"
    textColor: "{colors.plumon}"
    typography: "{typography.label}"
    rounded: "{rounded.trazo-chico}"
    padding: "8px 14px"
    height: "44px"
  pestana-activa:
    backgroundColor: "{colors.fosfo-amarillo}"
  opcion:
    backgroundColor: "{colors.blanco}"
    textColor: "{colors.plumon}"
    rounded: "{rounded.trazo-chico}"
    padding: "8px 6px 6px"
    height: "44px"
    width: "78px"
  opcion-color:
    backgroundColor: "{colors.blanco}"
    rounded: "{rounded.redondo}"
    size: "48px"
  sello:
    backgroundColor: "{colors.fosfo-verde}"
    textColor: "{colors.plumon}"
    rounded: "{rounded.carton}"
    padding: "9px 20px 7px"
  etiqueta:
    backgroundColor: "{colors.fosfo-amarillo}"
    textColor: "{colors.plumon}"
    rounded: "{rounded.carton}"
    padding: "7px 14px 7px 22px"
  aviso-error:
    backgroundColor: "color-mix(in oklab, #c8141c 8%, white)"
    textColor: "#8c0a10"
    rounded: "{rounded.trazo-chico}"
    padding: "12px 14px"
  aviso-ok:
    backgroundColor: "color-mix(in oklab, #5dff86 24%, white)"
    textColor: "#0a5328"
    rounded: "{rounded.trazo-chico}"
    padding: "12px 14px"
---

# Design System: Wous

## Overview

**Creative North Star: "El tianguis de paca"**

Cada pantalla de Wous es un puesto de paca bajo una lona de color. Arriba cuelga la orilla de la lona, con su dobladillo cosido y sus ojillos de metal. La tela llena el fondo y la luz del día pasa por ella, así que todo queda teñido: el papel, las sombras, hasta el reflejo de la trama. Lo que se lee cuelga de un tendedero en una hoja con dos pinzas de madera. Las acciones son cartulinas fosforescentes rotuladas con plumón. Abajo pasa la calle de asfalto con gente en pixel art. El pixel art es el mundo (personajes, ropa, huacal, perchero, foco pelón, calle). La interfaz es de papel, cartulina, cinta masking y plumón. Las dos capas no se mezclan.

La densidad es de puesto, no de tablero: pocas cosas por pantalla, grandes y hechas a mano. Ninguna superficie parece un rectángulo de pantalla. Los radios son desiguales, como un rectángulo trazado con plumón, las piezas van un poco chuecas y las sombras son suaves y color ciruela. El movimiento es físico: lo colgado se mece, lo pegado se hunde al presionarlo, la ropa brinca cuando te la pruebas y, al cambiar de puesto, la lona se enrolla hacia arriba. La luz sirve de estado: lo elegido queda bajo el foco pelón y lo demás, a la sombra de la lona.

Rechazo confirmado: la portada de juego pixel de siempre, con cielo morado, tipografía pixel y botón JUGAR. El riesgo propio de este mundo también está nombrado: ilustrado con timidez, parece folclor de souvenir. Tiene que sentirse de calle, actual y hecho a mano.

**La Regla de Nada Nace Invisible.** En el CSS, el estado por defecto de todo es el final. Las entradas animan *desde* otro estado con `entrance()` y llevan red de seguridad: a los 2800 ms, o si la pestaña se oculta, se fuerzan a terminar y se limpian sus propiedades en línea. Con movimiento reducido o en modo `?quieto` no se anima nada: todo aparece ya en su sitio.

**Key Characteristics:**
- Una lona por pantalla; su luz tiñe el papel y su pliegue pinta orillas y sombras.
- Tres manos tipográficas: rotulista para títulos, plumón para cartulinas, grotesca cálida para leer.
- Contenedores que cuelgan (hoja con pinzas, etiqueta con hilo, perchero con ganchos) en lugar de tarjetas.
- Cartulinas que se hunden al presionarlas; la luz del foco marca lo elegido.
- Pixel art a escala entera para el mundo, nunca para el texto.
- Sombras ciruela, jamás negras.

## Colors

Cinco lonas saturadas que tiñen la luz, tres cartulinas fosforescentes que gritan y tinta de plumón sobre papel. No hay grises neutros ni negro puro.

### Primary
Las lonas. Cada una trae tres tonos: la base (la tela), la **honda** (el pliegue: orilla, sombra del rótulo, barra de desplazamiento, franja al pie de la cortina) y la **luz** (lo que atraviesa la tela: el reflejo de la trama y el tinte del papel). La ruta decide cuál se usa, con `data-lona` en `<html>`.
- **Lona rosa** (`lona-rosa`, `-hondo`, `-luz`): la de la casa. Portada y registro, y la que toma cualquier ruta sin lona asignada; también es el `theme-color` del navegador y el correo de verificación. Se ajustó a su tono actual para que la tinta cartulina encima dé 4.70:1.
- **Lona azul** (`lona-azul`, `-hondo`, `-luz`): entrar. En el correo, el aviso de contraseña cambiada. Es la lona con más aguante: cartulina encima da 6.79:1.
- **Lona verde** (`lona-verde`, `-hondo`, `-luz`): revisar y verificar el correo, y los correos de amistad. Cartulina encima da 4.27:1, así que sobre ella solo va letrero grande.
- **Lona amarilla** (`lona-amarilla`, `-hondo`, `-luz`): olvidé y restablecer contraseña, y su correo. Es la única cuya tinta encima es plumón (11.44:1), no cartulina.
- **Lona naranja** (`lona-naranja`, `-hondo`, `-luz`): con sesión iniciada, el probador y la casa; en el correo, la bienvenida. Cartulina encima da 3.23:1: solo letrero grande.

### Secondary
Las cartulinas fosforescentes, rotuladas siempre con plumón.
- **Marcatextos** (`fosfo-amarillo`): lo que puedes hacer o lo que ya elegiste. Botón de acción principal, selección de texto, chip presionado, pestaña activa, etiqueta de cartón del maniquí, halo de la opción elegida y raya central de la calle. Con plumón encima da 16.90:1.
- **Naranja de estrella** (`fosfo-naranja`): la estrella de precio «¡Pásale!» y la calcomanía «Pronto» de las piezas bloqueadas. Con plumón encima da 7.15:1.
- **Verde de hecho** (`fosfo-verde`): lo que quedó hecho. Cartulina de confirmación («¡Enviado!», «¡Confirmado!», «¡Listo!»), el letrero «¡Pruébatelo!» del perchero y, rebajado, el fondo del aviso de éxito.

### Tertiary
- **Rojo plumón** (`rojo-plumon`): errores (borde del campo, mensaje, marco de la casilla) y también la palomita de la casilla, trazada en rojo como la de un maestro. Sobre papel da 5.26:1.

### Neutral
- **Plumón** (`plumon`): la tinta. Texto sobre papel (16.5 a 17.7:1 según la lona), borde de campos, texto de todas las cartulinas.
- **Plumón suave** (`plumon-suave`): texto secundario, ayudas, entradas de la hoja, leyendas y etiquetas de dato (9.2 a 9.9:1 sobre papel).
- **Ciruela** (`ciruela`): la sombra de todo. Toda sombra usa `rgb(43 18 56 / …)`, el pixel art oscurece hacia este tono y también son ciruela el cable del foco y el hueco de los ojillos.
- **Cartulina** (`cartulina`): la tinta sobre la lona (`--sobre-lona` en cuatro de las cinco) y la base del papel.
- **Borde de cartulina** (`cartulina-borde`): las divisiones punteadas dentro de la hoja y el borde de las opciones sin elegir.
- **Papel** (`papel`): cartulina teñida al 9% por la luz de la lona que tiene encima. Resuelve a `#ffefeb` bajo la rosa, `#eff1f4` bajo la azul, `#f0f6e6` bajo la verde, `#fff9e7` bajo la amarilla y `#fff3e4` bajo la naranja. Es el fondo de la hoja, de los chips y del letrero del pie.
- **Blanco** (`blanco`): el interior de campos, opciones y el marco de la casilla. Es la hoja blanca pegada sobre el papel teñido, para que lo que escribes se distinga del resto.
- **Masking** (`masking`): la cinta que pega la estrella y la cartulina de confirmación. Siempre al 86% y con recorte trapezoidal.
- **Madera** (`madera`, `madera-sombra`): las pinzas del tendedero.
- **Cuerda** (`cuerda`, `cuerda-sombra`): el tendedero y el hilo de la etiqueta.
- **Asfalto y banqueta** (`asfalto`, `asfalto-luz`, `banqueta`): la calle del pie, con raya discontinua de marcatextos.

### Named Rules
**La Regla de la Lona que Tiñe.** Cada pantalla vive bajo una sola lona, elegida por la ruta. Su luz tiñe el papel (9%) y la trama, y su tono hondo pinta orillas, la sombra del rótulo y la barra de desplazamiento. Dos lonas solo conviven durante el medio segundo en que la cortina se enrolla.

**La Regla del Marcatextos.** El amarillo fosforescente no decora: marca lo que puedes hacer o lo que ya elegiste, y siempre lleva plumón encima. Hay a lo más una cartulina marcatextos por hoja.

**La Regla de que se Lee en Papel.** Sobre la lona solo va letrero: el rótulo, el lema, el texto de entrada en negrita de 1.18rem o más y las cartulinas de trazo. Todo lo que se lee de corrido va en la hoja. La prueba: cartulina sobre verde da 4.27:1 y sobre naranja 3.23:1, así que en esas lonas no cabe texto normal.

## Typography

**Display Font:** Big Shoulders Display (variable), con Arial Narrow
**Body Font:** Bricolage Grotesque (variable), con system-ui
**Label/Mono Font:** Permanent Marker (el plumón), con Segoe Print

**Character:** Tres manos distintas. El rotulista pinta en mayúsculas condensadas y pesadas, como el nombre de un puesto. El plumón escribe con prisa sobre la cartulina fosforescente. La grotesca cálida, con tamaño óptico automático, es para leer sin esfuerzo.

### Hierarchy
- **Display** (900, clamp(4.4rem → 6rem), 0.8, mayúsculas): solo el rótulo «WOUS» de la portada; baja a 3.7rem en una columna. Lleva el filtro de brocha y la sombra de rotulista (ver Components). La **firma** (900, 2.3rem) es el mismo rótulo, en chico, arriba de las demás pantallas.
- **Headline** (850, clamp(2.1rem → 3.5rem), 0.92, mayúsculas): el lema de la portada, «Arma tu look. Sal a la plaza.».
- **Title** (850, clamp(2.05rem → 2.85rem), 1.04, mayúsculas): el título de cada hoja, que es el `h1` de la pantalla.
- **Subtitle** (800, clamp(1.18rem → 1.4rem), 1, mayúsculas): un subtítulo dentro de la hoja («¿No llegó?»).
- **Lead** (700, clamp(1.18rem → 1.4rem), 1.4, máximo 30ch): el texto de la portada que va sobre la lona.
- **Body** (400, clamp(1rem → 1.06rem), 1.5): la lectura. La entrada de la hoja se limita a 44ch y va en plumón suave. Los párrafos usan `text-wrap: pretty` y los títulos `balance`.
- **Label** (750, 0.98rem): etiquetas de campo, chips y pestañas.
- **Label caps** (800, 0.82rem, 0.06em, mayúsculas): leyendas de grupo de opciones y etiquetas de dato (`dt`). Sirve para nombrar un control o un dato, nunca va encima de un título.
- **Plumón** (400, 1.32rem, 1.1): el texto de las cartulinas. El botón de trazo baja a 1.16rem, la etiqueta a 1.1rem, la confirmación sube a 1.45rem y la estrella a clamp(1.85rem → 2.45rem).

### Named Rules
**La Regla de las Tres Manos.** El cartel rotula (títulos y letreros, siempre en mayúsculas), el plumón escribe cartulinas (de dos a cinco palabras) y la grotesca se lee. Ninguna mano hace el trabajo de otra.

**La Regla del Plumón Corto.** Permanent Marker nunca pasa de una línea corta: botones, confirmaciones, etiquetas, letreros y la estrella. No se usa en párrafos, etiquetas de campo ni mensajes de error.

**La Regla del Pixel para el Mundo.** No existe tipografía pixel en Wous. El pixel art es para el mundo, no para los párrafos.

## Layout

**El puesto** es el cascarón de todas las pantallas, en una columna flexible de al menos `100dvh` que recorta el desborde horizontal. Arriba va la orilla de la lona (SVG de 56px que se monta 14px sobre el contenido: festones cada ~150px, un ojillo en cada amarre y la costura punteada). Debajo, la **firma**: el rótulo chico a la izquierda, que lleva al inicio, y en teléfono el personaje compacto a la derecha. Luego el contenido, que crece. Al pie, la **calle**, de 112px de alto, siempre empujada hasta abajo.

Tres rejillas de dos columnas. El mostrador, el probador y la firma usan márgenes laterales de clamp(16px, 4vw, 56px); la portada, clamp(16px, 5vw, 72px), y 12px en una columna.
- **Portada**: máximo 1320px, columnas 0.95fr / 1.2fr (pregón | perchero), separación clamp(24px, 4vw, 64px). Por debajo de 860px pasa a una columna y la escena va **primero**, pegada a la orilla, para que el foco cuelgue de la lona. En ese ancho la estrella mide 150px y las dos acciones comparten renglón.
- **Mostrador** (acceso y casa): máximo 1120px, 0.8fr / 1fr (maniquí | hoja). Por debajo de 820px el maniquí grande desaparece y sube, compacto y sobre su huacal, a la firma.
- **Probador** (creador de personaje): máximo 1180px, 0.85fr / 1.15fr (espejo | hoja). El espejo es pegajoso a 48px del borde y lleva 96px de aire arriba para el foco. Por debajo de 820px pasa a una columna, con el espejo arriba y sin fijarse.

**El tendido** (cuerda + hoja) mide como máximo 500px (580px en el probador) y deja 26px arriba para la cuerda. La cuerda se desborda 12% por cada lado, así que se ve atada más allá de la hoja.

**Ritmo:** escala de 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96px. Los campos de un formulario van a 16px entre sí. El pie de la hoja y un segundo formulario se separan con 24px y una línea punteada de 2px.

**Pixel art:** se dibuja en «pixeles de arte» y se escala por un entero. El lienzo interno multiplica además por la densidad de pantalla redondeada, y el render es `pixelated`. Escalas en uso: perchero de 122×88 pixeles de arte, ajustado entre 2 y 6; maniquí de 36×48 a escala 6 (compacto de 20×37 a escala 3); espejo a escala 7 en escritorio y 5 en teléfono; calle de 36 pixeles de alto a escala 3; miniaturas de opciones a escala 3 o 4. El sprite del personaje mide 16×32.

**La Regla de la Escala Entera.** Ningún pixel de arte se estira por un factor fraccionario ni se suaviza. Si no cabe, se baja un entero.

## Elevation & Depth

La profundidad es física: materiales colgados o pegados a distintas distancias de la luz. Las sombras son suaves, largas y color ciruela, como bajo una lona. La única sombra dura que proyecta una pieza de la interfaz es la del rótulo, porque es la sombra que pinta un rotulista. El énfasis no se consigue levantando cosas sino con **luz**: el halo del foco pelón, en mezcla `screen`, cae sobre lo elegido.

### Shadow Vocabulary
- **Hoja colgada** (`box-shadow: 0 1px 1px rgb(43 18 56 / 0.22), 0 14px 26px -10px rgb(43 18 56 / 0.55)`): la hoja del tendedero y la hoja del correo.
- **Cartulina pegada** (`box-shadow: 0 1px 0 rgb(23 16 27 / 0.2), 0 7px 14px -6px rgb(43 18 56 / 0.55)`): botón marcatextos, chip, pestaña activa, confirmación, etiqueta, letrero, calcomanía «Pronto» y el letrero del pie.
- **Cartulina hundida** (`box-shadow: 0 0 0 rgb(23 16 27 / 0.2), 0 2px 4px -2px rgb(43 18 56 / 0.5)`): el estado presionado de las cartulinas y los chips.
- **Orilla** (`filter: drop-shadow(0 7px 8px rgb(43 18 56 / 0.32))`): la lona sobre el contenido.
- **Pinzas y cuerda** (`filter: drop-shadow(0 2px 2px rgb(43 18 56 / 0.35))`; la cuerda con `0 2px 1px`).
- **Estrella** (`filter: drop-shadow(0 2px 1px rgb(23 16 27 / 0.25)) drop-shadow(0 12px 14px rgb(43 18 56 / 0.42))`): al presionarla baja a `0 1px 0` / `0 4px 5px`.
- **Halo del foco**: gradiente radial cálido (`rgb(255 240 178 / 0.78)` → transparente al 70%), de 124 pixeles de arte de ancho y en mezcla `screen`. Va en CSS y no en el lienzo, para que no se recorte.
- **Sombra de rotulista**: siete capas de 1px a 7px en el tono hondo de la lona, más `0 18px 26px rgb(43 18 56 / 0.32)`. La firma usa solo tres capas.

### Named Rules
**La Regla de la Sombra Ciruela.** Ninguna sombra es negra ni gris. Todas son `rgb(43 18 56 / …)` o `rgb(23 16 27 / …)`. En el pixel art, la sombra de cada material se mezcla hacia `#2b1238` y el contorno se hunde hacia `#1a0a22`: es contorno selectivo, nunca negro.

**La Regla de Hundirse.** Al presionar, toda cartulina baja de 2 a 4px y su sombra se aplasta, en 110ms con `ease-presion`. Nada crece al presionarlo. El hover solo existe con puntero (`hover: hover`): aclara hacia el blanco o hacia el marcatextos, y no levanta nada.

**La Regla del Foco.** Lo elegido queda bajo la luz y lo demás, a la sombra de la lona. En la opción elegida es una luz cálida radial detrás de la pieza más un halo marcatextos; en el gancho con hover, un brillo cálido. El foco pelón nunca se usa como adorno suelto: siempre hay algo debajo de él.

## Shapes

Todo está trazado a mano. Los radios son desiguales en cada esquina, como un rectángulo hecho con plumón:
- **Trazo** (`rounded.trazo`): botones de cartulina.
- **Trazo chico** (`rounded.trazo-chico`): campos, chips, pestañas, opciones y avisos.
- **Hoja** (`rounded.hoja`): la hoja y el letrero del pie.
- **Cartón** (`rounded.carton`): la etiqueta del maniquí y la cartulina de confirmación. El letrero del perchero (`4px 8px 5px 9px`) y la calcomanía «Pronto» (`3px 6px 4px 7px`) son sus parientes.
- **Redondo** (`rounded.redondo`): solo las muestras de color y los huecos de los ojillos.

Las piezas van un poco chuecas: la hoja −0.6°, el letrero del pie −1.2°, la confirmación −4°, la estrella −7° (se mece hasta −3.5°), el letrero del perchero 7° y la calcomanía 6°. La etiqueta se mece ±3° y cada gancho ±1.8°, con desfase entre uno y otro.

Siluetas propias: la estrella de 17 picos irregulares (su forma sale de una semilla del texto, así que no cambia entre cargas); los festones de la orilla; la cinta masking con recorte trapezoidal; la casilla, que es un cuadro dibujado a mano y no un cuadrado; las pinzas en SVG; y los puntos de carga, redondos pero desiguales (`50% 40% 55% 45%`).

Íconos: SVG propios sobre una rejilla de 24, con trazo único de 2.4, puntas redondas y coordenadas apenas irregulares. Heredan el color del texto. Hoy son 12: ojo, ojo tachado, regresar, sobre, palomita, alerta, salir, flecha, girar, caminar, dado y gancho.

**La Regla de Ningún Rectángulo de Pantalla.** Ninguna superficie visible lleva un radio uniforme en sus cuatro esquinas. Las únicas excepciones son los círculos de color y las zonas de foco e interacción, que no se ven como superficie.

## Components

### Buttons
Cartulinas pegadas a la tabla, que se hunden cuando las presionas.
- **Shape:** trazo a mano (`rounded.trazo`), 54px de alto como mínimo, texto en plumón.
- **Primary (cartulina marcatextos):** fondo marcatextos con una trama diagonal blanca muy tenue (`-12deg`, cada 9px), tinta plumón, sombra de cartulina pegada y todo el ancho de la hoja. Hay una por hoja.
- **Hover / Focus:** con puntero, aclara hacia el blanco al 14%. Al presionar se hunde 3px y la sombra se aplasta. Deshabilitada queda al 55%. Cargando, el texto baja al 35% y aparecen tres puntos de plumón que brincan 6px, desfasados 0.12s.
- **Secondary (cartulina de trazo):** fondo transparente con un contorno de 2.5px del color del texto. Sobre papel es plumón; sobre la lona, la tinta de la lona. Texto a 1.16rem. Con puntero, se rellena al 10% de su color; al presionar baja 2px.
- **Estrella de precio:** la acción principal de la portada y la única en su tipo. Es una estrella de cartulina naranja fosforescente de 17 picos, de clamp(168px, 17vw, 216px), inclinada −7° y colgada de un trozo de masking desde su punta superior, así que se mece (5.4s) desde ahí. Dentro lleva «¡Pásale!» en plumón grande y «Crea tu cuenta» en mayúsculas espaciadas. Con puntero se endereza a −3° y crece 4%; al presionar baja 4px, se encoge 3% y su sombra se acerca. Su foco es un contorno de plumón discontinuo de 4px, en círculo. La hoja de estilos trae variantes amarilla, verde y rosa, pero hoy no se usan.

### Chips
- **Style:** papel teñido, plumón, trazo chico, 44px de alto, sombra de cartulina pegada, con ícono de 20px opcional. El de «Otro al azar» escribe en plumón y lleva el dado.
- **State:** presionado (`aria-pressed`), fondo marcatextos. Al presionar se hunde 2px. Con puntero, papel mezclado al 45% con marcatextos.

### Cards / Containers
El contenedor es la **hoja colgada**, no una tarjeta.
- **Corner Style:** `rounded.hoja`, casi recta, con −0.6° de giro.
- **Background:** papel teñido por la lona, con una trama de puntitos ciruela muy tenue en dos rejillas desfasadas (7px y 11px).
- **Shadow Strategy:** la sombra de hoja colgada (ver Elevation & Depth).
- **Border:** ninguno. Cuelga de una cuerda (trazo de cuerda de 3.5px en curva) con dos pinzas de madera al 16% de cada orilla, giradas −5° y 6°, que asoman 36px por encima del borde de la hoja.
- **Internal Padding:** clamp(30px, 4vw, 44px) arriba, clamp(20px, 3.4vw, 40px) a los lados y clamp(24px, 3vw, 34px) abajo. Dentro van el título, la entrada, el formulario y un pie separado por una línea punteada de 2px en borde de cartulina.

### Inputs / Fields
- **Style:** etiqueta encima (label, 750), caja blanca de 52px, borde de plumón de 2px, trazo chico y texto de 1.06rem. La ayuda va debajo en plumón suave (0.93rem). El botón de ver contraseña es de 46px, dentro de la caja, con el ojo o el ojo tachado.
- **Focus:** hoy es un halo marcatextos de 5px, sin contorno. Sobre papel, ese halo da de 1.00 a 1.05:1 y en la práctica no se ve (ver Do's and Don'ts). El patrón que sí funciona sobre papel ya está en la casilla y las opciones: contorno de plumón de 3px separado 2px.
- **Error / Disabled:** el borde pasa a rojo plumón y debajo aparece el mensaje en rojo (650, 0.95rem) con el ícono de alerta de 17px. Al enviar, el foco salta al primer campo con error.
- **Casilla:** un cuadro de 28px dibujado a mano con marco blanco y plumón. Al marcarla, la palomita roja se traza en 280ms (`ease-salida`). Con foco de teclado lleva contorno de plumón y fondo marcatextos.
- **Reglas desplegables:** el `<details>` lleva un chevrón propio (la flecha de los íconos), que gira 90° en 160ms, y el `summary` va subrayado de 3px en el color de la lona. El marcador nativo está oculto.
- **Verificación anti-bots:** Turnstile en modo `interaction-only`, tema claro y ancho flexible. Si no hay nada que resolver no ocupa lugar (su contenedor vacío se colapsa); si falla, deja un mensaje de error de campo.

### Navigation
No hay barra de navegación. La firma (el rótulo chico) regresa al inicio, los enlaces van dentro de la hoja y el paso entre pantallas es la cortina de lona.
- **Enlace:** peso 700, subrayado de 3px en el color de la lona, separado 0.2em. Con puntero se resalta con marcatextos al 70%, como pasado con plumón. Dentro de un aviso, el subrayado toma el color del texto.
- **Pestañas del probador:** cartulinas chicas de 44px en una tira que se desplaza de lado sin barra visible. Inactivas llevan contorno punteado de plumón al 35%; la activa es marcatextos con borde sólido de plumón y sombra de cartulina. Se recorren con las flechas del teclado.

### Opciones del probador
Piezas de ropa colgadas para elegir. Cada opción es un recuadro blanco de al menos 78×44px, con borde de 2px en borde de cartulina y trazo chico, y dentro una miniatura en pixel art de la pieza (recortada a cabeza, torso, piernas o pies). **Elegida:** borde de plumón, luz cálida radial desde arriba detrás de la pieza, halo marcatextos de 3px y una sombra corta: está bajo el foco. **Bloqueada:** pieza al 40% con una calcomanía naranja fosforescente, en plumón y girada 6°, que dice «Pronto» o el motivo. **Colores:** círculos de 48px con una muestra de 32px que lleva un sombreado interior abajo, como cartulina recortada.

### Cartulina de confirmación
Aunque la clase se llama `sello`, no es un sello de goma. Es una cartulina verde fosforescente rotulada con plumón a 1.45rem, girada −4° y pegada arriba con masking, que aparece cuando algo queda hecho («¡Enviado!», «¡Confirmado!», «¡Listo!»). Entra en 420ms (`ease-salida`, 160ms de retraso): baja 12px desde −14° hasta quedar pegada. Se anuncia con `role="status"`.

### Avisos
Una nota escrita sobre la hoja: ícono de 20px (alerta o palomita), texto en 650, trazo chico y un contorno interior de 2px. **Error:** fondo rojo plumón al 8% sobre blanco, tinta roja oscura y `role="alert"`. **Éxito:** fondo verde fosforescente al 24% sobre blanco, tinta verde oscura y `role="status"`.

### Signature: la orilla y el foco pelón
La **orilla de la lona** se calcula al ancho real: un festón cada ~150px (tres como mínimo), cada uno colgando 16px entre amarres, con un ojillo de metal en cada amarre y la costura punteada en la luz de la lona. El **foco pelón** es un socket y una bombilla en pixel art, con su halo cálido. Su **cable baja desde la orilla de la lona y termina en el socket**, sin quedar suelto. En la portada el foco cuelga sobre el huacal; en el mostrador y el espejo, sobre el maniquí.

### Signature: el perchero (portada)
Una escena de 122×88 pixeles de arte: el foco, el huacal con tu personaje a la izquierda y un perchero de dos postes con cuatro ganchos. Un solo gesto cambia el look entero. Al tocar un gancho te pruebas ese conjunto completo y la ropa que traías regresa a ese gancho. El gancho se sacude con un rebote elástico (1.1s), el personaje brinca y se aplasta (0.14s arriba, 0.12s abajo, rebote de 0.34s) y un lector de pantalla anuncia «Ahora traes…». Los ganchos se mecen desfasados y brillan con puntero. El letrero verde «¡Pruébatelo!» es decorativo.

### Signature: maniquí y espejo
Tu personaje de pie sobre un huacal de madera, con sombra elíptica ciruela y el foco encima. Del maniquí cuelga, con un hilo de cuerda, una etiqueta de cartón marcatextos con punto del tono hondo de la lona y tu nombre en plumón (`@tu_nombre` mientras no hay otro), que se mece ±3°. En teléfono sube a la firma en su versión compacta, sobre un huacal bajo y con la etiqueta hacia la izquierda. El espejo del probador gira el personaje en cuatro direcciones, lo pone a caminar y lo hace brincar con cada cambio de look: el mismo gesto que en el perchero. Todos parpadean de vez en cuando, cada 2.4 a 6 segundos.

### Signature: la calle
Al pie de cada puesto hay una banqueta de 12px, un bordillo, asfalto con grano y una raya discontinua de marcatextos (40px sí, 40px no). Por ella pasan de 3 a 9 personas en pixel art, a escala 3 y en dos carriles, cada una con un look al azar. Es ambiente: queda fuera del árbol de accesibilidad y, sin movimiento, la gente aparece parada y repartida a lo largo de la calle.

### Signature: la cortina de lona
Es el movimiento firma entre pantallas: «se corre la lona». Al cambiar de ruta, la lona anterior cubre la pantalla y se enrolla hacia arriba (`clip-path` de abajo arriba, 0.62s, `power3.inOut`) con una franja de 22px de su tono hondo al pie. Si no se puede animar, no aparece. Tiene red de seguridad a los 1200ms y nunca tapa el contenido.

### Signature: la Plaza y su HUD de papel
El mundo es pixel art a 16 px por tile con zoom entero (2 en teléfono apaisado, 3 a 4 en escritorio) y se pinta por código (ADR-0007). Su luz es de día y su paleta, la de un barrio: cantera rosada, petatillo de ladrillo, jardines con guarnición, fachadas de pintura vinílica con rótulos de cartulina fosforescente, kiosko de cobre con pátina y lambrequín de cal, jacarandas en flor y papel picado que se mece en ráfagas. **La lona que tiñe también vale en el mundo:** cada puesto proyecta sobre el suelo una sombra del color de su lona. Lo que te tapa (copas, techo del kiosko) se vuelve translúcido; nunca te pierdes de vista.

Encima va el HUD, que es papel y nunca pixel art. Arriba a la izquierda, el **letrero de la sala**: cartulina con masking, «LA PLAZA» en Big Shoulders y, en pantallas altas, una nota. Arriba a la derecha, **Salir**: cartulina que se hunde, de 46 px como mínimo. Abajo al centro, las **pistas**: teclas dibujadas como tapas de papel con canto de plumón de 4 px («W A S D o ← ↑ ↓ →») y la acción contextual en marcatextos («E · Entrar al Café»). Cambian con el método activo sin recargar y la de caminar se retira después de dos tiles. En táctil hablan los controles: el **joystick** es un disco de papel con trazo discontinuo y perilla de cartulina marcatextos (138 px) y la acción contextual es la **estrella** naranja de la portada a 124 px. Los avisos del mundo son cartulina verde con masking que se despega sola a los 3.6 s. En vertical baja la **pantalla de lona** («Gira tu teléfono»), la misma que aparece si el código de una pantalla no llega («La plaza no abrió» con Recargar).

### Signature: los nombres en la plaza
Sobre cada persona flota su nombre en una **etiqueta de papel**: cartulina con texto de plumón en Bricolage 600 a 13 px de pantalla, sin importar el zoom (el texto se escala 1/zoom para que su textura caiga 1:1 en pixeles y se lea nítido sobre el pixel art). **La tuya va en marcatextos**, para encontrarte de un vistazo. El letrero de la sala cuenta a la gente («3 personas aquí», o «Solo tú por ahora»). Si el cable con la sala se corta, aparece bajo el letrero una **cinta de masking** con un punto rojo que late («Se cortó la conexión. Reconectando…»); cuando terminar es la única salida (otra pestaña, sesión vencida, versión nueva), baja la pantalla de lona con una sola acción.

### Correo transaccional
El mismo mundo, traducido a tablas y estilos en línea. El fondo es la lona de la plantilla (verificación en rosa, bienvenida en naranja, recuperación en amarilla, contraseña cambiada en azul, amistades en verde). La orilla se arma con festones de celda y costura punteada, el rótulo mide 58px con sombra de rotulista de dos capas y la hoja es cartulina lisa, sin tinte y con radio uniforme de 6px, porque el correo no mezcla colores ni dibuja radios desiguales. Al pie va una calle (banqueta y asfalto) con la razón del envío. El botón es marcatextos con plumón, pero lleva un borde de plumón de 3px y un radio uniforme de 10px: es una traducción para clientes de correo, no el botón de la web.

## Do's and Don'ts

### Do:
- **Do** poner cada pantalla bajo una sola lona con `data-lona` y dejar que tiña el papel (`--papel`, 9%) y pinte orillas y sombras con su tono hondo.
- **Do** colgar todo formulario en una hoja con su cuerda y dos pinzas, y poner ahí todo lo que se lee de corrido.
- **Do** usar a lo más una cartulina marcatextos por hoja para la acción principal. Lo secundario va con cartulina de trazo o con un enlace subrayado en el color de la lona.
- **Do** darle a todo control nuevo sobre papel un foco de plumón (contorno de 3px, separado 2px), como la casilla y las opciones. Prueba: el marcatextos sobre papel mide de 1.00 a 1.05:1.
- **Do** hundir al presionar (de 2 a 4px, sombra hundida, 110ms, `ease-presion`) y meter todo hover en `@media (hover: hover)`.
- **Do** marcar lo elegido con la luz del foco: luz cálida detrás y halo marcatextos.
- **Do** dibujar el pixel art a escala entera, con `image-rendering: pixelated` y la densidad de pantalla redondeada.
- **Do** hacer que el cable del foco baje desde la orilla de la lona y termine en el socket.
- **Do** dejar el estado final en el CSS y animar solo con `entrance()` o tras `canAnimate()`, con red de seguridad y limpiando las propiedades en línea al terminar.
- **Do** confirmar lo hecho con una cartulina verde fosforescente pegada con masking y rotulada con plumón.
- **Do** poner el Turnstile en `interaction-only` y usar el chevrón propio en todo `<details>`.

### Don't:
- **Don't** hacer la portada de juego pixel de siempre: cielo morado degradado, tipografía pixel, brillo neón y un gran botón JUGAR.
- **Don't** ilustrar el tianguis con timidez hasta que parezca folclor de souvenir; tiene que sentirse de calle, actual y hecho a mano.
- **Don't** usar tipografía pixel en ningún texto, ni Permanent Marker en párrafos, etiquetas de campo o errores.
- **Don't** usar negro ni gris en sombras o contornos. Las sombras son ciruela y el contorno del pixel art es el color vecino hundido.
- **Don't** usar el rosa de la exploración (`#e8267f`) como lona: con cartulina encima da 4.05:1. En la ropa del pixel art sigue siendo válido.
- **Don't** poner texto de lectura directamente sobre la lona verde o la naranja, ni tinta cartulina sobre la amarilla (1.58:1): en la amarilla, la tinta es plumón.
- **Don't** fiar el foco al marcatextos sobre papel ni quitar el contorno de un campo sin darle algo visible a cambio.
- **Don't** usar tarjetas de pantalla (rectángulo blanco de radio uniforme con sombra gris) como contenedores.
- **Don't** extender la sombra dura del rótulo a cajas, botones o títulos de hoja: es la sombra del rotulista y vive solo en el rótulo.
- **Don't** usar las mayúsculas espaciadas (label caps) como antetítulo encima de un título.
- **Don't** hacer que algo dependa del hover: en teléfono no existe.
