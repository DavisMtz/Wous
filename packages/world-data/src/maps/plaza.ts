import type { Facing } from '@wous/game-core';
import { insideShape } from '../shapes.ts';
import type {
  CameraZone,
  GroundShape,
  MapDef,
  MapObject,
  Seat,
  Sign,
  SolidPart,
} from '../types.ts';
import { groundBuilder } from './builder.ts';

/**
 * La Plaza: el centro histórico de Morelia (ADR-0013) a 1.4 m por tile
 * (ADR-0014), trazada sobre OpenStreetMap (`node scripts/plaza/osm.mts
 * --escala 1.4`) y la investigación de `docs/plaza/investigacion.md`. La vista
 * mira al sur desde Avenida Madero: la fachada de la Catedral da de frente, la
 * Plaza de Armas queda a la derecha (poniente) y la Melchor Ocampo a la
 * izquierda (oriente).
 *
 * De izquierda a derecha: Av. Morelos · Plaza Melchor Ocampo (la estatua en su
 * pileta, las fuentes danzantes, la losa de los Liberales) · el atrio enrejado
 * con la Catedral · el atrio poniente · la Plaza Juárez con su andador · la
 * Plaza de Armas (el kiosko, ocho andadores en estrella, cuatro fuentes, los
 * jardines cercados) · Abasolo. Arriba, la calle Allende: casas de dos pisos
 * hasta García Obeso, el Portal Aldama, la Cerrada de San Agustín y el Portal
 * Allende con el Café y sus mesas bajo los arcos. Abajo, Madero.
 *
 * Versión 3: el doble de grande que la v2 (ADR-0014). Versión 4: se sienta uno
 * también en el bordillo de las jardineras de la Melchor Ocampo.
 */

const W = 208;
const H = 98;

// ─── Trazo (tiles; del OSM a 1.4 m por tile) ──────────────────────────────

/** Pie de las casas de Allende sin portal (de Morelos a García Obeso). */
const CASAS_Y = 15;
/** Alto del frente de una casa de dos pisos (tiles de arte). */
const CASA_ALTO = 8;
/** Línea de los pilares de los portales Aldama y Allende. */
const PILARES_Y = 18;
/** Fondo del portal: de los pilares al muro de los comercios (≈4.2 m). */
const PORTAL_FONDO = 3;
/** Alto del frente de los portales, del pie de los pilares al pretil. */
const PORTAL_ALTO = 9;
/** Separación entre pilares (un arco cada 4.2 m). */
const ARCO = 3;
/** La banqueta norte de Allende va de 20 a 21; de ahí para abajo, las plazas. */
const ALLENDE_NORTE = 20;
const PLAZAS_Y = 21;
/** Banqueta de Madero (88–91) y la avenida (91–98). */
const MADERO_BANQUETA = 88;
const MADERO_Y = 91;

/** De izquierda (oriente) a derecha (poniente). */
const MORELOS = { x: 2, w: 5 };
const OCAMPO_X = 9;
const GARCIA_OBESO = { x: 67, w: 6 };
/** Los portales terminan en un pilar: 19 arcos el Aldama y 21 el Allende. */
const ALDAMA = { x: 73, w: 19 * 3 + 0.75 };
const CERRADA = { x: 131, w: 10 };
const PORTAL_ALLENDE = { x: 141, w: 21 * 3 + 0.75 };
const ABASOLO = { x: 199, w: 6 };

/** El atrio: la reja oriente en x 41, la poniente en 115.5 (desde y 42.5), la norte sobre Madero. */
const REJA_ORIENTE_X = 41;
const REJA_PONIENTE_X = 115.5;
const REJA_PONIENTE_DESDE = 42.5;
/** Donde se para la reja de Madero (su pie en 87.5). */
const REJA_NORTE_Y = 86.5;

/** La Catedral: fachada en y 77, torres de 10 tiles (oriente 50–60, poniente 73–83). */
const CATEDRAL_HUELLA = { x: 46, y: 21, w: 40, h: 56 };
const FACHADA_Y = CATEDRAL_HUELLA.y + CATEDRAL_HUELLA.h;
const PUERTA_MAYOR_X = 66.5;

const ground = groundBuilder(W, H, 'enlosado')
  // Orillas: azoteas de detrás de Morelos y de Abasolo, y las dos calles.
  .fill(0, 0, MORELOS.x, H, 'azotea')
  .fill(MORELOS.x, 0, MORELOS.w, H, 'calle')
  .fill(ABASOLO.x + ABASOLO.w, 0, W - ABASOLO.x - ABASOLO.w, H, 'azotea')
  .fill(ABASOLO.x, PLAZAS_Y, ABASOLO.w, H - PLAZAS_Y, 'calle')
  // Allende, de Morelos a García Obeso: casas, su banqueta, el empedrado y la banqueta norte.
  .fill(7, 0, GARCIA_OBESO.x - 7, CASAS_Y - CASA_ALTO, 'azotea')
  .fill(7, CASAS_Y - CASA_ALTO, GARCIA_OBESO.x - 7, CASA_ALTO, 'fachada')
  .fill(7, CASAS_Y, GARCIA_OBESO.x - 7, 1, 'banqueta')
  .fill(7, CASAS_Y + 1, ABASOLO.x + ABASOLO.w - 7, ALLENDE_NORTE - CASAS_Y - 1, 'empedrado')
  // García Obeso sube hacia el sur entre las casas.
  .fill(GARCIA_OBESO.x, 0, GARCIA_OBESO.w, CASAS_Y + 1, 'calle')
  // Los portales: azoteas, el frente (detrás del arte) y el andador cubierto.
  .fill(ALDAMA.x, 0, ABASOLO.x + ABASOLO.w - ALDAMA.x, PILARES_Y - PORTAL_ALTO, 'azotea')
  .fill(
    ALDAMA.x,
    PILARES_Y - PORTAL_ALTO,
    ABASOLO.x + ABASOLO.w - ALDAMA.x,
    PORTAL_ALTO - PORTAL_FONDO,
    'fachada',
  )
  .fill(ALDAMA.x, PILARES_Y - PORTAL_FONDO, CERRADA.x - ALDAMA.x, PORTAL_FONDO, 'portal')
  .fill(
    PORTAL_ALLENDE.x,
    PILARES_Y - PORTAL_FONDO,
    ABASOLO.x + ABASOLO.w - PORTAL_ALLENDE.x,
    PORTAL_FONDO,
    'portal',
  )
  // La Cerrada de San Agustín: callejón peatonal hacia el sur, entre los dos portales.
  .fill(CERRADA.x, 0, CERRADA.w, 10, 'fachada')
  .fill(CERRADA.x, 10, CERRADA.w, PILARES_Y - 10, 'losa')
  // Entre los portales y la esquina de Abasolo el empedrado sigue hasta la calle.
  .fill(
    ALDAMA.x,
    PILARES_Y,
    ABASOLO.x + ABASOLO.w - ALDAMA.x,
    ALLENDE_NORTE - PILARES_Y,
    'empedrado',
  )
  .fill(7, ALLENDE_NORTE, ABASOLO.x + ABASOLO.w - 7, 1, 'banqueta')
  // Banquetas de Morelos y de Abasolo frente a las plazas.
  .fill(MORELOS.x + MORELOS.w, CASAS_Y, 2, MADERO_Y - CASAS_Y, 'banqueta')
  .fill(ABASOLO.x - 2, PLAZAS_Y, 2, MADERO_Y - PLAZAS_Y, 'banqueta')
  // Plaza Melchor Ocampo: explanada de losas grises con su retícula oscura.
  .fill(OCAMPO_X, PLAZAS_Y, REJA_ORIENTE_X - OCAMPO_X, MADERO_BANQUETA - PLAZAS_Y, 'explanada')
  // El atrio: losas de cantera clara, de Allende a la reja de Madero.
  .fill(
    REJA_ORIENTE_X,
    PLAZAS_Y,
    REJA_PONIENTE_X - REJA_ORIENTE_X + 1,
    REJA_NORTE_Y + 1 - PLAZAS_Y,
    'losa',
  )
  // Madero: banqueta ancha y la avenida.
  .fill(
    MORELOS.x + MORELOS.w,
    MADERO_BANQUETA,
    ABASOLO.x - MORELOS.x - MORELOS.w,
    MADERO_Y - MADERO_BANQUETA,
    'banqueta',
  )
  .fill(0, MADERO_Y, W, H - MADERO_Y, 'calle')
  .build();

// ─── Asientos ─────────────────────────────────────────────────────────────

/** Hacia dónde mira quien se sienta en cada banca (el respaldo queda del otro lado). */
type Orientacion = 'abajo' | 'arriba' | 'izquierda' | 'derecha';
const MIRA: Record<Orientacion, Facing> = {
  abajo: 'down',
  arriba: 'up',
  izquierda: 'left',
  derecha: 'right',
};

/**
 * Banca de cantera con respaldo y brazos de voluta, como las de la Plaza de
 * Armas: dos lugares. Acostada (mira arriba o abajo) mide 2×1; parada (mira a
 * un lado), 1×2. Lo sólido es el asiento, sin la orilla de enfrente. La de
 * hierro (`hierro`) es la verde botella del andador: misma huella.
 */
function banca(
  id: string,
  x: number,
  y: number,
  mira: Orientacion,
  material: 'cantera' | 'hierro' = 'cantera',
): MapObject {
  const acostada = mira === 'abajo' || mira === 'arriba';
  const solid: SolidPart[] = acostada
    ? [{ x: 0, y: mira === 'abajo' ? 0.25 : 0, w: 2, h: 0.75 }]
    : [{ x: mira === 'derecha' ? 0 : 0.25, y: 0, w: 0.75, h: 2 }];
  return {
    id,
    kind: 'banca',
    x,
    y,
    w: acostada ? 2 : 1,
    h: acostada ? 1 : 2,
    variant: material === 'hierro' ? `hierro-${mira}` : mira,
    solid,
  };
}

/** Cubo de cantera clara (bancas-cubo de la Melchor Ocampo y del atrio): un lugar. */
function cubo(id: string, x: number, y: number): MapObject {
  return {
    id,
    kind: 'banca',
    x,
    y,
    w: 1,
    h: 1,
    variant: 'cubo',
    solid: [{ x: 0.1, y: 0.3, w: 0.8, h: 0.7 }],
  };
}

/**
 * Los lugares de una banca: los pies, hacia dónde mira y por dónde se
 * levanta. De frente (abajo), la persona queda delante de la banca; de
 * espaldas (arriba), la tapa el respaldo; de lado, sobre el asiento.
 */
function lugaresDe(o: MapObject): Seat[] {
  if (o.variant?.startsWith('curva:')) return lugaresDeCurva(o);
  if (o.variant === 'cubo') {
    return [
      {
        id: `${o.id}`,
        x: o.x + 0.5,
        y: o.y + 1.05,
        facing: 'down',
        exit: { x: o.x + 0.5, y: o.y + 1.55 },
        object: o.id,
        lift: 3,
      },
    ];
  }
  const mira = (o.variant ?? 'abajo').replace('hierro-', '') as Orientacion;
  const facing = MIRA[mira];
  const lugares = [0, 1];
  switch (mira) {
    case 'abajo':
      return lugares.map((i) => ({
        id: `${o.id}-${i + 1}`,
        x: o.x + 0.5 + i,
        y: o.y + 1.05,
        facing,
        exit: { x: o.x + 0.5 + i, y: o.y + 1.55 },
        object: o.id,
      }));
    case 'arriba':
      return lugares.map((i) => ({
        id: `${o.id}-${i + 1}`,
        x: o.x + 0.5 + i,
        y: o.y + 0.45,
        facing,
        exit: { x: o.x + 0.5 + i, y: o.y - 0.5 },
        object: o.id,
        lift: 2,
      }));
    case 'izquierda':
      return lugares.map((i) => ({
        id: `${o.id}-${i + 1}`,
        x: o.x + 0.55,
        y: o.y + 0.8 + i,
        facing,
        exit: { x: o.x - 0.55, y: o.y + 0.8 + i },
        object: o.id,
        lift: 2,
      }));
    case 'derecha':
      return lugares.map((i) => ({
        id: `${o.id}-${i + 1}`,
        x: o.x + 0.45,
        y: o.y + 0.8 + i,
        facing,
        exit: { x: o.x + 1.55, y: o.y + 0.8 + i },
        object: o.id,
        lift: 2,
      }));
  }
}

/**
 * Fuente de pileta redonda (las de taza de la Plaza de Armas, la de columna
 * del andador). Lo sólido es la pileta; en su borde se sienta la gente.
 */
function fuente(id: string, cx: number, cy: number, variant: string, r: number): MapObject {
  return {
    id,
    kind: 'fuente',
    x: cx - r,
    y: cy - r,
    w: r * 2,
    h: r * 2,
    variant,
    solid: [{ circle: { x: r, y: r, r: r - 0.05 } }],
  };
}

/**
 * Los lugares en el borde de una fuente redonda: tres al frente (mirando
 * hacia abajo) y uno en cada costado (mirando hacia afuera).
 */
function bordeDeFuente(f: MapObject, lift = 3): Seat[] {
  const r = f.w / 2;
  const cx = f.x + r;
  const cy = f.y + r;
  const frente = f.y + f.h + 0.08;
  const lugares: Seat[] = [-0.9, 0, 0.9].map((dx, i) => ({
    id: `${f.id}-borde-${i + 1}`,
    x: cx + dx,
    y: frente - (Math.abs(dx) > 0 ? 0.1 : 0),
    facing: 'down' as const,
    exit: { x: cx + dx, y: frente + 0.55 },
    object: f.id,
    lift,
  }));
  lugares.push(
    {
      id: `${f.id}-borde-izquierda`,
      x: f.x + 0.15,
      y: cy + 0.35,
      facing: 'left',
      exit: { x: f.x - 0.55, y: cy + 0.35 },
      object: f.id,
      lift,
    },
    {
      id: `${f.id}-borde-derecha`,
      x: f.x + f.w - 0.15,
      y: cy + 0.35,
      facing: 'right',
      exit: { x: f.x + f.w + 0.55, y: cy + 0.35 },
      object: f.id,
      lift,
    },
  );
  return lugares;
}

type Especie = 'laurel' | 'fresno' | 'liquidambar' | 'jacaranda' | 'naranjo';

/**
 * Un árbol con los pies en `x`, `y` (el centro de su tronco). Solo estorba el
 * tronco: la copa se cruza por debajo y se transparenta.
 */
function arbol(id: string, x: number, y: number, especie: Especie = 'laurel'): MapObject {
  if (especie === 'jacaranda') {
    return {
      id,
      kind: 'jacaranda',
      x: x - 0.5,
      y: y - 0.75,
      w: 1,
      h: 1,
      solid: [{ x: 0.3, y: 0.55, w: 0.4, h: 0.4 }],
    };
  }
  return {
    id,
    kind: 'arbol',
    x: x - 0.5,
    y: y - 0.75,
    w: 1,
    h: 1,
    variant: especie,
    solid: [{ x: 0.3, y: 0.55, w: 0.4, h: 0.4 }],
  };
}

/**
 * Poste de hierro con sus faroles: de tres brazos (`linternas`), de dos
 * campanas (Melchor Ocampo) o el alto de doble brazo con globos blancos (Madero).
 */
function farol(
  id: string,
  x: number,
  y: number,
  variant: 'linternas' | 'campanas' | 'globos' = 'linternas',
): MapObject {
  return {
    id,
    kind: 'farol',
    x: x - 0.5,
    y: y - 0.75,
    w: 1,
    h: 1,
    ...(variant === 'linternas' ? {} : { variant }),
    solid: [{ x: 0.3, y: 0.6, w: 0.4, h: 0.35 }],
  };
}

/**
 * Pilastra de cantera (≈4.5 m) con su farol negro de brazo: van en pares en
 * las entradas de las esquinas de la Plaza de Armas y en fila por el andador.
 * `x`, `y` es el centro de su base; `brazo` dice hacia dónde sale el farol.
 */
function pilastra(id: string, x: number, y: number, brazo: 'izquierda' | 'derecha'): MapObject {
  return {
    id,
    kind: 'pilastra',
    x: x - 0.5,
    y: y - 0.5,
    w: 1,
    h: 1,
    variant: brazo,
    solid: [{ x: 0.2, y: 0.2, w: 0.6, h: 0.6 }],
  };
}

/** El nicho de una banca: losa un poco más grande que ella, abierta en el jardín. */
function nicho(o: MapObject): GroundShape {
  return { kind: 'losa', rect: { x: o.x - 0.3, y: o.y - 0.3, w: o.w + 0.6, h: o.h + 0.6 } };
}

/** Una hilera: `n` puntos repartidos de `a` a `b` (incluidos). */
function hilera(a: number, b: number, n: number): number[] {
  if (n <= 1) return [a];
  return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
}

// ─── Plaza de Armas ───────────────────────────────────────────────────────

/** El kiosko: centro de la estrella de andadores (un poco al norte del centro, como el real). */
const KIOSKO = { x: 168, y: 61 };
/** Radio de la base octagonal de cantera (≈10 m de ancho). */
const KIOSKO_R = 3.5;
/** La jardinera cercada alrededor del kiosko y el andador circular. */
const JARDINERA_KIOSKO_R = 5;
const ANILLO_R = 8.2;
/** Medio ancho de los ejes y ancho de las diagonales. */
const EJE = 1.25;
const DIAGONAL = 2.2;
/** El cuadro de los jardines cercados, dentro del andador de alrededor. */
const JARDIN = { x: 145.5, y: 29, w: 45, h: 57.5 };
const ESQUINAS = [
  [JARDIN.x, JARDIN.y],
  [JARDIN.x + JARDIN.w, JARDIN.y],
  [JARDIN.x, JARDIN.y + JARDIN.h],
  [JARDIN.x + JARDIN.w, JARDIN.y + JARDIN.h],
] as const;
/** Radio de las fuentes de taza (Ø≈5 m) y de su glorieta de losa. */
const FUENTE_R = 1.8;
const GLORIETA_R = 3.9;
/** Las cuatro fuentes, sobre las diagonales: un poco más allá de la mitad del camino. */
const FUENTES = ESQUINAS.map(([x, y]) => {
  const t = y < KIOSKO.y ? 0.6 : 0.66;
  return { x: KIOSKO.x + (x - KIOSKO.x) * t, y: KIOSKO.y + (y - KIOSKO.y) * t };
});

const armasSuelo: GroundShape[] = [
  { kind: 'jardin', rect: JARDIN },
  // Los ejes: norte–sur y oriente–poniente, de orilla a orilla.
  {
    kind: 'enlosado',
    path: {
      points: [
        [KIOSKO.x, JARDIN.y - 0.5],
        [KIOSKO.x, JARDIN.y + JARDIN.h + 0.5],
      ],
      width: EJE * 2,
    },
  },
  {
    kind: 'enlosado',
    path: {
      points: [
        [JARDIN.x - 0.5, KIOSKO.y],
        [JARDIN.x + JARDIN.w + 0.5, KIOSKO.y],
      ],
      width: EJE * 2,
    },
  },
  // Las diagonales, del kiosko a las esquinas.
  ...ESQUINAS.map(
    ([x, y]): GroundShape => ({
      kind: 'enlosado',
      path: {
        points: [
          [KIOSKO.x, KIOSKO.y],
          [x, y],
        ],
        width: DIAGONAL,
      },
    }),
  ),
  // Glorietas de las fuentes y el andador circular del kiosko, en losa.
  ...FUENTES.map((f): GroundShape => ({ kind: 'losa', circle: { x: f.x, y: f.y, r: GLORIETA_R } })),
  { kind: 'losa', circle: { x: KIOSKO.x, y: KIOSKO.y, r: ANILLO_R } },
  // El kiosko se levanta en medio de una jardinera redonda con su reja baja negra;
  // un andadorcito cruza el pasto hasta la puertita de su base.
  { kind: 'jardinera', circle: { x: KIOSKO.x, y: KIOSKO.y, r: JARDINERA_KIOSKO_R } },
  {
    kind: 'enlosado',
    rect: {
      x: KIOSKO.x - 0.6,
      y: KIOSKO.y + KIOSKO_R - 0.3,
      w: 1.2,
      h: JARDINERA_KIOSKO_R - KIOSKO_R + 0.6,
    },
  },
  // Arriates de los laureles del andador de alrededor: junto a Allende y junto a Abasolo.
  { kind: 'jardin', rect: { x: 147, y: 23.4, w: 42, h: 1.8 } },
  { kind: 'jardin', rect: { x: 193.4, y: 30, w: 1.8, h: 53 } },
];

/**
 * Bancas en los ejes, cada una en su nicho de losa abierto en el jardín: de
 * espaldas a la reja, mirando al andador.
 */
const bancasDeEje: MapObject[] = [
  // Eje norte–sur, arriba del kiosko y abajo.
  ...[33.5, 39.5, 45.5].flatMap((y, i) => [
    banca(`banca-armas-sur-${i * 2 + 1}`, KIOSKO.x - EJE - 1.05, y, 'derecha'),
    banca(`banca-armas-sur-${i * 2 + 2}`, KIOSKO.x + EJE + 0.05, y, 'izquierda'),
  ]),
  ...[72.5, 78.5].flatMap((y, i) => [
    banca(`banca-armas-norte-${i * 2 + 1}`, KIOSKO.x - EJE - 1.05, y, 'derecha'),
    banca(`banca-armas-norte-${i * 2 + 2}`, KIOSKO.x + EJE + 0.05, y, 'izquierda'),
  ]),
  // Eje oriente–poniente, a la izquierda del kiosko y a la derecha.
  ...[149.5, 155.5].flatMap((x, i) => [
    banca(`banca-armas-oriente-${i * 2 + 1}`, x, KIOSKO.y - EJE - 1.05, 'abajo'),
    banca(`banca-armas-oriente-${i * 2 + 2}`, x, KIOSKO.y + EJE + 0.05, 'arriba'),
  ]),
  ...[180.5, 186.5].flatMap((x, i) => [
    banca(`banca-armas-poniente-${i * 2 + 1}`, x, KIOSKO.y - EJE - 1.05, 'abajo'),
    banca(`banca-armas-poniente-${i * 2 + 2}`, x, KIOSKO.y + EJE + 0.05, 'arriba'),
  ]),
];

/** En el andador de alrededor, de espaldas a la reja del jardín. */
const bancasDeOrilla: MapObject[] = [
  ...[151, 158, 176, 183].map((x, i) =>
    banca(`banca-armas-allende-${i + 1}`, x, JARDIN.y - 1.15, 'arriba'),
  ),
  ...[151, 158, 176, 183].map((x, i) =>
    banca(`banca-armas-madero-${i + 1}`, x, JARDIN.y + JARDIN.h + 0.15, 'abajo'),
  ),
  ...[36, 44, 52, 70, 78].map((y, i) =>
    banca(`banca-armas-abasolo-${i + 1}`, JARDIN.x + JARDIN.w + 0.15, y, 'derecha'),
  ),
];

const armasFuentes = FUENTES.map((f, i) =>
  fuente(`fuente-armas-${i + 1}`, f.x, f.y, 'taza', FUENTE_R),
);

/**
 * Las luminarias empotradas alrededor de cada fuente de taza (foto
 * `plaza_armas_fuente_cuadrante.jpg`): diez tiras de vidrio en el piso de la
 * glorieta, puestas como rayos a medio metro del borde.
 */
const LUMINARIAS_POR_FUENTE = 10;
const luminarias: GroundShape[] = FUENTES.flatMap((f) =>
  Array.from({ length: LUMINARIAS_POR_FUENTE }, (_, k): GroundShape => {
    const a = ((k + 0.5) / LUMINARIAS_POR_FUENTE) * Math.PI * 2;
    const [ux, uy] = [Math.cos(a), Math.sin(a)];
    const [desde, hasta, medio] = [FUENTE_R + 0.4, FUENTE_R + 1.1, 0.1];
    return {
      kind: 'luminaria',
      polygon: [
        [f.x + ux * desde - uy * medio, f.y + uy * desde + ux * medio],
        [f.x + ux * hasta - uy * medio, f.y + uy * hasta + ux * medio],
        [f.x + ux * hasta + uy * medio, f.y + uy * hasta - ux * medio],
        [f.x + ux * desde + uy * medio, f.y + uy * desde - ux * medio],
      ],
    };
  }),
);

/**
 * Los árboles de la Plaza de Armas, del OSM: laureles de la India podados en
 * bloque por las orillas (dentro de la reja y en los arriates de afuera) y,
 * dentro de los cuadrantes, árboles altos de copa suelta.
 */
const ARMAS_LAURELES: readonly (readonly [number, number])[] = [
  // Dentro de la reja, junto a cada orilla.
  ...hilera(151, 185, 7).map((x) => [x, 32.8] as const),
  ...hilera(151, 185, 8).map((x) => [x, 83.6] as const),
  ...hilera(34, 80, 8).map((y) => [148.6, y] as const),
  ...hilera(34, 80, 8).map((y) => [187.2, y] as const),
  // En los arriates de afuera: junto a Allende y junto a Abasolo.
  ...hilera(150, 186, 8).map((x) => [x, 24.8] as const),
  ...hilera(32, 81, 11).map((y) => [194.3, y] as const),
];
const ARMAS_ALTOS: readonly (readonly [number, number, Especie])[] = [
  // Los dos fresnos de junto a las fuentes de arriba van ≈5 tiles más abajo que en el OSM: con su
  // copa de 7 tiles de alto tapaban la fuente entera.
  [152.8, 51.2, 'fresno'],
  [156.2, 53, 'liquidambar'],
  [158.2, 66.9, 'jacaranda'],
  [158.9, 72, 'fresno'],
  [152.2, 69.4, 'liquidambar'],
  [161.4, 42.5, 'jacaranda'],
  [163.2, 50.2, 'fresno'],
  [163.8, 72.7, 'liquidambar'],
  [173.8, 50.3, 'jacaranda'],
  [173.3, 72.9, 'fresno'],
  [177.3, 53.1, 'liquidambar'],
  [178.1, 67.5, 'jacaranda'],
  [183.2, 51.2, 'fresno'],
  [182.8, 70, 'liquidambar'],
  [174.6, 41.5, 'fresno'],
  [161.5, 80.2, 'jacaranda'],
  [174.8, 80.8, 'jacaranda'],
];

// ─── Plaza Juárez (entre el atrio y la Plaza de Armas) ─────────────────────

/** El andador Juárez (el de la orilla de la Plaza de Armas) y el de en medio, con la estatua. */
const ANDADOR_JUAREZ = { x: 135.5, w: 3.5 };
const JUAREZ_EN_MEDIO_X = 126.5;
const ESTATUA_JUAREZ = { x: JUAREZ_EN_MEDIO_X, y: 27.5 };
const FUENTE_COLUMNA = { x: JUAREZ_EN_MEDIO_X, y: 83.2, r: 2.1 };
/** Las dos hileras de laureles de en medio y la del andador, cada una en su arriate cercado. */
const HILERA_JUAREZ = [121, 132] as const;
const HILERA_ANDADOR_X = 140.3;

const juarezSuelo: GroundShape[] = [
  ...HILERA_JUAREZ.map(
    (x): GroundShape => ({ kind: 'jardin', rect: { x: x - 0.8, y: 52, w: 1.6, h: 35.5 } }),
  ),
  { kind: 'jardin', rect: { x: HILERA_ANDADOR_X - 0.9, y: 29.5, w: 1.8, h: 57.5 } },
  // Glorietas de la estatua y de la fuente de columna, en losa.
  { kind: 'losa', circle: { x: ESTATUA_JUAREZ.x, y: ESTATUA_JUAREZ.y + 0.6, r: 3.4 } },
  { kind: 'losa', circle: { x: FUENTE_COLUMNA.x, y: FUENTE_COLUMNA.y, r: 3.6 } },
  // El andador Juárez va en losa de cantera, de Allende a Madero.
  {
    kind: 'losa',
    rect: { x: ANDADOR_JUAREZ.x, y: PLAZAS_Y, w: ANDADOR_JUAREZ.w, h: MADERO_BANQUETA - PLAZAS_Y },
  },
];

const juarezBancas: MapObject[] = [
  // Bancas de hierro bajo los laureles de en medio, mirando al andador de la estatua.
  ...[56.5, 61.8, 67, 72.3, 77.6].flatMap((y, i) => [
    banca(`banca-juarez-a-${i + 1}`, HILERA_JUAREZ[0] + 1.1, y, 'derecha', 'hierro'),
    banca(`banca-juarez-b-${i + 1}`, HILERA_JUAREZ[1] - 2.1, y, 'izquierda', 'hierro'),
  ]),
  // Bancas de cantera entre los laureles del andador, de espaldas al arriate.
  ...[33.2, 42.7, 54, 64, 74, 83.6].map((y, i) =>
    banca(`banca-andador-${i + 1}`, HILERA_ANDADOR_X - 2, y, 'izquierda'),
  ),
];

const juarezArboles: MapObject[] = [
  ...hilera(54.5, 86, 7).flatMap((y, i) =>
    HILERA_JUAREZ.map((x, lado) => arbol(`laurel-juarez-${lado ? 'b' : 'a'}-${i + 1}`, x, y)),
  ),
  ...hilera(31.4, 86, 12).map((y, i) => arbol(`laurel-andador-${i + 1}`, HILERA_ANDADOR_X, y)),
];

/** Fila de pilastras-farol en la orilla oriente del andador Juárez. */
const pilastrasAndador: MapObject[] = hilera(28, 86, 9).map((y, i) =>
  pilastra(`pilastra-andador-${i + 1}`, ANDADOR_JUAREZ.x - 0.6, y, 'izquierda'),
);

/** La fuente de columna del andador, cerca de Madero: pileta de tableros, columna anillada, copa y jarrón. */
const fuenteJuarez = fuente(
  'fuente-juarez',
  FUENTE_COLUMNA.x,
  FUENTE_COLUMNA.y,
  'columna',
  FUENTE_COLUMNA.r,
);

// ─── Plaza Melchor Ocampo ─────────────────────────────────────────────────

/**
 * La estatua de Melchor Ocampo (bronce, 1888, de Primitivo Miranda): de pie
 * sobre un dado de piedra oscura con su placa, en una pileta baja de piedra
 * gris oscura (5 × 6.5 tiles) en cuya orilla se sienta la gente. Desde 2008 ya
 * no hay fuente al norte: ahí brotan del piso las fuentes danzantes.
 */
const monumentoOcampo: MapObject = {
  id: 'monumento-ocampo',
  kind: 'fuente',
  x: 18,
  y: 29,
  w: 5,
  h: 6.5,
  variant: 'ocampo',
  solid: [{ x: 0, y: 0.3, w: 5, h: 6.2 }],
};
const fuentesDanzantes: MapObject = {
  id: 'fuentes-danzantes',
  kind: 'chorros',
  x: 17.6,
  y: 76,
  w: 5,
  h: 6,
};

/** Junto a la reja del atrio: bancas-cubo de cantera clara y macetones, uno y uno. */
const OCAMPO_JUNTO_REJA_X = REJA_ORIENTE_X - 1.6;
const ocampoCubos: MapObject[] = [
  ...hilera(23.5, 35.5, 4),
  ...hilera(46.5, 62.5, 5),
  ...hilera(66.5, 82.5, 5),
].map((y, i) => cubo(`cubo-ocampo-${i + 1}`, OCAMPO_JUNTO_REJA_X, y));
const macetones: MapObject[] = [
  25.5, 29.5, 33.5, 48.5, 52.5, 56.5, 60.5, 68.5, 72.5, 76.5, 80.5,
].map((y, i) => ({
  id: `maceton-ocampo-${i + 1}`,
  kind: 'jardinera',
  x: OCAMPO_JUNTO_REJA_X,
  y,
  w: 1,
  h: 1,
  variant: 'maceton',
}));

/** Del lado de Morelos: jardineras de cantera con bugambilias y naranjos (los árboles del OSM). */
const jardineras: MapObject[] = [39.5, 45.5, 51.5, 57.5, 63.5, 69.5].map((y, i) => ({
  id: `jardinera-ocampo-${i + 1}`,
  kind: 'jardinera',
  x: 10.2,
  y,
  w: 2.4,
  h: 4,
  variant: i % 2 === 0 ? 'naranjo' : 'bugambilia',
}));

/**
 * En el bordillo de cantera de las jardineras (investigacion.md §4: «jardineras
 * rectangulares con bordillo de cantera») se sienta la gente: dos lugares al
 * frente, mirando hacia Madero, y tres en el costado que da a la explanada.
 * El arte las manda al fondo para que quien se sienta de lado quede encima.
 */
function bordeDeJardinera(j: MapObject): Seat[] {
  const frente = j.y + j.h + 0.08;
  const costado = j.x + j.w - 0.12;
  return [
    ...[0.6, 1.8].map(
      (dx, i): Seat => ({
        id: `${j.id}-frente-${i + 1}`,
        x: j.x + dx,
        y: frente,
        facing: 'down',
        exit: { x: j.x + dx, y: frente + 0.55 },
        object: j.id,
        lift: 3,
      }),
    ),
    ...[0.9, 2, 3.1].map(
      (dy, i): Seat => ({
        id: `${j.id}-costado-${i + 1}`,
        x: costado,
        y: j.y + dy,
        facing: 'right',
        exit: { x: j.x + j.w + 0.55, y: j.y + dy },
        object: j.id,
        lift: 3,
      }),
    ),
  ];
}

/**
 * Donde estuvo el Árbol de los Liberales (una acacia que ya no existe) queda
 * una losa de cantera con la frase de Ocampo. Está a ras de piso: se pisa.
 */
const losaLiberales: MapObject = {
  id: 'losa-liberales',
  kind: 'placa',
  x: 11,
  y: 36.4,
  w: 1.8,
  h: 1.2,
  variant: 'losa',
  solid: [],
};

/** El asta bandera, muy alta y delgada, en medio de la explanada. */
const astaBandera: MapObject = {
  id: 'asta-bandera',
  kind: 'asta',
  x: 26.5,
  y: 53,
  w: 1,
  h: 1,
  solid: [{ x: 0.25, y: 0.45, w: 0.5, h: 0.5 }],
};

const ocampoArboles: MapObject[] = [
  // Jacarandas del lado de Madero.
  ...[10.6, 15, 30.1, 36.6].map((x, i) =>
    arbol(`jacaranda-ocampo-${i + 1}`, x, i < 2 ? 85.5 - i * 1.5 : 86.2, 'jacaranda'),
  ),
  arbol('fresno-ocampo-1', 36.5, 24, 'fresno'),
];

/** Postes negros con dos faroles de campana, en dos filas. */
const ocampoFaroles: MapObject[] = [
  ...[30, 44, 58, 72].map((y, i) => farol(`farol-ocampo-a-${i + 1}`, 16, y, 'campanas')),
  ...[30, 44, 58, 72].map((y, i) => farol(`farol-ocampo-b-${i + 1}`, 33.5, y, 'campanas')),
];

/** La vendimia de la explanada: el globero con su racimo y el carrito de churros. */
const vendimia: MapObject[] = [
  {
    id: 'globero',
    kind: 'puesto',
    x: 23,
    y: 45,
    w: 1,
    h: 1,
    variant: 'globos',
    solid: [{ x: 0.2, y: 0.45, w: 0.6, h: 0.5 }],
  },
  { id: 'carrito-churros', kind: 'puesto', x: 28.5, y: 64.5, w: 2, h: 1, variant: 'churros' },
  // El gazpacho se vende «detrás de la Catedral» (sobre Allende) y hacia San Agustín.
  { id: 'carrito-gazpacho-1', kind: 'puesto', x: 57, y: 16.6, w: 2, h: 1, variant: 'gazpacho' },
  { id: 'carrito-gazpacho-2', kind: 'puesto', x: 132.6, y: 11.5, w: 2, h: 1, variant: 'gazpacho' },
  // Elotes con su sombrilla roja, en la esquina de la Plaza de Armas junto al andador Juárez.
  { id: 'carrito-elotes', kind: 'puesto', x: 142.2, y: 26.2, w: 2, h: 1, variant: 'elotes' },
  // Un bolero entre las bancas del andador Juárez.
  {
    id: 'bolero',
    kind: 'puesto',
    x: HILERA_ANDADOR_X - 2,
    y: 38.4,
    w: 1,
    h: 1,
    variant: 'bolero',
    solid: [{ x: 0.1, y: 0.3, w: 0.8, h: 0.7 }],
  },
];

// ─── El atrio y la Catedral ───────────────────────────────────────────────

/**
 * La Catedral: la fachada norte con sus dos torres y el cuerpo central de las
 * tres puertas; detrás, las bóvedas rojas, el crucero y la cúpula de azulejo.
 * Lo sólido es la planta que dibuja el arte (catedral.ts): la cabecera, las
 * naves, el crucero de orilla a orilla, las torres y el anexo del oriente; el
 * atrio que la rodea se camina donde se ve.
 */
const CATEDRAL: MapObject = {
  id: 'catedral',
  kind: 'catedral',
  ...CATEDRAL_HUELLA,
  solid: [
    // La cabecera: el ábside y el presbiterio con la sacristía.
    { x: 8, y: 0.5, w: 24, h: 9.5 },
    // Las tres naves con sus capillas, antes y después del crucero.
    { x: 4, y: 10, w: 33, h: 12 },
    { x: 4, y: 32, w: 33, h: 14 },
    // El crucero, de orilla a orilla, con las portadas laterales en sus puntas.
    { x: 0, y: 22, w: 40, h: 10 },
    // Las torres y el cuerpo central.
    { x: 4, y: 46, w: 33, h: 10 },
    // El anexo blanco del costado oriente, junto a la torre.
    { x: 1, y: 43.5, w: 3, h: 10 },
  ],
};

/**
 * Las esculturas de los mártires (investigacion.md §2.8): dos figuras
 * estilizadas de cantera, encapuchadas y con las manos juntas, adosadas al
 * muro poniente de las naves (del lado de la Plaza de Armas), entre el
 * crucero y la torre, cada una en su corralito de reja negra.
 */
const MURO_PONIENTE_NAVES = CATEDRAL_HUELLA.x + 37;
const martires: MapObject[] = [57.2, 62.4].map((y, i) => ({
  id: `martir-${i + 1}`,
  kind: 'estatua',
  x: MURO_PONIENTE_NAVES,
  y,
  w: 1.5,
  h: 1.3,
  variant: 'martir',
  solid: [{ x: 0, y: 0.1, w: 1.45, h: 1.2 }],
}));

/**
 * La reja del atrio: barrotes de hierro sobre un murete de cantera. Tramos
 * acostados (norte) y parados (oriente y poniente); los portones son sus
 * propios objetos, con pilares de cantera y copete de herrería.
 */
function reja(id: string, x: number, y: number, w: number, h: number): MapObject {
  const acostada = w >= h;
  return {
    id,
    kind: 'reja',
    x,
    y,
    w,
    h,
    variant: acostada ? 'acostada' : 'parada',
    solid: acostada ? [{ x: 0, y: h - 0.5, w, h: 0.5 }] : [{ x: 0, y: 0, w: 0.5, h }],
  };
}

/** Portón del atrio: dos pilares de cantera con jarrones y el copete de herrería; se cruza por en medio. */
function porton(
  id: string,
  x: number,
  y: number,
  ancho: number,
  variant: 'norte' | 'lado',
): MapObject {
  if (variant === 'norte') {
    return {
      id,
      kind: 'reja',
      x,
      y,
      w: ancho,
      h: 1,
      variant: 'porton',
      solid: [
        { x: 0, y: 0.25, w: 0.9, h: 0.75 },
        { x: ancho - 0.9, y: 0.25, w: 0.9, h: 0.75 },
      ],
    };
  }
  return {
    id,
    kind: 'reja',
    x,
    y,
    w: 1,
    h: ancho,
    variant: 'porton-lado',
    solid: [
      { x: 0, y: 0, w: 0.9, h: 0.9 },
      { x: 0, y: ancho - 0.9, w: 0.9, h: 0.9 },
    ],
  };
}

/**
 * Una reja con portones: los tramos llenan lo que queda entre `desde` y
 * `hasta` alrededor de cada portón (dados por su centro y su ancho).
 */
function rejaConPortones(
  id: string,
  eje: 'x' | 'y',
  fija: number,
  desde: number,
  hasta: number,
  portones: readonly { centro: number; ancho: number }[],
): MapObject[] {
  const out: MapObject[] = [];
  let cursor = desde;
  portones.forEach((p, i) => {
    const inicio = p.centro - p.ancho / 2;
    if (inicio > cursor + 0.01) {
      out.push(
        eje === 'x'
          ? reja(`${id}-${i + 1}`, cursor, fija, inicio - cursor, 1)
          : reja(`${id}-${i + 1}`, fija, cursor, 1, inicio - cursor),
      );
    }
    out.push(
      eje === 'x'
        ? porton(`${id}-porton-${i + 1}`, inicio, fija, p.ancho, 'norte')
        : porton(`${id}-porton-${i + 1}`, fija, inicio, p.ancho, 'lado'),
    );
    cursor = inicio + p.ancho;
  });
  if (hasta > cursor + 0.01) {
    out.push(
      eje === 'x'
        ? reja(`${id}-fin`, cursor, fija, hasta - cursor, 1)
        : reja(`${id}-fin`, fija, cursor, 1, hasta - cursor),
    );
  }
  return out;
}

/** Los tres portones de Madero: el mayor frente a la puerta y uno frente a cada torre. */
const PORTONES_NORTE = [
  { centro: 57.5, ancho: 4 },
  { centro: PUERTA_MAYOR_X, ancho: 4.5 },
  { centro: 75.5, ancho: 4 },
] as const;
const rejaNorte = rejaConPortones(
  'reja-norte',
  'x',
  REJA_NORTE_Y,
  REJA_ORIENTE_X,
  REJA_PONIENTE_X + 1,
  PORTONES_NORTE,
);
/** Reja oriente, de Allende a Madero: el portón suroriente, el del crucero y el del ángulo norte. */
const rejaOriente = rejaConPortones(
  'reja-oriente',
  'y',
  REJA_ORIENTE_X,
  PLAZAS_Y + 0.4,
  REJA_NORTE_Y,
  [
    { centro: 27, ancho: 3.5 },
    { centro: 40.8, ancho: 3.5 },
    { centro: 79, ancho: 3.5 },
  ],
);
/** Reja poniente: del ángulo norte hasta la mitad del atrio (como la real); más al sur, abierto. */
const rejaPoniente = rejaConPortones(
  'reja-poniente',
  'y',
  REJA_PONIENTE_X,
  REJA_PONIENTE_DESDE,
  REJA_NORTE_Y,
  [
    { centro: 51, ancho: 3.5 },
    { centro: 79, ancho: 3.5 },
  ],
);
/** Reja sur, de la esquina de Morelos al ábside (sobre Allende). */
const rejaSur = [reja('reja-sur', REJA_ORIENTE_X, PLAZAS_Y - 0.6, 13, 1)];

/** Cubos de cantera junto a la reja de Madero, por dentro. */
const atrioCubos: MapObject[] = [48, 51, 61, 71, 81, 84, 92, 99, 106].map((x, i) =>
  cubo(`cubo-atrio-${i + 1}`, x, REJA_NORTE_Y - 1.4),
);

/** Los árboles del atrio (OSM): junto a la reja poniente y en las esquinas del oriente. */
const atrioArboles: MapObject[] = [
  arbol('fresno-atrio-1', 104.2, 45, 'fresno'),
  arbol('fresno-atrio-2', 111.5, 48.3, 'fresno'),
  arbol('liquidambar-atrio-1', 111.2, 54.8, 'liquidambar'),
  arbol('fresno-atrio-3', 110.9, 61.8, 'fresno'),
  arbol('liquidambar-atrio-2', 111.5, 72.2, 'liquidambar'),
  arbol('fresno-atrio-4', 104.5, 77, 'fresno'),
  arbol('fresno-atrio-5', 44.2, 34, 'fresno'),
];

/** Postes con faroles por los costados del atrio (al frente, los faroles van en los portones). */
const atrioFaroles: MapObject[] = [
  farol('farol-atrio-3', 92, 70),
  farol('farol-atrio-4', 92, 52),
  farol('farol-atrio-5', 92, 34),
  farol('farol-atrio-6', 44, 50),
  farol('farol-atrio-7', 44, 68),
];

// ─── Allende: casas, portales y comercios ─────────────────────────────────

/** Casa de dos pisos (cantera o aplanado de color, balcones, zaguán): su pie en la banqueta. */
function casa(id: string, x: number, w: number, variant: string): MapObject {
  return { id, kind: 'edificio', x, y: CASAS_Y - CASA_ALTO, w, h: CASA_ALTO, variant };
}
const casas: MapObject[] = [
  // El fondo de la Cerrada de San Agustín, con la torre del templo.
  {
    id: 'cerrada-san-agustin',
    kind: 'edificio',
    x: CERRADA.x,
    y: 0,
    w: CERRADA.w,
    h: 10,
    variant: 'cerrada',
  },
  casa('casa-allende-1', 7, 14.5, 'ocre'),
  casa('casa-allende-2', 21.5, 14.5, 'telas'),
  casa('casa-allende-3', 36, 16, 'crema'),
  casa('casa-allende-4', 52, 15, 'cantera'),
];

/**
 * Un portal: la arquería (pilares de cantera cada tres tiles con sus arcos de
 * medio punto y la planta alta con balcones) sobre el andador cubierto. Lo
 * sólido son los pilares; al fondo, los comercios. `variant` es el color del
 * aplanado (el Allende va crema; el Aldama, salmón).
 */
function portal(id: string, x: number, w: number, variant: 'crema' | 'salmon'): MapObject {
  return {
    id,
    kind: 'portal',
    x,
    y: PILARES_Y - PORTAL_ALTO,
    w,
    h: PORTAL_ALTO,
    variant,
    solid: Array.from({ length: Math.floor(w / ARCO) + 1 }, (_, i) => ({
      x: i * ARCO,
      y: PORTAL_ALTO - 0.8,
      w: 0.75,
      h: 0.8,
    })).filter((s) => s.x + s.w <= w + 0.001),
  };
}

/**
 * El fondo de un portal: los comercios, uno por arco (la puerta, el aparador y
 * el letrero). Va aparte de la arquería para que quien camina bajo el portal
 * quede delante de las puertas y detrás de los pilares. `variant` lista los
 * giros de izquierda a derecha.
 */
function comercios(id: string, x: number, w: number, giros: readonly string[]): MapObject {
  return {
    id,
    kind: 'comercios',
    x,
    y: PILARES_Y - PORTAL_FONDO - 2,
    w,
    h: 2,
    variant: giros.join(','),
  };
}

const portales: MapObject[] = [
  portal('portal-aldama', ALDAMA.x, ALDAMA.w, 'salmon'),
  portal('portal-allende', PORTAL_ALLENDE.x, PORTAL_ALLENDE.w, 'crema'),
];

/**
 * Los giros bajo cada portal, arco por arco y con letreros que caben en uno.
 * Salen del OSM: en el Portal Allende, el Café (donde el Café Michelena), la
 * panadería y churrería, el restaurante y el museo; en el Aldama, las
 * zapaterías, la escuela, la nevería y la farmacia. Solo hay un CAFE: el que
 * lleva al Café.
 */
const GIROS_ALDAMA = [
  'REVISTAS',
  'REGALOS',
  'ROPA',
  'DULCES',
  'LIBROS',
  'REGALOS',
  'ROPA',
  'DULCES',
  'NIEVES',
  'LIBROS',
  'PAN',
  'REVISTAS',
  'ZAPATOS',
  'ROPA',
  'ZAPATOS',
  'REGALOS',
  'ESCUELA',
  'NIEVES',
  'FARMACIA',
] as const;
/** El arco del Café en el Portal Allende (entre los pilares de x 144 y 147). */
const ARCO_CAFE = 1;
const GIROS_ALLENDE = [
  'REVISTAS',
  'CAFE',
  'DULCES',
  'LIBROS',
  'PAN',
  'CHURROS',
  'COMIDA',
  'COMIDA',
  'NIEVES',
  'REGALOS',
  'ROPA',
  'HOTEL',
  'HOTEL',
  'FARMACIA',
  'LIBROS',
  'REGALOS',
  'DULCES',
  'MUSEO',
  'MUSEO',
  'ROPA',
  'ZAPATOS',
  'HOTEL',
] as const;
const comerciosDeAllende: MapObject[] = [
  comercios('comercios-aldama', ALDAMA.x, ALDAMA.w, GIROS_ALDAMA),
  comercios('comercios-allende', PORTAL_ALLENDE.x, PORTAL_ALLENDE.w, GIROS_ALLENDE),
];

/** La puerta del Café, al fondo del arco entre los pilares de x 144 y 147. */
const PUERTA_CAFE = {
  x: PORTAL_ALLENDE.x + ARCO_CAFE * ARCO + 0.75 + (ARCO - 0.75) / 2,
  y: PILARES_Y - PORTAL_FONDO + 0.1,
};

/**
 * Las mesas del café bajo los arcos: una mesa de madera clara con dos sillas,
 * junto a los pilares; detrás queda el paso a las puertas. Cada silla es un
 * asiento (como las del Café).
 */
function mesaDePortal(id: string, arco: number): MapObject {
  return {
    id,
    kind: 'mesa',
    x: PORTAL_ALLENDE.x + arco * ARCO + 0.8,
    y: PILARES_Y - 1.75,
    w: 2.15,
    h: 0.9,
    variant: 'portal',
  };
}
function sillasDePortal(mesa: MapObject): Seat[] {
  const y = mesa.y + 0.95;
  return [
    {
      id: `${mesa.id}-izquierda`,
      x: mesa.x + 0.35,
      y,
      facing: 'right',
      exit: { x: mesa.x + 0.35, y: mesa.y - 0.45 },
      object: mesa.id,
      lift: 8,
    },
    {
      id: `${mesa.id}-derecha`,
      x: mesa.x + mesa.w - 0.35,
      y,
      facing: 'left',
      exit: { x: mesa.x + mesa.w - 0.35, y: mesa.y - 0.45 },
      object: mesa.id,
      lift: 8,
    },
  ];
}
const mesasDePortal: MapObject[] = [0, 2, 3, 5, 6, 7].map((arco, i) =>
  mesaDePortal(`mesa-portal-${i + 1}`, arco),
);

// ─── Madero ───────────────────────────────────────────────────────────────

/** Postes negros altos de doble brazo con faroles de globo blanco, cada ≈22 m. */
const maderoFaroles: MapObject[] = [12, 28, 44, 59, 80, 96, 112, 124, 150, 166, 182, 196].map(
  (x, i) => farol(`farol-madero-${i + 1}`, x, MADERO_Y - 0.6, 'globos'),
);

/** Los pasos de cebra (OSM): Morelos, dos frente a la Catedral, el andador y Abasolo. */
const CEBRAS = [9.5, 64.7, 73.3, 130.1, 144, 192] as const;

// ─── Placas y encuadres ───────────────────────────────────────────────────

const placaUnesco: MapObject = {
  id: 'placa-unesco',
  kind: 'placa',
  x: 136.6,
  y: 85.8,
  w: 1,
  h: 1,
  variant: 'unesco',
  solid: [{ x: 0.2, y: 0.5, w: 0.6, h: 0.45 }],
};
const estatuaJuarez: MapObject = {
  id: 'estatua-juarez',
  kind: 'estatua',
  x: ESTATUA_JUAREZ.x - 0.8,
  y: ESTATUA_JUAREZ.y - 0.8,
  w: 1.6,
  h: 1.6,
  variant: 'juarez',
};

const signs: Sign[] = [
  {
    id: 'placa-unesco',
    x: 137.1,
    y: 87.2,
    reach: 1.4,
    label: 'Leer la placa',
    title: 'Patrimonio Cultural de la Humanidad',
    body: [
      'México · UNESCO. Centro Histórico de la Ciudad de Morelia, Patrimonio Cultural de la Humanidad. Diciembre de 1991.',
      'Más de doscientos edificios históricos, todos de la cantera rosa de la región, guardan el trazo de la antigua Valladolid.',
    ],
  },
  {
    id: 'puerta-catedral',
    x: PUERTA_MAYOR_X,
    y: FACHADA_Y + 0.5,
    reach: 2,
    label: 'Ver la Catedral',
    title: 'Catedral de Morelia',
    body: [
      'Dedicada a la Transfiguración del Señor, se levantó en cantera rosa entre 1660 y 1744. Sus dos torres miden 62 metros, 66 con sus cruces, y se ven desde toda la ciudad.',
      'Su fachada no mira a una plaza sino a la Avenida Madero. Por ahora está cerrada: pronto se podrá entrar.',
    ],
  },
  {
    id: 'placa-juarez',
    x: ESTATUA_JUAREZ.x,
    y: ESTATUA_JUAREZ.y + 1.6,
    reach: 1.5,
    label: 'Leer la placa',
    title: 'Benito Juárez',
    body: [
      'Presidente de México, defensor de la República y de las Leyes de Reforma. Su estatua, de 1962, está en la punta del andador que lleva su nombre, frente a la calle Allende.',
    ],
  },
  {
    id: 'placa-ocampo',
    x: monumentoOcampo.x + monumentoOcampo.w / 2,
    y: monumentoOcampo.y + monumentoOcampo.h + 0.4,
    reach: 1.3,
    label: 'Leer la placa',
    title: 'Melchor Ocampo',
    body: [
      'Liberal michoacano, gobernador del estado y uno de los autores de las Leyes de Reforma. Por él, el nombre oficial del estado es Michoacán de Ocampo.',
      'Su estatua de bronce, de 1888, es obra de Primitivo Miranda.',
    ],
  },
  {
    id: 'placa-liberales',
    x: losaLiberales.x + 0.9,
    y: losaLiberales.y + 1.6,
    reach: 1.4,
    label: 'Leer la losa',
    title: 'Árbol de los Liberales',
    body: [
      'Aquí estuvo el Árbol de los Liberales, una acacia que plantaron los masones. Se perdió hace años, y el que lo reemplazó cayó en 2022.',
      'Queda esta losa con la frase de Melchor Ocampo: «Ser liberal en todo cuesta trabajo porque se requiere ser hombre en todo».',
    ],
  },
  {
    id: 'placa-martires',
    x: MURO_PONIENTE_NAVES + 1.9,
    y: 60.6,
    reach: 1.8,
    label: 'Ver las esculturas',
    title: 'Los mártires',
    body: [
      'Estas dos figuras de cantera, encapuchadas y con las manos juntas, recuerdan a los fusilados en la Plaza de Armas, que por ellos se llama también Plaza de los Mártires.',
      'Entre ellos, el padre Mariano Matamoros, brazo derecho de Morelos, en 1814. Por él se llaman el portal y el teatro del otro lado de la plaza, sobre Abasolo.',
    ],
  },
  {
    id: 'placa-armas',
    x: KIOSKO.x,
    y: KIOSKO.y + KIOSKO_R + 1.3,
    reach: 1.5,
    label: 'Leer la placa',
    title: 'Plaza de Armas',
    body: [
      'También la llaman Plaza de los Mártires, por los insurgentes que fueron fusilados aquí durante la guerra de Independencia.',
      'Su kiosko octagonal de hierro fundido, con el plafón de madera y el cupulín de lámina, llegó en 1887.',
    ],
  },
];

/** Frente a la Catedral, la cámara sube para que se vean las torres. */
const cameraZones: CameraZone[] = [
  { x: REJA_ORIENTE_X, y: FACHADA_Y - 10, w: REJA_PONIENTE_X - REJA_ORIENTE_X, h: 24, lookUp: 12 },
];

// ─── Los árboles de la Plaza de Armas, solo sobre pasto ─────────────────────

/**
 * Del OSM a veces cae un árbol sobre un andador: aquí solo quedan los que
 * pisan jardín (la última forma que cubre su tronco es `jardin`).
 */
function sobrePasto(x: number, y: number, formas: readonly GroundShape[]): boolean {
  let arriba: GroundShape | undefined;
  for (const f of formas) if (insideShape(f, x, y)) arriba = f;
  return arriba?.kind === 'jardin';
}
const formasDeArmas = [...armasSuelo, ...bancasDeEje.map(nicho)];
const armasArboles: MapObject[] = [
  ...ARMAS_LAURELES.filter(([x, y]) => sobrePasto(x, y, formasDeArmas)).map(([x, y], i) =>
    arbol(`laurel-armas-${i + 1}`, x, y),
  ),
  ...ARMAS_ALTOS.filter(([x, y]) => sobrePasto(x, y, formasDeArmas)).map(([x, y, especie], i) =>
    arbol(`${especie}-armas-${i + 1}`, x, y, especie),
  ),
];

/** Pilastras-farol: un par en la boca de cada diagonal, sobre la reja del jardín. */
const armasPilastras: MapObject[] = ESQUINAS.flatMap(([x, y], i) => {
  const dx = x < KIOSKO.x ? 1 : -1;
  const dy = y < KIOSKO.y ? 1 : -1;
  const brazo = x < KIOSKO.x ? 'izquierda' : 'derecha';
  return [
    pilastra(`pilastra-armas-${i * 2 + 1}`, x + dx * 1.85, y, brazo),
    pilastra(`pilastra-armas-${i * 2 + 2}`, x, y + dy * 2.15, brazo),
  ];
});

/** Postes con faroles en el jardín: junto al anillo del kiosko y en los ejes. */
const armasFaroles: MapObject[] = [
  farol('farol-armas-1', KIOSKO.x - 5.2, KIOSKO.y - 6.4),
  farol('farol-armas-2', KIOSKO.x + 5.2, KIOSKO.y - 6.4),
  farol('farol-armas-3', KIOSKO.x - 5.2, KIOSKO.y + 6.8),
  farol('farol-armas-4', KIOSKO.x + 5.2, KIOSKO.y + 6.8),
];

/**
 * El anillo de bancas curvas de cantera alrededor del kiosko, con el
 * respaldo calado de óculos ovales (investigacion.md §2.2): una en cada tramo
 * entre andadores, en la orilla del andador circular, de espaldas al jardín y
 * mirando al kiosko. La curva la dibuja el arte a partir de su `variant`:
 * `curva:desde:hasta:radio:cx:cy` (grados; radio y centro en tiles, desde la
 * esquina del objeto).
 */
const BANCA_KIOSKO_R = 7.6;
/** Medio grueso de la banca (asiento y respaldo), en tiles. */
const BANCA_CURVA_MEDIO = 0.35;
/** Aire entre la punta de una banca y la orilla de un andador, en tiles. */
const AIRE_ANDADOR = 0.3;
/** Lo más que abarca una banca (grados): en los tramos anchos no llega a los andadores. */
const BANCA_CURVA_MAX = 26;
/** Desde 2.9 tiles de largo caben tres lugares; si no, dos. */
const BANCA_CURVA_TRES = 2.9;

const grados = (rad: number) => (rad * 180) / Math.PI;
const radianes = (g: number) => (g * Math.PI) / 180;

/** Los andadores que llegan al anillo: su ángulo desde el kiosko y su medio ancho, en grados. */
const andadoresDelAnillo = [
  ...[0, 90, 180, 270].map((a) => ({ a, medio: grados(Math.asin(EJE / BANCA_KIOSKO_R)) })),
  ...ESQUINAS.map(([x, y]) => ({
    a: (grados(Math.atan2(y - KIOSKO.y, x - KIOSKO.x)) + 360) % 360,
    medio: grados(Math.asin(DIAGONAL / 2 / BANCA_KIOSKO_R)),
  })),
].sort((p, q) => p.a - q.a);

/** Una banca curva del anillo, de `desde` a `hasta` grados (0 a la derecha, 90 abajo). */
function bancaCurva(id: string, desde: number, hasta: number): MapObject {
  const r = BANCA_KIOSKO_R;
  // Lo sólido: círculos a lo largo de la curva; los de las puntas, metidos para no pasarse de ella.
  const metido = grados(BANCA_CURVA_MEDIO / r);
  const n = Math.max(2, Math.ceil((radianes(hasta - desde) * r) / 0.45));
  const centros = Array.from({ length: n + 1 }, (_, i) => {
    const a = radianes(desde + metido + ((hasta - desde - 2 * metido) * i) / n);
    return { x: KIOSKO.x + r * Math.cos(a), y: KIOSKO.y + r * Math.sin(a) };
  });
  // La huella: la curva con su grueso y sus puntas, redondeada al pixel de arte (1/16 de tile).
  const margen = BANCA_CURVA_MEDIO + 0.15;
  const x = Math.floor(Math.min(...centros.map((c) => c.x - margen)) * 16) / 16;
  const y = Math.floor(Math.min(...centros.map((c) => c.y - margen)) * 16) / 16;
  const w = Math.ceil(Math.max(...centros.map((c) => c.x + margen)) * 16) / 16 - x;
  const h = Math.ceil(Math.max(...centros.map((c) => c.y + margen)) * 16) / 16 - y;
  const cx = KIOSKO.x - x;
  const cy = KIOSKO.y - y;
  return {
    id,
    kind: 'banca',
    x,
    y,
    w,
    h,
    variant: `curva:${desde.toFixed(2)}:${hasta.toFixed(2)}:${r}:${cx.toFixed(4)}:${cy.toFixed(4)}`,
    solid: centros.map((c) => ({ circle: { x: c.x - x, y: c.y - y, r: BANCA_CURVA_MEDIO } })),
  };
}

/**
 * Los lugares de una banca curva, repartidos a lo largo de ella cada 0.95
 * tiles. Cada quien mira al kiosko (hacia donde más se acerca de los cuatro
 * rumbos) y se levanta hacia él, sobre el andador.
 */
function lugaresDeCurva(o: MapObject): Seat[] {
  const [, desde = 0, hasta = 0, r = BANCA_KIOSKO_R, cx = 0, cy = 0] = (o.variant ?? '')
    .split(':')
    .map(Number);
  const n = radianes(hasta - desde) * r >= BANCA_CURVA_TRES ? 3 : 2;
  const medio = (desde + hasta) / 2;
  return Array.from({ length: n }, (_, i) => {
    const a = radianes(medio + grados(((i - (n - 1) / 2) * 0.95) / r));
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const facing: Facing =
      Math.abs(ux) > Math.abs(uy) ? (ux > 0 ? 'left' : 'right') : uy > 0 ? 'up' : 'down';
    // De frente, los pies quedan delante del asiento; de lado o de espaldas, sobre él.
    const pie = facing === 'down' ? r - BANCA_CURVA_MEDIO - 0.07 : r - 0.1;
    return {
      id: `${o.id}-${i + 1}`,
      x: o.x + cx + pie * ux,
      y: o.y + cy + pie * uy,
      facing,
      exit: { x: o.x + cx + (r - 1) * ux, y: o.y + cy + (r - 1) * uy },
      object: o.id,
      ...(facing === 'down' ? {} : { lift: 2 }),
    };
  });
}

const bancasDelKiosko: MapObject[] = andadoresDelAnillo.map((andador, i) => {
  const siguiente = andadoresDelAnillo[(i + 1) % andadoresDelAnillo.length] ?? andador;
  const aire = grados(AIRE_ANDADOR / BANCA_KIOSKO_R);
  let desde = andador.a + andador.medio + aire;
  let hasta = (siguiente.a < andador.a ? siguiente.a + 360 : siguiente.a) - siguiente.medio - aire;
  const sobra = hasta - desde - BANCA_CURVA_MAX;
  if (sobra > 0) {
    desde += sobra / 2;
    hasta -= sobra / 2;
  }
  return bancaCurva(`banca-kiosko-${i + 1}`, desde, hasta);
});

// ─── El mapa ──────────────────────────────────────────────────────────────

const bancas = [
  ...bancasDeEje,
  ...bancasDeOrilla,
  ...bancasDelKiosko,
  ...juarezBancas,
  ...ocampoCubos,
  ...atrioCubos,
];
const fuentesConBorde = [...armasFuentes, fuenteJuarez];

export const PLAZA: MapDef = {
  id: 'plaza',
  version: 4,
  name: 'La Plaza',
  width: W,
  height: H,
  cellsPerTile: 4,
  ground,
  objects: [
    CATEDRAL,
    ...comerciosDeAllende,
    ...portales,
    ...casas,
    ...rejaNorte,
    ...rejaOriente,
    ...rejaPoniente,
    ...rejaSur,
    {
      // Kiosko octagonal de hierro fundido (1887) sobre su base de cantera.
      // Lo sólido es la base: el octágono, casi un círculo.
      id: 'kiosko',
      kind: 'kiosko',
      x: KIOSKO.x - 4.5,
      y: KIOSKO.y - 4,
      w: 9,
      h: 8,
      solid: [{ circle: { x: 4.5, y: 4, r: KIOSKO_R } }],
    },
    ...armasFuentes,
    fuenteJuarez,
    monumentoOcampo,
    fuentesDanzantes,
    estatuaJuarez,
    ...martires,
    placaUnesco,
    losaLiberales,
    astaBandera,
    ...jardineras,
    ...macetones,
    ...vendimia,
    ...mesasDePortal,
    ...bancas,
    ...armasArboles,
    ...juarezArboles,
    ...ocampoArboles,
    ...atrioArboles,
    ...armasFaroles,
    ...armasPilastras,
    ...pilastrasAndador,
    ...ocampoFaroles,
    ...atrioFaroles,
    ...maderoFaroles,
  ],
  spawns: {
    // En el atrio, frente a la puerta mayor, mirando la fachada.
    entrada: { x: PUERTA_MAYOR_X, y: FACHADA_Y + 3.6, facing: 'up' },
    // Bajo los portales, en la puerta del Café.
    'desde-cafe': { x: PUERTA_CAFE.x, y: PUERTA_CAFE.y + 0.65, facing: 'down' },
  },
  defaultSpawn: 'entrada',
  portals: [
    {
      id: 'plaza-cafe',
      x: PUERTA_CAFE.x,
      y: PUERTA_CAFE.y,
      reach: 1.4,
      to: { map: 'cafe', spawn: 'desde-plaza' },
      label: 'Entrar al Café',
    },
  ],
  seats: [
    ...bancas.flatMap(lugaresDe),
    ...fuentesConBorde.flatMap((f) => bordeDeFuente(f)),
    ...mesasDePortal.flatMap(sillasDePortal),
    ...jardineras.flatMap(bordeDeJardinera),
    // En la orilla de la pileta de Ocampo, a los lados de la placa.
    ...[-1.7, 1.7].map(
      (dx, i): Seat => ({
        id: `monumento-ocampo-borde-${i + 1}`,
        x: monumentoOcampo.x + monumentoOcampo.w / 2 + dx,
        y: monumentoOcampo.y + monumentoOcampo.h + 0.08,
        facing: 'down',
        exit: {
          x: monumentoOcampo.x + monumentoOcampo.w / 2 + dx,
          y: monumentoOcampo.y + monumentoOcampo.h + 0.63,
        },
        object: monumentoOcampo.id,
        lift: 3,
      }),
    ),
  ],
  signs,
  cameraZones,
  paint: [
    ...armasSuelo,
    ...luminarias,
    ...bancasDeEje.map(nicho),
    ...juarezSuelo,
    // Pasos de cebra en Madero (OSM).
    ...CEBRAS.map(
      (x): GroundShape => ({
        kind: 'cebra',
        rect: { x: x - 1.3, y: MADERO_Y, w: 2.6, h: H - MADERO_Y },
      }),
    ),
  ],
};
