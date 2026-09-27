---
version: 1
slug: "src-app-plaza-plazajuego-tsx"
primary_target: "src/app/plaza/PlazaJuego.tsx"
related_targets: ["src/app/plaza"]
---

# La Plaza · HUD social (Fase 7)

Modo: Operate (la persona está jugando y platicando; la interfaz no debe estorbar al mundo).
Superficie: `/plaza` (PlazaJuego y su HUD de papel sobre Phaser). Extiende la superficie existente;
el mundo «El tianguis de paca» está fijo.

Tarea: platicar con quien está en la sala, hacer gestos y, si alguien molesta, reportarlo o
bloquearlo sin salir del mundo. PC con teclado y teléfono apaisado con táctil.

Decisiones de la persona usuaria (26/09/2026): globos sobre las cabezas + tira plegable abajo a la
izquierda que se desvanece y se despliega al abrir el chat; a quien bloqueas lo sigues viendo
caminar, sin su voz ni sus gestos, con una marca discreta en su etiqueta.

## Direction contract

THESIS: Lo que dices sale de tu personaje como un recado de cartulina colgado sobre tu cabeza, y
tus gestos son del mundo, en pixel art con tu propia piel. Rechaza la caja de chat translúcida de
juego en línea (rectángulo negro al 60 % con texto blanco) y los emojis como íconos.

OWN-WORLD: cartulina con esquinas desiguales y sombra ciruela; plumón solo en lo corto («Decir»,
«Hablar»); Bricolage para leer; tu nombre en marcatextos; gestos pintados por código a escala
entera; íconos a trazo de plumón (los de `Icono`); ningún rectángulo de pantalla.

STORY: ves quién habla por el globo, lees lo último en la tira, contestas con Enter o «Hablar»,
haces un gesto con 1–4 o sus calcomanías, y a quien molesta lo tocas (o su nombre) para
reportarlo o bloquearlo.

FIRST VIEWPORT: mundo a pantalla completa; abajo a la izquierda la tira (≤4 líneas) sobre la
cartulina «Enter para hablar»; abajo a la derecha cuatro calcomanías de gestos con su tecla;
pistas al centro; globos sobre las cabezas. Teléfono: columna derecha «Hablar»/«Gestos», tira
abajo al centro, compositor arriba mientras el teclado está abierto.

FORM: extensión de la superficie existente; sin ronda de conceptos ni semilla (new-work §3,
«Extend an existing surface»).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
