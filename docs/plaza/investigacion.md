# Centro histórico de Morelia: investigación visual para el mapa

Pixel art con vista cenital 3/4 y tiles de 16 px. Cubre la catedral, la Plaza de Armas, los portales,
la Plaza Melchor Ocampo, el Palacio de Gobierno y la Av. Madero.

- Investigación hecha el 27 de septiembre de 2026. Las fotos son de Wikimedia Commons (2004–2019).
  Los datos de 2025–2026 salen de prensa local y del Ayuntamiento.
- Las 27 imágenes no están en el repo (son CC BY-SA: se usan para dibujar, no se redistribuyen).
  `node scripts/plaza/referencias.mts` las baja de Commons a `docs/plaza/referencias/` (ignorada por
  git). El catálogo de la §7 da, para cada una, la fuente, el autor, la licencia y una descripción
  visual; `docs/plaza/referencias.json` trae lo mismo en datos.
- Qué de todo esto ya está en el juego y qué falta: `docs/plaza/HANDOFF.md`.
- Los colores hex salieron de dos cosas. Primero, muestreo por *median cut* de zonas concretas de las
  fotos. Segundo, criterio propio para quitar el tinte de cada cámara. Son aproximaciones, no valores
  colorimétricos.
- No incluyo coordenadas. Las posiciones relativas («lado norte de Madero», etc.) solo sirven para
  saber qué fachada es cuál.

---

## Lo esencial para el pixel art

1. **Todo es cantera rosa.** Es una piedra volcánica porosa. Al sol se ve beige rosado y en sombra
   malva-café. Se aparejan sillares grandes con juntas visibles. Con cielo nublado vira a un
   gris-lila. Casi no hay aplanado en los edificios importantes; el Portal Allende es la excepción,
   porque está pintado de blanco.
2. **La fachada principal de la catedral mira al NORTE, hacia la Av. Madero, y no a una plaza.** La
   Plaza de Armas queda a su poniente y la Plaza Melchor Ocampo a su oriente. Esta disposición es rara
   entre las catedrales novohispanas.
3. **Aviso de orientación para la vista 3/4.** Con el norte arriba, la cámara ve las caras que miran
   al sur. Eso deja la fachada icónica *de espaldas*. Lo que miraría a cámara es la parte trasera: ver
   `referencias/catedral_vista_trasera_sur_desde_azotea.jpg`. También verían a cámara el Palacio de Gobierno y
   los portales Hidalgo y Galeana, que están al norte de Madero y miran al sur. Hay que decidir si se
   hace una licencia (dibujar la fachada «de frente») o si se usa un sprite aparte para el landmark.
4. **Dos torres casi gemelas de ≈62 m más ≈4 m de cruz (≈66–67 m).** Cada una se compone así:
   - Un **fuste cuadrado liso** que ocupa ≈43 % de la altura.
   - Una **cornisa volada**.
   - Un **1.er cuerpo cuadrado** (≈28 %). Tiene carátula de reloj blanca con marco de rayos y un gran
     arco de campanario con balcón.
   - Un **2.º cuerpo octagonal** (≈14 %).
   - Una **linternilla octagonal** con cupulín de gajos (≈10 %).
   - Una **cruz** (≈5 %).

   Hay perillones (pináculos en forma de urna o piña) en cada esquina de cada cornisa. **Los cuerpos
   altos de la torre oriente son color salmón**, más rosados que los de la poniente.
5. **Cuerpo central de la fachada.** Llega a ≈41 % de la altura de las torres. Es de barroco
   *tablerado*: pilastras con tableros planos en relieve, nichos con esculturas blanquecinas y
   medallones papales (tiara y llaves). Tiene un gran relieve sobre la puerta mayor, una ventana oval y
   remates mixtilíneos con jarrones. Hay **3 puertas en arco de madera oscura**, de las que la central
   es la mayor.
6. **Reja atrial negra de hierro forjado (s. XIX) sobre zócalo de cantera.** Tiene 8 portones
   monumentales: pilares cuadrados con jarrones y un **copete semicircular de filigrana con medallón
   oval**. Tres portones dan a Madero, uno central y uno frente a cada torre. Hay faroles negros de
   brazo sobre los pilares.
7. **Cúpula del crucero.** Tambor octagonal con ventanas y **8 gajos con azulejo azul cobalto y blanco
   en patrón de rombos, como un tablero de ajedrez girado**, más una linternilla. Hay otras cúpulas
   chicas con el mismo azulejo; una lleva un santo encima.
8. **Desde arriba, los techos de la catedral son ROJO TERRACOTA** (impermeabilizante sobre bóvedas y
   azoteas). Los recorren líneas claras de pretiles y balaustradas con perillones. La cúpula se ve como
   un disco gris claro con 8 radios. Las torres proyectan sombras largas hacia el norte.
9. **Plaza de Armas.** Jardín cuadrado dividido en cuadrantes de césped por **caminos diagonales**.
   Tiene cercas bajas verde oscuro y, al centro, un **kiosco octagonal de hierro fundido (1887)**:
   columnas negras, plafón de madera color miel, cupulín de lámina gris plata y base alta de cantera.
10. **La firma visual número 1 de la plaza** son las hileras de **ficus («laurel de la India») podados
    en bloques de copa plana, tipo tambor o cubo**, con **troncos encalados de blanco** hasta ≈1.5 m.
    Dentro de los cuadrantes hay árboles altos sueltos: jacarandas moradas en marzo, fresnos y
    liquidámbar.
11. **Fuentes.** Hay 4 de cantera gris tipo *tazón* sobre las diagonales, cada una con pileta redonda
    de borde grueso de tres molduras y una copa sobre pedestal. En el andador junto al atrio hay otra
    de columna con copa y jarrón.
12. **Mobiliario.**
    - Bancas de cantera con respaldo y brazos de voluta, y bancas curvas con respaldo calado de óculos
      alrededor del kiosco.
    - Bancas de hierro fundido verde oscuro.
    - **Pilastras cuadradas de cantera** de ≈4.5 m con un farol negro de brazo en las entradas de las
      esquinas.
13. **Portales.** Arcadas continuas de arcos de cantera, de medio punto o rebajados, sobre columnas
    toscanas. Los edificios son de 2 niveles, con balcones de herrería negra y pretiles con
    balaustrada y pináculos. Los portales de Madero llevan **toldos verdes festoneados en cada arco** y
    mesas de café dentro; por dentro tienen techo de vigas oscuras y faroles colgantes. En la esquina
    noroeste, el Hotel Virrey de Mendoza usa **toldos guinda**.
14. **Palacio de Gobierno** (frente a la catedral, al norte de Madero). Fachada larga de 2 niveles en
    cantera **más oscura y morada**. Tiene balcones de hierro individuales, portón de madera con un
    **remate central mixtilíneo blanquecino** y una fila de **pináculos** en la cornisa. Hay una
    torrecilla-campanario en la esquina.
15. **Plaza Melchor Ocampo.** Explanada abierta de losas grises con bandas oscuras en retícula. Tiene
    **bancas-cubo de cantera**, jardineras con bugambilias magenta, postes negros con **dos faroles de
    campana**, una **asta bandera muy alta** y el Ocampo de bronce oscuro sobre pedestal oscuro, con
    chorros a ras de piso.
16. **Av. Madero.** Asfalto gris de ≈4 carriles con **doble línea amarilla y boyas amarillas** al centro
    y cebras blancas. Las banquetas son de losa gris. Tiene postes negros altos de doble brazo con
    faroles de globo blanco. **Se cierra a coches** los domingos por la mañana (ciclovía) y el sábado
    por la noche.
17. **De noche** la catedral se ilumina en blanco cálido y dorado, con acentos LED magenta, violeta y
    azul. **Cada sábado a las 21:00 hay «Luces de Catedral»**: se apaga todo y hay fuegos artificiales
    dorados, rojos, verdes y azules con música. Sigue vigente en 2026.
18. **Utilería humana.**
    - Globeros con racimos enormes de globos metálicos (personajes, estrellas).
    - Carritos de churros y de chicharrones de harina.
    - Elotes bajo sombrilla roja.
    - Boleros.
    - Danza de los Viejitos, que baila con máscara rosada, sombrero con listones y bastón.
    - Palomas en las cornisas.
    - Banderas de México en septiembre.

### Paleta sugerida (≈40 colores)

| Grupo | Hex | Uso |
|---|---|---|
| Cantera catedral | `#EACFBE` | luz alta (sol bajo) |
| | `#D4B1A0` | cara iluminada |
| | `#B8928A` | medio claro (rosado) |
| | `#9A7A74` | medio |
| | `#775C58` | sombra |
| | `#523F3D` | sombra profunda / juntas |
| | `#3A2C2B` | contorno |
| Acento salmón | `#C98A7A` / `#A96A5E` | cuerpos altos de la torre oriente, portada poniente |
| Cantera portales (más amarilla) | `#E2CFB4` / `#BFA68A` / `#8C7866` | Portal Hidalgo, Galeana, Virrey de Mendoza |
| Cantera Palacio de Gobierno | `#8E7C7E` / `#6A5E60` / `#463C3E` | cantera morado-grisácea |
| Relieves y remates blanquecinos | `#E0D8CF` / `#B9AFA6` | tableros papales, remate central del Palacio |
| Techos (vistos desde arriba) | `#D07A5E` / `#B9553F` / `#843A2B` | terracotta: luz, base, sombra |
| Pretiles | `#E3DCD2` | líneas claras sobre el techo rojo |
| Azulejo de cúpula | `#253478` / `#3D4F9A` / `#EEF0F0` / `#9AA3B8` | cobalto, cobalto claro, blanco, blanco en sombra |
| Hierro (reja, kiosco, faroles) | `#1E2224` / `#353B3E` / `#4B5356` | negro verdoso y su brillo |
| Herrería de jardín y bancas | `#214A2E` / `#2F5A3A` / `#4F7A55` | verde botella |
| Ficus podado | `#8DBE45` / `#5B8C2E` / `#2F5424` | luz lima, medio, sombra |
| Césped | `#6FA03A` / `#4A7A2A` | |
| Jacaranda en flor | `#A48AD6` / `#7563B0` | |
| Bugambilia | `#D23C8C` | |
| Tronco encalado | `#F0EDE4` / `#BEB9AC` | |
| Losas de cantera del piso | `#B0A296` / `#928881` / `#6A625D` | luz, medio, junta |
| Banda oscura (Ocampo) | `#5F5C56` | retícula de la explanada |
| Asfalto Madero | `#717173` / `#5C5C5E` | |
| Líneas viales | `#E6BC3A` / `#E9E9E6` | doble línea amarilla, cebra |
| Adoquín de calle lateral | `#454447` / `#2E2E32` | |
| Guarnición pintada | `#D9B23A` / `#B04A3A` | amarilla (común), roja (junto al atrio sur) |
| Toldos | `#1F5A40` / `#123526` | verde festoneado de los portales de Madero |
| | `#A04A40` | guinda del Virrey de Mendoza |
| Madera | `#5A3A1E` / `#3A2412` | puertas; herrajes dorados `#B08A3A` |
| | `#3A2F24` | vigas del portal |
| | `#A8642C` | plafón del kiosco |
| Lámina del cupulín del kiosco | `#C4CDD2` / `#8D989E` / `#56626A` | |
| Agua de fuente | `#9CC3C0` / `#5E8C88` | |
| Noche | `#F4D596` / `#E3A857` | luz cálida |
| | `#D65DB1` / `#8E6BE0` / `#4F7DF0` | LED magenta, violeta, azul |
| | `#0B0C1A` | cielo |
| Fuegos artificiales | `#FFD66B` / `#FF5A3C` / `#5CFF7A` / `#6FA8FF` | |

---

## 1. Catedral de Morelia (de la Transfiguración)

### 1.1 Ficha rápida

- **Construcción:** 1660–1744. Las torres se terminaron en 1744. Es de **barroco tablerado**, un
  barroco sobrio y geométrico: pilastras con tableros en relieve, sin columnas salomónicas ni
  estípites. Tiene unas 200 pilastras.
- **Material:** «un enorme coloso de cantera rosa» ([SIC Cultura][sic]).
- **Planta:** cruz latina de **96 m de largo y 62 m de ancho**, con tres naves ([es.wiki][eswiki],
  [SIC][sic]).
- **Torres:**
  - [SIC][sic]: «tres cuerpos y 62 m de altura (66 si se consideran las cruces)».
  - Otras fuentes dan **66.8 m**.
  - [Wikipedia][eswiki]: una torre remata en **cruz de hierro** (naturaleza divina) y la otra en
    **cruz de piedra** (naturaleza humana). En las fotos, ambas se ven como cruces delgadas oscuras
    con herrajes y pararrayos.
- **Orientación:** la fachada «da a la avenida principal de la ciudad (Avenida Madero), y no a la
  plaza» ([Michoacán Histórico][mhcat]).

### 1.2 Fachada principal (norte, sobre Madero)

Fotos: `catedral_fachada_norte_frontal.jpg`, `catedral_fachada_norte_rejas_y_puertas.jpg`,
`catedral_fachada_central_relieves.jpg` y `catedral_portada_central_relieve_y_copetes.jpg`.

- **Composición simétrica.** La fachada se lee como `[torre][cuerpo central][torre]`.
- **Cuerpo central.** Es de triple portada, en tres cuerpos horizontales separados por cornisas y en
  tres calles verticales separadas por pilastras tableradas.
  - **Calle central, de abajo arriba:**
    - **Puerta mayor** en arco de medio punto, con madera tallada café-dorada.
    - **Gran relieve rectangular** con muchas figuras. Todo indica que es la **Transfiguración**, la
      advocación de la catedral: una figura alta al centro con figuras postradas abajo.
    - **Nichos** con esculturas blanquecinas a los lados, 2 por lado en dos niveles.
    - Una **ventana oval** (coro) enmarcada, con un pequeño busto.
    - Un **panel superior** con medallón en relieve bajo un **frontón mixtilíneo** con perillón.
    - Detrás asoma un **mástil metálico delgado** (pararrayos o asta).
  - **Calles laterales:**
    - Puerta en arco más baja.
    - Encima, **óculo redondo** (hueco negro).
    - Encima, **medallón claro con tiara y llaves papales**.
    - Abajo, relieves de escenas. Las fuentes citan la **Adoración de los Pastores** y la **de los
      Reyes Magos**; algunas mencionan también la Resurrección.
  - **Estatuas** citadas por las fuentes: San Pedro, San Pablo, San Juan Bautista, San Miguel
    Arcángel, Santa Águeda (o Santa Bárbara) y Santa Rosa de Lima.
- **Remate.** Línea quebrada de frontones curvos con **jarrones y perillones** de piedra, 8 o más
  visibles en el cuerpo central.
- **Color.**
  - La fachada es **más oscura y malva que el sillar liso de las torres** porque tiene mucha sombra
    de relieve.
  - Con nublado: `#8A7B6C` / `#756557`, sombras `#4C3D31`.
  - Los relieves y tableros papales se ven **blanquecinos** (`#D9D0C8`).
- **Frente al cuerpo central**, en la reja, está el portón mayor. Su copete de filigrana tapa en parte
  el relieve central vista desde la calle.

### 1.3 Torres

Fotos: `catedral_fachada_norte_frontal.jpg`, `catedral_torre_remate_cupulin.jpg` y
`catedral_costado_poniente_desde_atrio.jpg`.

| Tramo | % de la altura hasta la punta de la cruz* | Qué se ve |
|---|---|---|
| Fuste o base | ≈43 % | Prisma cuadrado de **sillar liso**. Solo lleva 3 ventanitas cuadradas apiladas y alguna rendija. Arriba lleva una cornisa muy volada. |
| 1.er cuerpo (cuadrado) | ≈28 % | Pilastras tableradas y, abajo, **carátula de reloj blanca con números oscuros en un marco de rayos (sol)**. Encima, **un gran vano en arco con la campana visible y balcón de balaustres**. A los lados, nichos con estatuas. Hay **4 perillones o jarrones** en las esquinas de la cornisa. |
| 2.º cuerpo (octagonal) | ≈14 % | Más angosto (≈⅔ del ancho). Vanos en arco con balconcito y medallones papales. Pináculos alrededor de la base. |
| Linternilla y cupulín | ≈10 % | Octágono pequeño con vanos rectangulares y **8 pináculos cónicos** alrededor. Encima, cupulín de piedra de **8 gajos**, base de jarrón y un aro de hierro con brazos rizados (pararrayos). |
| Cruz | ≈5 % | Cruz delgada oscura. |

\*Medido sobre la foto frontal corregida de 2017: ancho total entre bordes exteriores de torres ≈1155
px y altura hasta la cruz ≈1295 px. Cada torre ocupa ≈29 % del ancho total y el cuerpo central ≈42 %.

- **Reloj.**
  - Es alemán, se instaló en el verano de 1885 y tiene **cuatro carátulas** en una torre
    ([MiMorelia][reloj]).
  - La **matraca monumental** está «en la torre poniente justo arriba del reloj», y hay **21
    campanas** en total ([Contramuro][campanas]).
  - En las fotos de 2015–2018 se ven carátulas blancas en **ambas** torres, en la cara norte y también
    en caras laterales. Para el juego, conviene poner una carátula en la cara que mire a cámara de
    cada torre.
- **Color de las torres.** La base y el 1.er cuerpo tienen el color de la cantera general. Los cuerpos
  altos de la **torre oriente** (la izquierda vista desde Madero) se ven **salmón o rosa encendido**
  (`#C98A7A`) en fotos de 2012, 2017 y 2018; la poniente es más gris-lila.
- **Detalle recurrente:** hay **perillones o pináculos en TODAS las esquinas** de cornisas y
  balaustradas. En pixel art bastan puntos de 1×2 px de color claro con sombra.

### 1.4 Cúpulas y techos (lo que se ve desde arriba)

Fotos: `catedral_cupula_azulejos.jpg`, `catedral_vista_trasera_sur_desde_azotea.jpg` y
`vista_alta_centro_desde_poniente.jpg`.

- **Cúpula del crucero** ([es.wiki][eswiki]): «octagonal con ocho gallones sobre un tambor octagonal,
  recubierta por azulejos blancos y azules».
  - El **tambor** es de cantera, con una ventana rectangular por lado y pilastras con jarrones en las
    esquinas.
  - Los **gajos** están separados por nervios de cantera.
  - El azulejo tiene **patrón de rombos**: cuadritos azul cobalto (`#191C41`–`#253478`) y blancos
    (`#E0E3DA`) en diagonal, como un damero girado 45°.
  - La **linternilla** es octagonal con ventanitas en arco, tiene su propio cupulín de azulejo y una
    cruz de hierro con volutas.
- **Otras cúpulas.**
  - Una **cúpula menor de 6 gallones** (sacristía) con el mismo azulejo ([es.wiki][eswiki]). En una
    foto, una cúpula menor lleva encima **una estatua de santo con cruz** en vez de linternilla.
  - Una **cupulita de azulejo** junto a la base de la torre oriente (capilla), visible desde la Plaza
    Ocampo.
- **Azoteas.** Sobre los muros corre un **pretil con balaustrada de cantera y perillones o jarrones**
  cada pocos metros. Detrás de las balaustradas asoman los **lomos curvos de las bóvedas pintados de
  rojo**. Hay **gárgolas** de piedra en forma de caño cilíndrico.
- **Vista satelital** (un recorte de Esri World Imagery que se consultó y no se guarda: su licencia
  no permite redistribuirlo): los techos son **terracota brillante**
  (`#B9553F`, con zonas lavadas `#D1896D`) con líneas claras de pretiles. La cúpula es un **disco gris
  claro** con radios. Las torres se ven como octágonos rosados rodeados de pináculos. El atrio es de
  piedra clara. Las sombras de las torres caen hacia el norte, sobre el atrio y Madero.

### 1.5 Costados, parte trasera y atrio

Fotos: `catedral_costado_poniente_desde_atrio.jpg`, `catedral_y_plaza_melchor_ocampo_estatua.jpg`,
`vendedor_churros_catedral_costado_oriente.jpg`, `catedral_reja_puerta_atrio.jpg` y
`catedral_vista_trasera_sur_desde_azotea.jpg`.

- **Portadas laterales.** La oriente, hacia la Plaza Ocampo, está dedicada a la **Virgen de
  Guadalupe**; la poniente, hacia la Plaza de Armas, a **San José** ([es.wiki][eswiki]). Las dos
  siguen el mismo esquema:
  - Salen del muro como un cuerpo más alto.
  - Puerta en arco con **madera tallada y herrajes dorados**.
  - Encima, un relieve de santo con ángeles (en la poniente, entintado en **rojo-rosado**).
  - Encima, una ventana oval.
  - Arriba, un medallón y una balaustrada con jarrones.
- **Muros de las naves.** Son **planos de sillar** con pocas aberturas: 2 óculos ovales pequeños, 2
  ventanas rectangulares con reja y 3 faroles negros de pared por tramo. Un contrafuerte marca los
  tramos. Encima hay un segundo plano retranqueado con balaustrada y perillones.
- **Parte trasera (sur).** Tiene **muros masivos casi ciegos** con pilastras-contrafuerte y un
  **hastial con cruz** de piedra. Lleva balaustradas con perillones, caños o gárgolas y escaleras
  marineras metálicas. Es lo que vería la cámara en un mapa con el norte arriba.
- **Costado oriente, junto a la torre.** Hay un **anexo de 2 niveles aplanado en blanco o crema con
  marcos de ventana rojos** y la cupulita de azulejo.
- **Atrio.** Es una plataforma de losas de cantera clara (`#F2EBE3` al sol).
  - Al frente (norte) es una franja angosta.
  - Al poniente es amplio (se ve gente y hasta un coche).
  - Unos escalones lo elevan sobre la calle; hay **4 escalones** en la puerta trasera.
- **Reja atrial.** Es de hierro forjado del s. XIX; según las fuentes se colocó en 1854 y costó 42,000
  pesos. Tiene **8 portones de estilo neoclásico** que jerarquizan los órdenes clásicos:
  - toscano en el extremo suroriente;
  - dóricos en las portadas del crucero;
  - jónicos en los ángulos norte;
  - corintios en las naves menores;
  - compuesto en la puerta mayor.

  Esto viene de un texto del sitio de la Catedral que citó el buscador. Cada portón tiene:
  - **2 pilares cuadrados de sillar** de ≈4.5–5 m, con pilastras, cornisa volada y **jarrón con
    piña** encima, y una **voluta de piedra** en la base.
  - Una **puerta de dos hojas de barrotes** con bandas de arquillos góticos, anillos cuadrifolios y
    celosía diagonal.
  - Un **copete semicircular de filigrana** (≈1.5–2 m) con **medallón oval** (tiara o mitra).

  Entre portones, la reja es de **barrotes negros con punta de lanza** (≈2.5 m) sobre zócalo de
  cantera de ≈0.6–1 m.
- **Faroles del atrio.** Son faroles negros de brazo en los pilares de los portones: **4 al frente**,
  2 junto al portón central y 1 en cada portón de torre. En los costados hay postes negros con
  faroles.

### 1.6 De noche

Fotos: `catedral_noche_iluminacion.jpg` y `catedral_noche_fuegos_artificiales.jpg`.

- **Iluminación escénica LED multicolor.** La base es **blanco cálido y dorado** con luz rasante de
  abajo arriba. Hay acentos **azul frío** en la portada central, **magenta y violeta** en los copetes
  y a veces **verde-blanco-rojo** en los vanos de campanario (fiestas patrias). Los relojes se ven
  como discos blancos brillantes. Todo se recorta contra un cielo casi negro.
- **«Luces de Catedral» / encendido de Catedral.** Es **cada sábado a las 21:00**, gratis.
  - Dura **pocos minutos**: la catedral empieza a oscuras, suena música, estallan fuegos artificiales
    y la iluminación aparece poco a poco.
  - Usa **≈650 artefactos pirotécnicos en amarillo, azul, rojo y verde**, 16 bocinas medias y 8
    graves.
  - Reúne a ≈3,000 personas y más de 6,500 en vacaciones ([MiMorelia, sept. 2025][luces]).
  - Sigue vigente en 2026: en mayo el Ayuntamiento anunció «Ritmos de Catedral» como previa del
    encendido «que, como cada sábado, reúne a miles» ([Quadratín][ritmos], [Ayuntamiento][ayto]).
  - Madero se cierra al tráfico en esos horarios. La gente se para en la avenida, el atrio y las
    plazas.
- La foto de fuegos es del **sábado 10 de agosto de 2019 a las 21:03**, es decir, del espectáculo
  mismo: humo blanco y un «crisantemo» dorado-naranja sobre la torre.

### 1.7 Proporciones útiles para el sprite

- Fachada norte: **ancho : alto (hasta la cruz) ≈ 1 : 1.12**. Cada torre ≈ 0.29 del ancho y el centro
  ≈ 0.42.
- Coronamiento central ≈ 0.41 de la altura total; calles laterales del centro ≈ 0.33.
- Puerta mayor: alto ≈ 0.14 y ancho ≈ 0.08 de la altura total.
- **Ejemplo en tiles:** una fachada de 12 tiles de ancho (192 px) daría torres de 3.5 tiles de ancho y
  unos 13.5 de alto. Los juegos suelen comprimir la vertical a unos 9–10 tiles. Una receta posible
  para las torres, de abajo arriba:

  | Tramo | Tiles |
  |---|---|
  | Base | 4 |
  | 1.er cuerpo | 2.5 |
  | 2.º cuerpo | 1.5 |
  | Linternilla | 1 |
  | Cruz | 0.5 |

  El centro sería de 5 tiles de ancho y 4 de alto.

---

## 2. Plaza de Armas (Plaza de los Mártires)

Fotos: todas las `plaza_armas_*`, más `madero_poniente_virrey_de_mendoza.jpg` y
`vendedor_globos_catedral.jpg`.

### 2.1 Traza

- Es un **jardín cuadrangular al poniente de la catedral**. Su **kiosco central** es de 1887 y está
  «diseñado con caminos diagonales, jardineras, pilastras con faroles y bancas de cantera en su
  alrededor, así como fuentes elaboradas con esta materia prima» ([Cultura][cultpda]).
- Los **caminos diagonales** salen de las esquinas, donde hay **pares de pilastras-farol**, pasan por
  una fuente y llegan al anillo del kiosco. Los **4 cuadrantes de césped** tienen cercas bajas.
- **Andador oriente** («Andador Juárez» / «Plaza Presidente Juárez» en OSM): es la franja pavimentada
  entre el jardín y el atrio de la catedral, con filas de ficus, bancas, una fuente de columna, la
  placa UNESCO y la estatua de Juárez. Al sur termina en la Cerrada de San Agustín; al fondo se ve la
  torre de San Agustín, con cúpula rojiza.
- **Historia de los cambios, en resumen:**

  | Año | Cambio |
  |---|---|
  | 1843 | Se enlosa. |
  | 1871–74 | Se hacen **4 fuentes** en las esquinas. |
  | 1887 | Llega el kiosco de hierro fundido; según una fuente se hizo en **Londres**. |
  | 1952 | Pilastras de cantera, más árboles y bancas de piedra. |
  | 2004 | Restauración integral: losas de cantera, jardines, herrería que delimita los cuadrantes, iluminación escénica y liquidámbar. |
  | 2016 | Se restaura el kiosco. |
  | Ene 2026 | Se restauran bancas de cantera, empezando por los respaldos dañados. |

  Fuentes: [Flickr quokant, historia de la plaza][qk1], [Michoacán Histórico][mhplazas],
  [VisitPátzcuaro][vp] y [MiMorelia 2026][bancas].

### 2.2 Kiosco

Fotos: `plaza_armas_kiosco.jpg` y `plaza_armas_kiosco_cupula_jacarandas.jpg`.

- **Forma:** planta **octagonal**. Mide ≈8–9 m de ancho y ≈9–10 m de alto hasta la cruz (estimado con
  la puerta de la base, de ≈1.9 m).
- **Base:** podio de **cantera** de ≈1.9–2 m de alto, con un **tablero rehundido por cara** y cornisa
  moldurada. En una cara hay una **puertita de lámina negra** (bodega). No encontré fotos de la
  escalera de acceso.
- **Estructura:** **8 columnas delgadas de hierro fundido negro**, con fuste torso o estriado y anillos.
  Entre columnas hay **ménsulas y un friso calado** de encaje de hierro, y un **barandal de hierro
  negro** alrededor de la plataforma.
- **Techo:** alero octagonal con **crestería de hierro** (florones) en el borde. El **plafón** es de
  duela de madera barnizada **color miel-naranja** (`#A8642C`, sombra `#7A4420`) en triángulos
  radiales, con un farol colgante al centro. Encima lleva un **cupulín de lámina gris plata** en forma
  de campana u ojiva, con costillas verticales (`#C4CDD2`, sombra `#6D7A80`) y **cruz de hierro**
  pequeña.
- **Proporción vertical:** base ≈20 %, columnas ≈45 %, alero, cupulín y cruz ≈35 %.
- **Alrededores:** un **anillo de jardinera** con césped y cubresuelos variegados, cercado con **reja
  baja negra** de postes con dos travesaños. Luego viene el camino circular y un anillo de **bancas de
  cantera curvas con respaldo calado de óculos ovales**.
- **Decoraciones de temporada que se cuelgan del kiosco:**
  - En septiembre, una **campana gigante de oropel verde** (foto de 2009).
  - En Día de Muertos, **catrinas** gigantes alrededor (foto de noviembre de 2013).

### 2.3 Fuentes

Fotos: `plaza_armas_fuente_cuadrante.jpg`, `plaza_armas_pilastras_faroles_entrada.jpg` y
`plaza_armas_fuente_columna_ficus_bancas_hierro.jpg`.

- **Tipo A, «tazón».** Hay **4**, una en cada diagonal del jardín (OSM marca 4 fuentes alrededor del
  kiosco).
  - **Pileta redonda** de Ø≈5 m cuyo borde (≈60 cm) está hecho de **3 hiladas redondeadas apiladas**
    de cantera **gris porosa** (luz `#B2A8A2`, sombra `#5F5D5A`).
  - Al centro, un **plinto cuadrado** (≈1 m), un **pedestal abalaustrado** y una **copa ancha y
    plana** (Ø≈2 m) que rebosa, con un borbotón al centro.
  - Alrededor hay **luminarias rectangulares empotradas** en el piso.
- **Tipo B, «columna».** Hay **1**, en el andador oriente, cerca de Madero.
  - **Pileta redonda** de Ø≈6 m con borde de **tableros verticales** y un escalón perimetral saliente.
  - **Columna central anillada**, una **copa chica** a ≈2 m y un **jarrón con piña** arriba (≈3.5 m
    en total), en cantera gris-café.

### 2.4 Bancas

- **De cantera con respaldo:** asiento y respaldo macizos con **brazos de voluta** en los extremos,
  de ≈2 m de largo y color de cantera beige-rosa. Van a lo largo de las orillas del jardín (foto del
  andador). Alrededor del kiosco son **curvas con respaldo calado de óculos**.
- **De hierro fundido verde botella** (`#214A2E` / `#4F7A55`): respaldo ornamental, patas curvas,
  estilo porfiriano. Van en filas bajo los ficus del andador (fotos de 2012).

### 2.5 Faroles y pilastras

Fotos: `plaza_armas_pilastras_faroles_entrada.jpg` y `plaza_armas_andador_ficus_bancas_cantera.jpg`.

- **Pilastras de cantera** de ≈4.5 m, de sección cuadrada (≈60 cm): basa, fuste con tablero rehundido
  y ornamento tallado, cornisa y **remate de piña**. Cada una lleva **1 farol negro** de vidrio
  esmerilado en un brazo de voluta cerca de la punta; alguna lleva 2, uno arriba y otro abajo. Van en
  **pares en las entradas de las esquinas** y en **fila en el borde oriente**. En fiestas cuelgan
  **banderolas rojo-amarillo** con escudo.
- **Postes de hierro negro** con farol dentro del jardín.
- **En Madero:** postes negros altos de **doble brazo curvo con faroles de globo blanco**, algunos con
  corona ornamental.

### 2.6 Árboles y jardines

- **Perímetro y andadores:** **ficus podados**. Las fuentes los llaman «laurel de la India» (*Ficus
  retusa*); el autor de una foto los identifica como *Ficus benjamina*, «higo».
  - Copas recortadas en **bloques de tapa plana**, entre tambor y cubo: ≈4–5 m de ancho y ≈3 m de
    alto. El verde es brillante: lima al sol `#8DBE45`, medio `#5B8C2E`.
  - Los troncos, a veces dobles o triples, van **encalados de blanco** hasta ≈1.5–2 m.
  - Espaciado de ≈6–8 m.
- **Dentro de los cuadrantes** hay árboles altos de copa suelta: **jacarandas** (lila en
  febrero–abril), **fresnos**, **liquidámbar** (plantados en 2004) y otros. También tienen el tronco
  encalado.
- **Césped** verde con cenefas de flores. En temporada, arriates de colores: cempasúchil en noviembre,
  nochebuenas en diciembre.
- **Cercas de jardín:** **reja baja verde botella** (≈60–80 cm) de barrotes con remate de arco
  (herrería de 2004).

### 2.7 Piso

- **Losas rectangulares de cantera** en hiladas corridas (aparejo a soga), de tono gris-rosado
  (`#B0A296` / `#928881`, juntas `#6A625D`). En la sombra se ven azulados.
- Hay luminarias empotradas junto a las fuentes. Las guarniciones son de cantera.

### 2.8 Monumentos y placas

- **Estatua de Benito Juárez** (1962), en el extremo sur del andador oriente, frente a Allende
  ([Michoacán Histórico][mhplazas] y OSM).
- **Placa UNESCO** metálica en el andador, cerca de Madero. Texto según OSM: «MÉXICO – UNESCO / CENTRO
  HISTÓRICO DE LA CIUDAD DE MORELIA / PATRIMONIO CULTURAL DE LA HUMANIDAD / DICIEMBRE DE 1991».
- **Esculturas de los mártires:** figuras estilizadas de cantera, dos siluetas encapuchadas con las
  manos juntas y pliegues geométricos. Están **adosadas al muro de la catedral del lado de la plaza**,
  cada una en un corralito de reja negra. Recuerdan a los fusilados en la plaza (descripción en
  Commons, 2012).

### 2.9 Gente, vendedores y ambiente

- La plaza es «la sala de Morelia»: «estudiantes, boleros, turistas y oficinistas» ([VisitPátzcuaro][vp]).
- **Globeros:** racimos de 40 o más globos metálicos, entre estrellas azules y plateadas, Bob Esponja,
  Elmo y corazones, más pelotas de playa a rayas amarillo, morado y blanco. Miden ≈1.2 m de ancho y
  ≈2.5 m de alto, montados en palos (foto de 2009; también en la Plaza Ocampo en 2011).
- **Comida y dulces:**
  - **Churros** en charola de lámina sobre tijera, en bolsas.
  - **Chicharrones de harina** anaranjados en canasta de mimbre.
  - **Elotes y esquites** en carrito-bicicleta con **sombrilla roja o rosa**.
  - **Gazpacho moreliano:** fruta picada con queso cotija, chile y limón. Los puestos se concentran
    «detrás de la catedral» y hacia San Agustín ([nota][gazp]).
  - Los **dulces típicos** (ates, cajeta, morelianas, rompope, gaznates) se venden sobre todo en el
    Mercado de Dulces, fuera de la plaza.
- **Espectáculos:** la **Danza de los Viejitos** se presenta en la Plaza de Armas, sobre todo los
  sábados por la noche y en vacaciones. Los danzantes llevan máscara rosada de viejito, sombrero de
  paja con listones de colores, bastón y ropa blanca con bordados. También hay **organilleros**
  ([Descubre Michoacán][dm]).
- **Palomas:** en cornisas, copetes de la reja y el piso.

---

## 3. Los portales

Los nombres honran a héroes de la Independencia: **Hidalgo, Galeana, Aldama, Allende y Matamoros**. La
ubicación de cada uno sale de las **fichas técnicas del IMPLAN Morelia** (2022–2023), que dan el
nombre del portal con su numeración y esquina ([FI_1–4, 772–785][implan]).

| Portal | Lado y calle | Tramo | Mira hacia | Nombre anterior | Qué hay (2022–2026) |
|---|---|---|---|---|---|
| **Hidalgo** | Norte de **Av. Madero Pte.** | De **Guillermo Prieto** a **Ignacio Zaragoza** | Sur, a la Plaza de Armas | Portal de Guadalupe (según [Cambio de Michoacán][cambio], 2026) | **Hotel Casino** (Portal Hidalgo 229), **Café Catedral** (213), **Hotel Misión Catedral** (esquina Zaragoza). «El más popular, con la mejor vista y café». |
| **Galeana** | Norte de **Av. Madero** | De **Zaragoza** a **Benito Juárez** | Sur, al andador y el atrio poniente | **Portal de la Nevería** ([HMDB][hmdb]) | 5 edificios de los ss. XVII–XVIII. **Sanborns** (171, esquina Zaragoza), **Café Europa** (143), **Banorte** (117). |
| **Matamoros** | **Poniente**, sobre **calle Abasolo** | De **Madero** a **Allende** | Oriente | **Ecce Homo** | Es el más largo. **Hotel Virrey de Mendoza** (esquina Madero), **Teatro Mariano Matamoros** (reinaugurado en 2021 tras más de 10 años de obra), **Hotel Casa Grande** (Portal Matamoros 98, esquina Allende) y Panoli. |
| **Allende** | **Sur**, sobre **calle Allende** | De **Abasolo** a **Hidalgo / Cerrada de San Agustín** | Norte | Le dicen **«Portal Michelena»** | **Café Michelena** (Allende 209, esquina Hidalgo); los hermanos Michelena nacieron en el 237. Cafés y restaurantes. |
| **Aldama** | **Sur**, sobre **calle Allende** (continuación al oriente) | De **Hidalgo** a **García Obeso**, frente al lado surponiente de la catedral | Norte | – | Locales comerciales con cortinas metálicas verdes, un puesto de periódicos, cafés. |

Nota: el OSM que ya tienes pone `alt_name=Portal Aldama` al tramo de Allende **al poniente** de
Hidalgo. Según el IMPLAN, ese tramo es el **Portal Allende**; Aldama empieza al oriente de Hidalgo.
Tampoco es cierto que el Ayuntamiento esté en el Portal Allende: el Palacio Municipal está más al
poniente, sobre Allende.

**Cómo se ven** (IMPLAN y fotos `portal_*` y `madero_poniente_virrey_de_mendoza.jpg`):

- **Estructura común:**
  - Planta baja porticada con **columnas toscanas de cantera** (fuste redondo gris-café `#877E76`) y
    **arcos de cantera labrada**. El IMPLAN los llama «rebajados», pero en fotos casi todos se ven de
    medio punto.
  - Módulo de arco de ≈3.5–4 m y **profundidad del portal ≈4–5 m**.
  - **Techo plano de vigas de madera oscura** (`#3A2F24`) y **faroles negros hexagonales colgantes**
    cada arco o dos.
  - Muro del fondo **aplanado crema** con puertas en marco de cantera y cerrajería.
  - Piso de losas gastadas.
- **Por edificio:** 3 a 12 arcos.

  | Edificio | Arcos |
  |---|---|
  | Hotel Casino | 6 |
  | Portal Galeana 117–103 | 5 |
  | Cada edificio del Portal Allende | 12 |
  | Portal Aldama 98–169 | 12 |
  | Cada edificio del Portal Matamoros | 7 |

- **Planta alta:** **ventanas-balcón** con herrería negra sobre un **repisón volado** y marcos de
  cantera. En Hidalgo y Galeana llevan **frontones triangulares o curvos** y pilastras (corintias en
  Galeana, jónicas estriadas en Matamoros). Arriba va un **pretil con balaustrada y pináculos
  ornamentados**.
- **Colores por portal:**
  - **Hidalgo y Galeana:** cantera **beige-dorada clara** (`#DFCDB4`), más amarilla que la catedral, y
    **toldos verde botella festoneados** (`#1F5A40`) en todos los arcos, vigentes en las fotos de
    2013 y del IMPLAN de 2022.
  - **Virrey de Mendoza:** cantera clara (`#DEC2A4`), **3 niveles**, un **mirador de 3 arcos** en el
    último piso y **toldos guinda** (`#A04A40`) en arcos y ventanas. El nombre va en letras oscuras en
    el friso.
  - **Portal Allende:** **aplanado de mortero con pintura**; hoy es **blanco o crema** con arcos y
    marcos de cantera rosada y balcones negros. Antes era rojizo.
  - **Portal Aldama:** aplanado **rosado o salmón** en parte.
- **Mesas de café bajo los arcos:** mesas de madera clara con sillas blancas de plástico o de madera
  oscura, en largas filas. Hay pizarrones con el menú en la entrada.

---

## 4. Plaza Melchor Ocampo (al oriente de la catedral)

Fotos: `plaza_melchor_ocampo_explanada.jpg`, `catedral_y_plaza_melchor_ocampo_estatua.jpg`,
`vendedor_churros_catedral_costado_oriente.jpg` y `hotel_los_juaninos_fachada_2006.jpg`.

- **Qué es:** una **explanada abierta** de uso cívico: izamiento de bandera, mítines, altares de
  muertos. Antes se llamó «Plazuela de la Obra de la Catedral» y «Plaza de San Juan de Dios».
- **Piso:** **losas grises o beige** (`#7B776B`) con **bandas más oscuras** (`#5F5C56`) que forman
  una retícula de cuadros grandes.
- **Estatua de Melchor Ocampo.** Es de **bronce oscuro** (`#252C36`), de pie, de 1888, obra de
  Primitivo Miranda. Originalmente tenía 4 figuras alegóricas de mármol (Historia, Industria,
  Justicia y Filosofía), hoy perdidas. Hoy se levanta sobre un **pedestal de piedra oscura en forma de
  dado con placa**, sobre una **plataforma o pileta baja de piedra gris oscura** a nivel de rodilla.
  Tras el atentado del 15 de septiembre de 2008 se **bajó el pedestal**, se quitó la **fuente norte**
  y el libro de bronce, y se puso una **fuente a ras de piso** ([Michoacán Histórico][mhplazas]).
- **Fuentes danzantes:** chorros que salen del pavimento. Se rehabilitaron en febrero de 2026 y
  funcionan en **dos turnos de ≈3 h, mañana y tarde** ([MiMorelia][danz]).
- **«Árbol de los Liberales».** Era una **acacia** plantada por la masonería. **Ya no existe**:
  desapareció entre 2012 y 2015, y el árbol de reemplazo cayó en enero de 2022. Hoy solo queda una
  **losa de cantera** con la frase de Ocampo: «Ser liberal en todo cuesta trabajo porque se requiere
  ser hombre en todo» ([Quadratín 2022][acacia]). Está en el borde oriente de la plaza, hacia Morelos
  Sur (OSM).
- **Mobiliario:**
  - **Bancas-cubo de cantera clara** (≈50 cm, `#98937F`) en filas.
  - **Jardineras rectangulares** con bordillo de cantera, **bugambilias magenta y moradas** y
    arbustos.
  - **Macetones cuadrados** de cantera con arbustos a lo largo de la reja del atrio.
  - **Postes negros con 2 faroles tipo campana** en un travesaño.
  - **Postes altos de doble brazo** con globos blancos.
- **Asta bandera** muy alta y delgada, gris verdosa: aquí se iza la bandera en septiembre.
- **Árboles:** jacarandas al norte; naranjos y otros en las jardineras del oriente. Los laureles de la
  India viejos se quitaron en la remodelación ([álbum Flickr «Plaza Ocampo»][qkoc]).
- **Edificios alrededor:**
  - **Hotel Los Juaninos** (Morelos Sur 39, mira al poniente, a la plaza). Fue **palacio episcopal**
    a fines del s. XVII, **hospital de San Juan de Dios** desde 1700 y hotel desde 1998. En la foto de
    2006 se ve así:
    - Dos niveles.
    - Planta alta **aplanada crema** con pilastras de cantera rosada labradas con figuras y medallones.
    - **Balcones de herrería** y una **ventana central en arco**.
    - Letrero **«HOTEL LOS JUANINOS»** en letras oscuras en el friso.
    - Planta baja de cantera con locales y puerta de madera entre dos faroles negros.
    - **Terraza-restaurante en la azotea** con vista a la catedral ([hotel][juan]).
  - En el mismo lado hay edificios de 2 niveles **ocre o crema** y uno **blanco neoclásico con
    balaustrada** (tienda «Modatelas» en 2011).
  - Al norte, cruzando Madero, está el **Palacio de Gobierno**.

---

## 5. Palacio de Gobierno y Av. Madero

### 5.1 Palacio de Gobierno

Foto: `palacio_gobierno_fachada_madero.jpg`.

- Está al norte de Madero, entre Juárez y Morelos, **frente a la catedral** y la Plaza Ocampo. Fue el
  **Seminario Tridentino** (1760–1770) y es sede del Ejecutivo desde 1867. Es de **barroco
  tablerado**, con **2 niveles y 3 patios** con arquerías; dentro hay murales de **Alfredo Zalce**
  ([es.wiki][pal]).
- **Fachada:**
  - Larga y horizontal, de ≈9 ejes a cada lado del centro.
  - **Cantera más oscura y morado-grisácea que la catedral** (`#8E7C7E` luz, `#463C3E` sombra), con
    **pilastras tableradas** entre ventanas.
  - **Planta baja:** ventanas rectangulares con **reja y balconcito** al nivel del alféizar.
  - **Planta alta:** **ventanas-balcón con balcón individual de herrería negra** sobre repisón de
    piedra.
  - **Faroles negros de brazo** entre ventanas.
- **Eje central:**
  - **Portón de madera tallada** café-dorada entre pilastras.
  - Encima, **balcón corrido** y ventana.
  - Arriba, un **remate mixtilíneo blanquecino** (`#C8C0BA`) con volutas, medallón y una campanita.
- **Cornisa:** una **fila de pináculos altos de piedra** (≈15 visibles) y caños o gárgolas
  sobresalientes. En la esquina oriente hay una **torrecilla-campanario calada con cupulín y cruz**;
  en la poniente, otra menor.

### 5.2 Avenida Francisco I. Madero

Fotos: `portal_hidalgo_hotel_casino_madero.jpg`, `madero_poniente_virrey_de_mendoza.jpg` y
`palacio_gobierno_fachada_madero.jpg`.

- Frente a la plaza y la catedral es **asfalto gris de ≈4 carriles**. Al centro lleva una **doble línea
  amarilla con una fila de boyas amarillas** en relieve; no hay camellón arbolado en las fotos de
  2012–2019. OSM la traza como dos vías de un sentido.
- **Pavimento:** flechas y líneas blancas, **cebras de barras blancas** en las esquinas y guarniciones
  pintadas de **amarillo**.
- **Balizamiento de mayo de 2026:** se repintaron cruces, líneas, **triángulos de prioridad ciclista**
  y el **«camellón central»** entre las Tarascas y Cuautla ([La Voz][lavoz]). Vale verificar en Street
  View reciente si ese separador tiene ya alguna forma física frente a la catedral.
- **Banquetas** anchas de **losas grises** (`#8A8B8D`). **Postes negros altos de doble brazo** con
  faroles de globo blanco, cada ≈20–25 m.
- **Usos especiales:**
  - **Ciclovía recreativa** los domingos de 8:00 a 13:00 ([MiMorelia][ciclo]).
  - Cierre peatonal en fines de semana, de Nigromante a Pino Suárez ([MoreliActiva][peat]).
  - Cierre para el encendido del sábado.
  - Desfiles (30 de septiembre, 16 de septiembre).
- Las **calles laterales** (Allende, Morelos Sur y la Cerrada) son de **adoquín o piedra** con
  guarnición amarilla o roja. La Cerrada de San Agustín es peatonal desde 1973.

---

## 6. Otros rasgos que un moreliano reconoce al instante

- La **silueta de las dos torres** domina el horizonte desde cualquier punto (ver
  `vista_alta_centro_desde_poniente.jpg`). Los otros templos (la Compañía, hoy Biblioteca Pública) se
  distinguen por sus **cúpulas rojo o rosa**; la de la catedral es la **azul y blanca**.
- **«Cantera rosa en todo»:** marcos de puertas y ventanas, pilastras, cornisas y **gárgolas**, aunque
  el muro esté aplanado de amarillo, blanco o salmón en calles como Allende.
- **El encendido del sábado** (fuegos más luces) y **la catedral iluminada** de noche.
- El **órgano monumental** (interior). Es un Walcker alemán inaugurado en 1905, con ≈4,600 tubos, 3
  teclados y una caja neobarroca de madera con tubos dorados. Es sede del **Festival Internacional de
  Órgano** desde 1966 ([es.wiki][organo]).
- **Campanas y matraca:** 21 campanas; la matraca gigante se toca solo en Semana Santa.
- **Palomas**, **globeros**, **boleros**, **Danza de los Viejitos**, **tranvías turísticos** (autobuses
  con carrocería de madera tipo tranvía, rojo-café, que se ven en
  [una foto nocturna de 2018](https://commons.wikimedia.org/wiki/File:Toma_del_costado_sur_de_la_Catedral_de_Morelia.jpg),
  HRJuarez, CC BY-SA 4.0), **gazpacho**, churros.
- **Banderas de México** colgadas de los vanos del campanario en septiembre, **catrinas** en noviembre y
  adornos navideños con **letras gigantes «MORELIA»** en diciembre. En 2017 hubo letras «MORELIA» con
  motivos de talavera junto a la catedral; no confirmé si siguen.
- **Placa UNESCO** de 1991 en la Plaza de Armas.

---

## 7. Catálogo de imágenes (`docs/plaza/referencias/`, se bajan con el script)

Todas vienen de Wikimedia Commons; la miniatura es la de 1280 px de ancho salvo que se indique otra
cosa. Las licencias CC BY-SA piden atribución y compartir igual **si se redistribuyen**; como
referencia para dibujar, no se redistribuyen. No descargué las fotos de las fichas del IMPLAN porque
son de Google Maps; solo las consulté.

### Catedral

**1. `catedral_fachada_norte_frontal.jpg`** (1280×1385)

- **Fuente:** [MoreliaCathedral170627p1.jpg](https://commons.wikimedia.org/wiki/File:MoreliaCathedral170627p1.jpg).
- **Autor y licencia:** Carlos Valenzuela, CC BY-SA 4.0, 27 de junio de 2017.
- **Encuadre:** **frontal casi ortogonal** (panorámica corregida) de la fachada norte desde Madero,
  con cielo nublado. Es la mejor para las proporciones (ver §1.3 y §1.7).
- **Qué se ve:**
  - **Torres:** base de sillar liso con 3 ventanitas por torre. En el 1.er cuerpo, relojes blancos con
    números romanos oscuros dentro de un sol de piedra (izquierda ≈10:10), arco de campanario con la
    campana y balcón, y estatuas en nichos. Siguen el 2.º cuerpo octagonal y la linternilla con
    cruces. La **torre izquierda (oriente) tiene la parte alta salmón** (`#C98C78`); la derecha es
    gris-lila (`#8A7469`).
  - **Centro:** remate mixtilíneo con perillones y un mástil, 3 puertas en arco (la central de madera
    dorada), óculos y medallones papales.
  - **Reja:** reja negra con **3 portones de copete de filigrana** y 4 faroles negros de brazo.
  - Alrededor: a la izquierda un arbolito y a la derecha un árbol grande (lado de la Plaza de Armas).
    Hay gente de escala: una persona mide ≈1/22 de la altura de la torre en la imagen, pero está más
    cerca de la cámara.

**2. `catedral_fachada_norte_rejas_y_puertas.jpg`** (1280×853)

- **Fuente:** [Catedral_de_more.jpg](https://commons.wikimedia.org/wiki/File:Catedral_de_more.jpg).
- **Autor y licencia:** TonyRaw, CC BY-SA 4.0, 30 de agosto de 2015.
- **Encuadre:** **gran angular** desde la banqueta de Madero con sol lateral y cielo azul con nubes.
  **No sirve para proporciones.**
- **Qué se ve:**
  - Los **3 portones** de la reja con copetes semicirculares negros de rizos y medallón oval; los
    pilares con jarrones y **faroles negros de brazo**.
  - Las **3 puertas de madera en arco** (`#4A321A`) detrás de la reja.
  - El atrio elevado con escalón, los **dos relojes** (ambas torres), la cantera cálida café-rosada
    (`#A27E5E` en luz, `#543C29` en sombra) y los muros de sillar con juntas.
  - En el piso de la calle, **arte urbano pintado** en franjas rojo, amarillo, azul y rosa. Es
    temporal.

**3. `catedral_fachada_central_relieves.jpg`** (1280×961)

- **Fuente:** [MoreliaCathedral19.JPG](https://commons.wikimedia.org/wiki/File:MoreliaCathedral19.JPG).
- **Autor y licencia:** AlejandroLinaresGarcia, CC BY-SA 3.0, 29 de abril de 2012.
- **Encuadre:** frontal del **cuerpo central** con luz de tarde.
- **Qué se ve:**
  - 3 calles con pilastras tableradas.
  - Arriba, un panel blanco con medallón bajo un frontón curvo coronado por perillón. Debajo, un
    **óculo oval** con busto y **4 estatuas blancas en nichos** (2 por lado en dos niveles).
  - En las calles laterales, **medallones blancos con tiara y llaves**, **óculos negros** y, abajo,
    **relieves blanquecinos de escenas**.
  - Delante, el **copete central de la reja** (filigrana negra con medallón de tiara) y 2 jarrones de
    piedra sobre los pilares.
- **Color:** cantera rosado-lila (`#A8888A` en luz, `#6F5654` en sombra) y relieves `#D9D0C8`.

**4. `catedral_portada_central_relieve_y_copetes.jpg`** (1280×857)

- **Fuente:** [Morelia_Cathedral_DSC_0450_AD.JPG](https://commons.wikimedia.org/wiki/File:Morelia_Cathedral_DSC_0450_AD.JPG).
- **Autor y licencia:** Adavyd, CC BY-SA 3.0, 14 de enero de 2012.
- **Encuadre:** de cerca, la **portada central**.
- **Qué se ve:**
  - El **gran relieve rectangular** sobre la puerta mayor (figura central elevada con otras debajo; la
    Transfiguración) con 2 estatuas en nichos a cada lado, un óculo oval arriba y un escudo papal en el
    remate.
  - Los **dos copetes laterales de la reja en detalle**: semicírculos de rizos de hierro negro con un
    óvalo que encierra una tiara. Miden ≈40 % del ancho del portón.
  - Jarrones o urnas de cantera en los pilares, sillares grandes rosados y el arco superior de la
    puerta de madera.

**5. `catedral_torre_remate_cupulin.jpg`** (1280×1707)

- **Fuente:** [Detalle_de_cupula_de_torre_de_catedral_de_Morelia.JPG](https://commons.wikimedia.org/wiki/File:Detalle_de_cupula_de_torre_de_catedral_de_Morelia.JPG).
- **Autor y licencia:** Octaviocarachure, CC BY-SA 4.0, 4 de febrero de 2010.
- **Encuadre:** la **punta de una torre** con cielo azul intenso.
- **Qué se ve:**
  - Octágono con **vanos rectangulares** moldurados.
  - **8 pináculos cónicos** (tipo trompo) sobre pedestales alrededor.
  - **Cupulín de 8 gajos** de piedra y un remate en forma de jarrón o copa.
  - Un **aro de hierro con brazos rizados** y la cruz (pararrayos, con cable que baja).
  - Debajo, la cornisa con dentículos y **medallones con tiara y llaves** en marcos redondos.
- **Color al sol:** `#E2D5C4` / `#C5B7A3`; sombra `#887860`.

**6. `catedral_cupula_azulejos.jpg`** (1280×960)

- **Fuente:** [Detalle_cupula,_Catedral_Metropolitana_de_Morelia.jpg](https://commons.wikimedia.org/wiki/File:Detalle_cupula,_Catedral_Metropolitana_de_Morelia.jpg).
- **Autor y licencia:** Hugoacostac, CC BY-SA 3.0, 30 de noviembre de 2011.
- **Encuadre:** **cúpula principal** (izquierda) y **cúpula menor** (derecha, al frente) con cielo
  azul y sol cálido.
- **Qué se ve:**
  - Ambas están forradas de **azulejo en rombos azul cobalto** (`#191C41`) **y blanco** (`#E0E3DA`),
    con gajos separados por **nervios de cantera** y perillones en el arranque.
  - La principal tiene linternilla con ventanitas y una corona de pequeñas urnas con **cruz de hierro
    con volutas**.
  - La menor tiene tambor con ventanas de vidrio en arco y una **estatua de santo con cruz** encima.
  - A la derecha, el sillar de la base de una torre (`#DFBF9C` / `#F3DAB7` al sol).

**7. `catedral_costado_poniente_desde_atrio.jpg`** (1280×1004)

- **Fuente:** [Parte_posterior_de_Catedral_de_Morelia.jpg](https://commons.wikimedia.org/wiki/File:Parte_posterior_de_Catedral_de_Morelia.jpg).
- **Autor y licencia:** Antonio Carreón Guzmán, CC BY-SA 3.0, 2 de agosto de 2009.
- **Encuadre:** a pesar del nombre, es el **costado poniente** (el que da a la Plaza de Armas), visto
  desde el atrio poniente. Sol pleno.
- **Qué se ve:**
  - A la izquierda, la **torre poniente**: base lisa con ventanas y **relojes en dos caras**.
  - En medio, el **muro de nave** de sillar liso rosado (`#AE9591` / `#987F7B`) con 2 óculos ovales,
    2 ventanas enrejadas y 3 faroles de pared. Encima, un segundo plano con **balaustrada y
    perillones**.
  - Detrás asoma la torre oriente, **salmón** en los cuerpos altos.
  - A la derecha, la **portada lateral de San José**: más alta, de tono **salmón-rojizo**, con
    relieve de santo con ángeles, óculo oval, medallón, balaustrada con jarrones y **puerta en arco de
    madera con herrajes dorados**.
  - Detrás, la **cúpula de azulejo**.
  - Piso del atrio de **losas cuadradas claras** (`#F2EBE3`). La gente sirve de escala: la puerta
    mide ≈3.5–4 alturas humanas.

**8. `catedral_vista_trasera_sur_desde_azotea.jpg`** (1280×853)

- **Fuente:** [Vista_posterior_Catedral_de_Morelia.jpg](https://commons.wikimedia.org/wiki/File:Vista_posterior_Catedral_de_Morelia.jpg).
- **Autor y licencia:** Javier Alejandro Lara Bautista, CC BY-SA 4.0, 14 de mayo de 2017.
- **Encuadre:** **parte trasera (sur)** desde una azotea, con luz difusa de tarde. **Clave para la
  vista 3/4 con el norte arriba.**
- **Qué se ve:**
  - **Muros casi ciegos** de sillar (`#66544C` / `#746059`) con pilastras-contrafuerte y un
    **hastial con cruz de piedra**.
  - Balaustradas con perillones en varios niveles, **gárgolas**, una escalera marinera y los lomos de
    las bóvedas.
  - Al centro, la **cúpula de azulejo** con su tambor de ventanas y la linternilla.
  - A la derecha, la **torre oriente**: reloj y banderola roja-amarilla en el vano de la campana.
  - La **cupulita de azulejo** junto a su base, el anexo con **ventanas de marco rojo** y edificios
    vecinos con toldos rojos.

**9. `catedral_y_plaza_melchor_ocampo_estatua.jpg`** (1280×857)

- **Fuente:** [Morelia_Cathedral_DSC_0524_AD.JPG](https://commons.wikimedia.org/wiki/File:Morelia_Cathedral_DSC_0524_AD.JPG).
- **Autor y licencia:** Adavyd, CC BY-SA 3.0, 15 de enero de 2012.
- **Encuadre:** el **costado oriente completo** desde la Plaza Ocampo, con cielo azul limpio.
- **Qué se ve:**
  - En la catedral: portón sureste con copete, muro con balaustrada, portada oriente con
    **bugambilia magenta** delante, cúpula, torre poniente al fondo y torre oriente con la cupulita
    de azulejo al pie.
  - El **anexo blanco con ventanas rojas**, la reja y **macetones y bancas-cubo** en fila.
  - En primer plano, la **estatua de bronce de Ocampo sobre un dado de piedra oscura** en una
    **plataforma o pileta baja gris oscura** con chorro.
  - **Piso de losas grises con bandas oscuras en retícula**, postes negros y, al fondo derecho, el
    Palacio de Gobierno.

**10. `catedral_reja_puerta_atrio.jpg`** (1280×1912)

- **Fuente:** [BackGateMoreliaCathedral.JPG](https://commons.wikimedia.org/wiki/File:BackGateMoreliaCathedral.JPG).
- **Autor y licencia:** AlejandroLinaresGarcia, CC BY-SA 3.0, 29 de abril de 2012.
- **Encuadre:** **portón trasero del atrio**, de frente. La mejor referencia de un portón completo.
- **Qué se ve:**
  - **2 pilares de sillar rosado** (`#DCBAA5` al sol, juntas rojizas) con pilastra y cornisa volada,
    cada uno con **jarrón de piña** y una **voluta** en la base.
  - **Puerta de 2 hojas de barrotes negros** con banda de arquillos góticos abajo y arriba, una banda
    de anillos y una banda de celosía diagonal.
  - **Copete semicircular de rizos** con **óvalo y emblema de mitra o tiara**.
  - **4 escalones** de cantera.
  - A los lados, reja de barrotes con punta de lanza sobre zócalo de piedra.
  - Palomas en la cornisa, **calle de adoquín hexagonal gris oscuro** (`#444344`) y guarnición pintada
    de rojo.
  - Detrás se ven la cúpula de azulejo, una torre y una **puerta pintada de rojo**.

**11. `catedral_noche_iluminacion.jpg`** (1280×960)

- **Fuente:** [Frente_de_la_Catedral_Metropolitana_de_Morelia.jpg](https://commons.wikimedia.org/wiki/File:Frente_de_la_Catedral_Metropolitana_de_Morelia.jpg).
- **Autor y licencia:** HRJuarez, CC BY-SA 4.0, 24 de mayo de 2018.
- **Encuadre:** **frontal nocturna** desde Madero.
- **Qué se ve:**
  - Luz rasante **blanco-durazno cálida** en torres y fachada (`#F4D596` en las luces, sombras
    cafés).
  - La portada central en **azul frío**, acentos **lila y magenta** en los copetes y **amarillo,
    verde y rojo** en los vanos de la torre derecha.
  - Relojes como discos blancos, un haz de reflector diagonal y cielo negro-violeta.

**12. `catedral_noche_fuegos_artificiales.jpg`** (1280×960)

- **Fuente:** [Catedral_de_Morelia_festiva.jpg](https://commons.wikimedia.org/wiki/File:Catedral_de_Morelia_festiva.jpg).
- **Autor y licencia:** AAleMA ciencias, CC BY-SA 4.0, **sábado** 10 de agosto de 2019, 21:03 (el
  encendido).
- **Qué se ve:** torres en contrapicado, iluminadas **dorado-blanco**, con **humo blanco** entre
  ellas. Arriba a la derecha, un **estallido dorado-naranja** (crisantemo de rayos). Abajo, la silueta
  negra del copete central con su medallón. Reloj blanco en la torre derecha.

### Plaza de Armas

**13. `plaza_armas_kiosco.jpg`** (1280×960)

- **Fuente:** [KIOSKO_PLAZA_ARM_MORELIA.JPG](https://commons.wikimedia.org/wiki/File:KIOSKO_PLAZA_ARM_MORELIA.JPG).
- **Autor y licencia:** PFKASESOR, CC BY-SA 3.0, 21 de septiembre de 2009.
- **Qué se ve:**
  - Kiosco desde abajo: **base octagonal de cantera gris-café** (`#5B584A` / `#A3998C`) con tableros
    rehundidos y **puertita negra**.
  - **8 columnas negras de fuste torso**, friso y ménsulas de encaje de hierro y barandal negro.
  - **Plafón de duela barnizada naranja-miel** en triángulos radiales y alero con crestería.
  - Colgada al centro, una **campana gigante de oropel verde** (septiembre).
  - Anillo de jardín (césped y cubresuelo variegado) con **reja baja negra** y camino.
  - Detrás, fresnos o jacarandas de hoja fina, ficus podados y troncos blancos, y un edificio crema.

**14. `plaza_armas_kiosco_cupula_jacarandas.jpg`** (1280×857)

- **Fuente:** [PlazaArmasMorelia07.JPG](https://commons.wikimedia.org/wiki/File:PlazaArmasMorelia07.JPG).
- **Autor y licencia:** AlejandroLinaresGarcia, CC BY-SA 3.0, 29 de abril de 2012.
- **Encuadre:** kiosco completo con su **cupulín de lámina gris plata en forma de campana con
  costillas** y cruz. Proporción: base ≈20 %, columnas ≈45 %, techo y cupulín ≈35 %.
- **Qué se ve:**
  - Columnas negras, plafón de madera y farol colgante.
  - A la derecha, **banca curva de cantera con fila de óculos ovales**.
  - **Jacarandas en flor lila** (`#9B82CF`), ficus en bloque, cercas verdes y césped.
  - Al fondo, el portal con toldos verdes y rojos.

**15. `plaza_armas_fuente_cuadrante.jpg`** (1280×857)

- **Fuente:** [FountainPlazaArmasMorelia2.JPG](https://commons.wikimedia.org/wiki/File:FountainPlazaArmasMorelia2.JPG).
- **Autor y licencia:** AlejandroLinaresGarcia, CC BY-SA 3.0, 29 de abril de 2012.
- **Qué se ve:**
  - **Fuente tipo tazón:** pileta redonda con **borde de 3 hiladas redondeadas** de cantera gris
    porosa, plinto cuadrado, pedestal y **copa ancha** rebosando.
  - **Luminarias rectangulares** empotradas alrededor.
  - Detrás, cuadrante de césped con **reja verde de arquillos**, ficus en bloque con troncos
    encalados y el portal con arcos.

**16. `plaza_armas_fuente_columna_ficus_bancas_hierro.jpg`** (1280×857)

- **Fuente:** [FountainPlazaMorelia.JPG](https://commons.wikimedia.org/wiki/File:FountainPlazaMorelia.JPG).
- **Autor y licencia:** AlejandroLinaresGarcia, CC BY-SA 3.0, 29 de abril de 2012.
- **Ubicación:** muy probablemente en el **andador junto al atrio**. A la izquierda se ve la reja alta
  negra del atrio y al fondo la torre de cúpula rojiza de San Agustín.
- **Qué se ve:**
  - **Fuente de columna:** pileta de borde con tableros verticales y escalón, columna anillada, copa
    chica y **jarrón con piña**.
  - A ambos lados, **filas de ficus podados en tambores de tapa plana** (≈4–5 m de ancho) con
    **troncos encalados**.
  - **Bancas de hierro verde botella con respaldo** en fila, postes negros y botes verdes.

**17. `plaza_armas_pilastras_faroles_entrada.jpg`** (1280×857)

- **Fuente:** [PlazaArmasMorelia04.JPG](https://commons.wikimedia.org/wiki/File:PlazaArmasMorelia04.JPG).
- **Autor y licencia:** AlejandroLinaresGarcia, CC BY-SA 3.0, 29 de abril de 2012.
- **Encuadre:** **entrada de esquina**.
- **Qué se ve:**
  - **2 pilastras de cantera** (≈4.5 m; basa, tablero tallado, cornisa y **remate de piña**), cada
    una con **1 farol negro de brazo** y banderola roja-amarilla con escudo.
  - Camino de losas en diagonal hacia una **fuente tazón** y el **kiosco de cupulín plateado**.
  - Cercas verdes, césped, ficus en bloque, jacarandas moradas y troncos blancos.

**18. `plaza_armas_andador_ficus_bancas_cantera.jpg`** (1280×841)

- **Fuente:** [Morelia,_centro_09.jpg](https://commons.wikimedia.org/wiki/File:Morelia,_centro_09.jpg).
- **Autor y licencia:** LBM1948, CC BY-SA 4.0, 4 de noviembre de 2013.
- **Ubicación:** el autor la rotula como Plaza Melchor Ocampo, pero la vista corresponde al **andador
  oriente de la Plaza de Armas** mirando al sur, con la **torre de San Agustín** de cúpula rojiza al
  fondo.
- **Qué se ve:**
  - **Andador recto de losas rectangulares** gris-rosadas.
  - A la derecha, **8 o más ficus en bloque de tapa plana** (verde lima) con troncos encalados y
    **bancas de cantera con respaldo y brazos de voluta** entre ellos, con reja verde y césped detrás.
  - A la izquierda, **fila de pilastras de cantera con faroles negros**; la primera lleva 2 faroles.
  - Al fondo, un edificio con **3 arcos** (portal).

### Portales, Madero y Palacio

**19. `portal_hidalgo_hotel_casino_madero.jpg`** (1280×971)

- **Fuente:** [Morelia,_centro_22.jpg](https://commons.wikimedia.org/wiki/File:Morelia,_centro_22.jpg).
- **Autor y licencia:** LBM1948, CC BY-SA 4.0, 4 de noviembre de 2013.
- **Encuadre:** el **Portal Hidalgo** (lado norte de Madero) desde el otro lado de la avenida.
- **Qué se ve:**
  - Edificios de 2 niveles de **cantera beige clara** (`#DFCDB4`).
  - **Arcos con toldo verde festoneado** (`#1C503B`), ≈7 visibles en el tramo del Hotel Casino.
  - Ventanas altas con **frontones** y **balcones de herrería negra**.
  - **Pretil con balaustrada y pináculos**, letras doradas «Hotel Casino» y postes negros altos.
  - La avenida: **asfalto gris de 4 o 5 carriles**, doble línea amarilla con **boyas amarillas**,
    flechas y líneas blancas.
  - Al fondo, el Hotel Alameda (edificio alto) en Guillermo Prieto.

**20. `portal_cafe_mesas_bajo_arcos.jpg`** (1280×850)

- **Fuente:** [2013-11_Morelia_1.jpg](https://commons.wikimedia.org/wiki/File:2013-11_Morelia_1.jpg).
- **Autor y licencia:** LBM1948, CC BY-SA 4.0, 4 de noviembre de 2013.
- **Ubicación:** «Soportales de la Plaza de Armas»; el letrero «Café Catedral» corresponde al Portal
  Hidalgo 213.
- **Qué se ve:**
  - Interior del portal: **columnas toscanas** gris-café, arcos de medio punto hacia la calle y
    **arcos transversales rebajados** en la profundidad.
  - **Techo de vigas de madera oscura** y **6 o más faroles hexagonales negros colgantes**.
  - Muro del fondo **crema** (`#E8E0C8`) con puertas en marco de cantera y cerrajería.
  - **Filas de mesas de madera clara con sillas blancas y de madera** y piso de losas.

**21. `madero_poniente_virrey_de_mendoza.jpg`** (1280×857)

- **Fuente:** [WestfromCathedralMorelia.JPG](https://commons.wikimedia.org/wiki/File:WestfromCathedralMorelia.JPG).
- **Autor y licencia:** AlejandroLinaresGarcia, CC BY-SA 3.0, 29 de abril de 2012.
- **Encuadre:** Madero hacia el poniente.
- **Qué se ve:**
  - A la izquierda, la **esquina noroeste de la Plaza de Armas**: pilastras con banderolas, ficus en
    bloque, carpa blanca y **bicicletas blancas** en fila.
  - Al centro, el **Hotel Virrey de Mendoza** (inicio del Portal Matamoros): **3 niveles** de cantera
    clara (`#DEC2A4`), **arcada con toldos guinda** (`#A54E44`), balcones con toldos guinda,
    **mirador de 3 arcos** arriba y letras del nombre.
  - A la derecha, el Portal Hidalgo con toldos verdes y **postes negros altos de doble brazo con
    corona**.
  - **Cebra** de barras blancas, **línea de boyas amarillas** y flechas.

**22. `palacio_gobierno_fachada_madero.jpg`** (1280×1137)

- **Fuente:** [PalacioGobiernoMichoacan05.JPG](https://commons.wikimedia.org/wiki/File:PalacioGobiernoMichoacan05.JPG).
- **Autor y licencia:** AlejandroLinaresGarcia, CC BY-SA 3.0, 29 de abril de 2012.
- **Qué se ve:**
  - El Palacio en escorzo desde Madero: **2 niveles** de cantera **morado-grisácea**, pilastras
    tableradas y **ventanas-balcón con herrería negra individual**.
  - **Portón de madera** y **remate central mixtilíneo blanquecino**.
  - **Fila de pináculos** en la cornisa y **torrecilla-campanario con cupulín** en la esquina oriente.
  - Faroles de pared, banqueta de losas grises y **postes negros de doble brazo con globos blancos**.
  - Asfalto con líneas blancas y amarillas.

**23. `plaza_melchor_ocampo_explanada.jpg`** (1280×960)

- **Fuente:** [Plaza_Melchor_Ocampo_-_panoramio.jpg](https://commons.wikimedia.org/wiki/File:Plaza_Melchor_Ocampo_-_panoramio.jpg).
- **Autor y licencia:** ORamírezD, CC BY-SA 3.0, 16 de junio de 2011.
- **Qué se ve:**
  - Explanada de **losas grises con bandas oscuras en retícula** y **filas de bancas-cubo de cantera**.
  - Jardineras con **bugambilia morada**.
  - **Postes negros con 2 faroles de campana**, **asta bandera altísima**, un **globero** con racimo
    multicolor y la estatua al fondo.
  - En el lado oriente, edificios de 2 niveles **ocre o crema** y uno **blanco con balaustrada**
    («Modatelas»).

**24. `hotel_los_juaninos_fachada_2006.jpg`** (500×375; pequeña y antigua)

- **Fuente:** [Morelia_-_hotel_los_Juaninos).jpg](https://commons.wikimedia.org/wiki/File:Morelia_-_hotel_los_Juaninos%29.jpg).
- **Autor y licencia:** Gabriel Rodríguez López, dominio público, 12 de mayo de 2006.
- **Qué se ve:**
  - Hotel Los Juaninos (Morelos Sur 39): 2 niveles.
  - Planta alta **aplanada crema** (`#E8E0CF`) con **pilastras de cantera rosada labradas con
    figuras**, medallones y cuadros.
  - **2 balcones de herrería** y una **ventana central en arco**.
  - Letras oscuras **«HOTEL LOS JUANINOS»**.
  - Planta baja de cantera con locales y **puerta de madera entre 2 faroles negros**.

### Ambiente y vistas

**25. `vendedor_globos_catedral.jpg`** (960×1707)

- **Fuente:** [Catedral_Metropolitana_de_Morelia_con_globos.JPG](https://commons.wikimedia.org/wiki/File:Catedral_Metropolitana_de_Morelia_con_globos.JPG).
- **Autor y licencia:** Marioli925, CC BY-SA 3.0, 31 de enero de 2009.
- **Qué se ve:**
  - **Racimo de globero** de ≈40 o más piezas: estrella azul metálica, Bob Esponja amarillo, Elmo,
    corazones rojos, estrellas plateadas y verdes, y pelotas de playa a rayas amarillo, morado y
    blanco.
  - Detrás, un **portón de la reja** con copete, la **cúpula de azulejo**, una torre y la reja
    lateral.
  - Un puesto con sombrilla blanca.

**26. `vendedor_churros_catedral_costado_oriente.jpg`** (1280×960)

- **Fuente:** [Vendedor_de_churros_con_la_Catedral_de_Morelia_al_fondo.jpg](https://commons.wikimedia.org/wiki/File:Vendedor_de_churros_con_la_Catedral_de_Morelia_al_fondo.jpg).
- **Autor y licencia:** Luis Alvaz, CC BY-SA 4.0, 22 de septiembre de 2018.
- **Encuadre:** desde el alero de la esquina Morelos Sur y Allende, mirando al noroeste.
- **Qué se ve:**
  - **Churrero** con **charola de lámina sobre tijera** llena de churros en bolsas y una **canasta de
    chicharrones de harina** sobre una caja.
  - Guarnición **amarilla** y calle.
  - El **costado oriente** en luz cálida (cantera casi naranja-rosada), cúpula, torres con **banderas
    de México** en los vanos (septiembre), reja y portones.
  - La **estatua de Ocampo**, un **asta con bandera**, semáforos y la torrecilla del Palacio al fondo.

**27. `vista_alta_centro_desde_poniente.jpg`** (1280×960)

- **Fuente:** [Morelia_en_las_alturas.jpg](https://commons.wikimedia.org/wiki/File:Morelia_en_las_alturas.jpg).
- **Autor y licencia:** Israelfvg, CC BY-SA 4.0, 28 de julio de 2004.
- **Encuadre:** **vista alta con teleobjetivo desde el poniente**.
- **Qué se ve:**
  - Las **dos torres superpuestas** dominan el caserío; la **cúpula de azulejo** de la catedral queda
    a la derecha.
  - En primer plano, las **cúpulas rojo y rosa** de la antigua Compañía (Biblioteca Pública) y el
    Palacio Clavijero.
  - **Azoteas planas** con pretiles blancos, tinacos y domos, y cerros verdes al fondo.
- **Sirve para** el skyline y para ver qué tan pálidas y planas son las azoteas comunes frente a los
  techos rojos de los templos.

---

## 8. Fuentes consultadas

- **Catedral:**
  - [Wikipedia, Catedral metropolitana de Morelia][eswiki]
  - [SIC, Secretaría de Cultura][sic]
  - [Michoacán Histórico, Catedral][mhcat]
  - [Blog Historia mi Morelia](http://historiamimorelia-030393.blogspot.com/2011/06/catedral-de-morelia.html)
  - [DHIAL, Morelia arte virreinal](https://www.dhial.org/diccionario/index.php?title=MORELIA%3B_Arte_Virreinal)
  - [Contramuro, campanas][campanas]
  - [MiMorelia, reloj][reloj]
  - Sitio de la Catedral, «La reja atrial» (citado vía buscador; el dominio no respondió):
    http://www.catedraldemorelia.mx/blog/la-reja-atrial/
  - [Wikipedia, Órgano monumental][organo]
- **Luces de Catedral:**
  - [MiMorelia, sept. 2025][luces]
  - [Quadratín, mayo 2026][ritmos]
  - [Ayuntamiento de Morelia][ayto]
- **Plaza de Armas:**
  - [Cultura.gob.mx][cultpda]
  - [Michoacán Histórico, Plazas y jardines I][mhplazas]
  - [Flickr quokant, historia de la plaza][qk1]
  - [Flickr quokant, kiosco de 1887](https://www.flickr.com/photos/quokant/4383779824)
  - [VisitPátzcuaro][vp]
  - [MiMorelia, bancas 2026][bancas]
  - [El Clima, plazas y portales](https://www.elclima.com.mx/plazas_y_portales_en_morelia.htm)
  - [Descubre Michoacán][dm]
- **Portales:**
  - [IMPLAN Morelia, fichas técnicas][implan] (FI_1–4 Matamoros, FI_772–774 Aldama, FI_775–776
    Allende, FI_778–781 Hidalgo, FI_782–785 Galeana, FI_439)
  - [La Voz de Michoacán, portales](https://www.lavozdemichoacan.com.mx/michoacan/morelia-appmobil/imagenes-nuestras-portales-del-centro-testigos-de-la-historia-de-morelia-2/)
  - [Este es Michoacán](https://esteesmichoacan.com/noticias/10022/plaza-de-armas-y-sus-varios-portales-de-morelia--Michoacan/)
  - [Cambio de Michoacán, jul. 2026][cambio] (solo el extracto del buscador; la página dio 403)
  - [HMDB, marcador «Galeana»][hmdb] (extracto)
  - Direcciones: [Hotel Casino](https://www.hotelcasino.com.mx/en/location.html),
    [Café Catedral en Yelp](https://www.yelp.com/biz/cafe-catedral-morelia),
    [Café Michelena en TripTap](https://triptap.com/places/mx/michoacn/morelia/cafe-michelena-t001d4dd)
- **Plaza Ocampo:**
  - [Michoacán Histórico][mhplazas]
  - [Revista Morelia](https://revistamorelia.com/plaza-melchor-ocampo/)
  - [MiMorelia, fuentes danzantes 2026][danz]
  - [Quadratín, la acacia olvidada (2022)][acacia]
  - [Flickr quokant, álbum Plaza Ocampo][qkoc]
  - [Quadratín, izamiento de bandera](https://www.quadratin.com.mx/morelia/izan-bandera-de-mexico-en-la-melchor-ocampo-por-inicio-de-septiembre/)
  - [Hotel Los Juaninos][juan]
- **Palacio y Madero:**
  - [Wikipedia, Palacio de Gobierno de Michoacán][pal]
  - [La Voz, balizamiento 2026][lavoz]
  - [PCM Noticias](https://pcmnoticias.mx/gobierno-de-morelia-baliza-avenida-madero-previo-a-485-aniversario-de-la-ciudad/)
  - [MiMorelia, ciclovía][ciclo]
  - [MoreliActiva, centro peatonal][peat]
- **Otros:**
  - [Gazpacho moreliano][gazp]
  - OSM (`docs/plaza/osm/centro.osm`, lo baja `scripts/plaza/referencias.mts`): posiciones de fuentes, estatuas, placa UNESCO, arcadas y
    `alt_name`
  - Recorte satelital de Esri World Imagery (consultado, no guardado): color de los techos

---

## 9. Dudas abiertas: qué verificar en Street View o en una visita

1. **Escalera del kiosco:** en qué cara está y cuántos peldaños tiene. No aparece en las fotos.
2. **Separador central de Madero en 2026:** si sigue siendo solo línea con boyas o si ya hay camellón
   físico frente a la catedral.
3. **Toldos:** si los verdes de Hidalgo y Galeana y los guinda del Virrey de Mendoza siguen iguales en
   2026. En la ficha del IMPLAN de 2022 seguían verdes.
4. **Color actual del Portal Allende:** blanco o crema según la foto de 2022 del IMPLAN; confirmar.
5. **Letras «MORELIA»** junto a la catedral: si son permanentes o de temporada.
6. **Posición exacta de la estatua de Juárez** en el andador y **forma actual de la fuente de
   Ocampo**. Son estimaciones a partir de OSM y de fotos de 2012–2018.
7. **Relieves de la portada:** la lectura central (Transfiguración frente a Resurrección) varía según la
   fuente. Para 16 px no importa: basta un tablero claro con figuras.

[eswiki]: https://es.wikipedia.org/wiki/Catedral_metropolitana_de_Morelia
[sic]: https://sic.cultura.gob.mx/ficha.php?table=catedral&table_id=46
[mhcat]: https://www.michoacanhistorico.com/catedral-metropolitana-de-morelia/
[campanas]: https://www.contramuro.com/sabes-cuantas-campanas-tienen-las-torres-de-catedral-de-morelia/
[reloj]: https://mimorelia.com/noticias/reloj-de-la-catedral-moreliana-un-tesoro-conservado-por-mas-de-dos-siglos
[organo]: https://es.wikipedia.org/wiki/%C3%93rgano_monumental_de_la_Catedral_de_Morelia
[luces]: https://mimorelia.com/noticias/morelia/el-detr%C3%A1s-de-luces-de-catedral-el-montaje-que-da-vida-al-espect%C3%A1culo-imperdible-de-morelia
[ritmos]: https://www.quadratin.com.mx/municipios/vibrara-morelia-con-ritmos-de-catedral-experiencia-previa-al-encendido/
[ayto]: https://morelia.gob.mx/blogs/6a15ece513e2a9d73b2d844c
[cultpda]: https://www.cultura.gob.mx/regiones_de_mexico/centro_occidente/detalle_lugar.php?espacio=66662
[mhplazas]: https://www.michoacanhistorico.com/plazas-y-jardines-del-centro-historico-de-morelia-parte-i/
[qk1]: https://www.flickr.com/photos/quokant/4383780280
[vp]: https://villapatzcuaro.com/visitpatzcuaro/en/item/plaza-de-armas-de-morelia/
[bancas]: https://mimorelia.com/noticias/morelia/avanza-de-manera-gradual-la-restauraci%C3%B3n-de-bancas-en-plaza-de-armas
[dm]: https://descubremichoacan.com/actividades-en-morelia/que-hacer-morelia-fin-de-semana/
[implan]: https://implanmorelia.org/site/wp-content/uploads/2023/01/FI_775.pdf
[cambio]: https://cambiodemichoacan.com.mx/2026/07/02/rincones-de-morelia-los-desapercibidos-nombres-de-los-portales-del-centro-historico/
[hmdb]: https://www.hmdb.org/m.asp?m=218251
[danz]: https://mimorelia.com/noticias/morelia/rehabilitan-fuentes-danzantes-de-la-plaza-melchor-ocampo
[acacia]: https://www.quadratin.com.mx/cultura/la-acacia-olvidada-de-los-masones-en-pleno-centro-de-morelia/
[qkoc]: https://www.flickr.com/photos/quokant/albums/72157623918604187/
[juan]: https://hoteljuaninos.com/en/from-juaninos-to-morelia/
[pal]: https://es.wikipedia.org/wiki/Palacio_de_Gobierno_de_Michoac%C3%A1n
[lavoz]: https://www.lavozdemichoacan.com.mx/michoacan/morelia-appmobil/balizamiento-avenida-madero-485-aniversario-morelia-seguridad-vial/
[ciclo]: https://mimorelia.com/noticias/morelia/date-una-vuelta-disfruta-la-ciclov%C3%ADa-recreativa-dominical-en-morelia
[peat]: https://moreliactiva.com/este-fin-de-semana-el-centro-historico-de-morelia-es-peatonal/
[gazp]: https://tragonesperofinos.mx/2023/05/13/te-imaginas-fruta-con-queso-conoce-el-gazpacho-moreliano/
