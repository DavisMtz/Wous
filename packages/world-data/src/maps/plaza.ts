import type { Facing } from '@wous/game-core';
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
 * La Plaza: el centro histórico de Morelia (ADR-0013), trazado sobre
 * OpenStreetMap y la foto de satélite. La vista mira al sur desde Avenida
 * Madero: la fachada de la Catedral da de frente, la Plaza de Armas queda a la
 * derecha (poniente) y la Plaza Melchor Ocampo a la izquierda (oriente).
 *
 * De izquierda a derecha: Av. Morelos · Plaza Melchor Ocampo (sus dos fuentes,
 * la estatua y el Árbol de los Liberales) · el atrio enrejado · la Catedral ·
 * el atrio poniente · la Plaza Juárez con su andador · la Plaza de Armas (el
 * kiosko al centro, ocho andadores en estrella, cuatro fuentes y los jardines
 * cercados) · Abasolo. Arriba, la calle Allende con los portales y el Café;
 * abajo, Madero.
 *
 * Versión 2: la primera de Morelia (la 1 era una plaza de barrio inventada).
 */

const W = 104;
const H = 49;

// ─── Suelo ────────────────────────────────────────────────────────────────

const ground = groundBuilder(W, H, 'enlosado')
  // Orillas: azoteas y las calles de los lados; Madero abajo.
  .fill(0, 0, 2, H, 'azotea')
  .fill(2, 0, 2, H, 'calle') // Av. Morelos
  .fill(102, 0, 2, H, 'azotea')
  .fill(100, 0, 2, H, 'calle') // Abasolo
  // Allende: las fachadas de enfrente, sus portales, la banqueta y el empedrado.
  .fill(4, 0, 96, 7, 'fachada')
  .fill(56, 5, 43, 2, 'portal')
  .fill(4, 7, 96, 1, 'banqueta')
  .fill(4, 8, 96, 2, 'empedrado')
  .fill(4, 10, 96, 1, 'banqueta')
  // Banquetas de Morelos y de Abasolo.
  .fill(4, 11, 1, 34, 'banqueta')
  .fill(99, 11, 1, 34, 'banqueta')
  // Plaza Melchor Ocampo: explanada de losas grises con su retícula oscura.
  .fill(5, 11, 17, 34, 'explanada')
  // El atrio: losas de cantera clara.
  .fill(22, 11, 34, 31, 'losa')
  // Madero: banqueta y avenida.
  .fill(4, 45, 96, 1, 'banqueta')
  .fill(0, 46, W, 3, 'calle')
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
 * Banca de cantera con respaldo, como las de la Plaza de Armas: dos lugares.
 * Acostada (mira arriba o abajo) mide 2×1; parada (mira a un lado), 1×2. Lo
 * sólido es el asiento, sin la orilla de enfrente.
 */
function banca(id: string, x: number, y: number, mira: Orientacion): MapObject {
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
    variant: mira,
    solid,
  };
}

/** Cubo de cantera del atrio: un lugar, mirando hacia abajo. */
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
  const mira = (o.variant ?? 'abajo') as Orientacion;
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
 * Fuente de taza (Plaza de Armas): pileta redonda de cantera con su pedestal
 * y la taza al centro. Lo sólido es la pileta; en su borde de enfrente se
 * sienta la gente (dos lugares).
 */
function fuente(id: string, cx: number, cy: number, variant: string, r = 1.4): MapObject {
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

function bordeDeFuente(f: MapObject, lift = 3, lugares: readonly number[] = [-0.55, 0.55]): Seat[] {
  const cx = f.x + f.w / 2;
  const y = f.y + f.h + 0.08;
  return lugares.map((dx, i) => ({
    id: `${f.id}-borde-${i + 1}`,
    x: cx + dx,
    y,
    facing: 'down' as const,
    exit: { x: cx + dx, y: y + 0.55 },
    object: f.id,
    lift,
  }));
}

function arbol(
  id: string,
  x: number,
  y: number,
  variant: 'laurel' | 'fresno' | 'liberales' = 'laurel',
): MapObject {
  // Solo estorba el tronco (el follaje se cruza por debajo y se transparenta).
  return {
    id,
    kind: 'arbol',
    x,
    y,
    w: 1,
    h: 1,
    variant,
    solid: [{ x: 0.3, y: 0.55, w: 0.4, h: 0.4 }],
  };
}

/** Poste de hierro con sus faroles: de tres brazos, o de dos campanas (los de la Melchor Ocampo). */
function farol(id: string, x: number, y: number, variant?: 'campanas'): MapObject {
  return {
    id,
    kind: 'farol',
    x,
    y,
    w: 1,
    h: 1,
    ...(variant ? { variant } : {}),
    solid: [{ x: 0.3, y: 0.6, w: 0.4, h: 0.35 }],
  };
}

/**
 * Pilastra de cantera (≈4.5 m) con su farol negro de brazo: van en pares en
 * las entradas de las esquinas de la Plaza de Armas y en fila por su orilla.
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

function jacaranda(id: string, x: number, y: number): MapObject {
  return { id, kind: 'jacaranda', x, y, w: 1, h: 1, solid: [{ x: 0.3, y: 0.55, w: 0.4, h: 0.4 }] };
}

// ─── Plaza de Armas ───────────────────────────────────────────────────────

/** El kiosko: centro de la estrella de andadores (un poco al norte del centro, como el real). */
const KIOSKO = { x: 83.5, y: 30.5 };
/** Centro de la base octagonal de cantera del kiosko (su huella en el piso) y su radio. */
const KIOSKO_BASE = { y: KIOSKO.y + 0.1, r: 2.55 };
/** Radio del anillo de losa alrededor del kiosko. */
const ANILLO = 6.2;
/** Medio ancho de los ejes (andadores norte–sur y oriente–poniente). */
const EJE = 1.1;
/** Los jardines cercados, dentro del andador perimetral. */
const JARDIN = { x: 71.5, y: 14.5, w: 24, h: 27 };
const ESQUINAS = [
  [JARDIN.x, JARDIN.y],
  [JARDIN.x + JARDIN.w, JARDIN.y],
  [JARDIN.x, JARDIN.y + JARDIN.h],
  [JARDIN.x + JARDIN.w, JARDIN.y + JARDIN.h],
] as const;
/** Las cuatro fuentes van sobre las diagonales, a poco más de la mitad del camino. */
const FUENTES = ESQUINAS.map(([x, y]) => ({
  x: KIOSKO.x + (x - KIOSKO.x) * 0.62,
  y: KIOSKO.y + (y - KIOSKO.y) * 0.62,
}));

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
        width: 1.9,
      },
    }),
  ),
  // Glorietas de las fuentes y el anillo del kiosko, en losa.
  ...FUENTES.map((f): GroundShape => ({ kind: 'losa', circle: { x: f.x, y: f.y, r: 2.6 } })),
  { kind: 'losa', circle: { x: KIOSKO.x, y: KIOSKO.y, r: ANILLO } },
  // El kiosko se levanta en medio de una jardinera redonda con su reja baja;
  // un andadorcito cruza el pasto hasta la puertita de su base.
  { kind: 'jardin', circle: { x: KIOSKO.x, y: KIOSKO_BASE.y, r: 3.6 } },
  { kind: 'enlosado', rect: { x: KIOSKO.x - 0.55, y: KIOSKO_BASE.y + 2.2, w: 1.1, h: 2 } },
];

/**
 * Bancas a los lados de los ejes, cada una en su nicho de losa abierto en el
 * jardín: de espaldas a la reja, mirando al andador.
 */
const bancasDeEje: MapObject[] = [
  // Eje sur (arriba del kiosko), dos pares.
  banca('banca-armas-1', KIOSKO.x - EJE - 1, 16.8, 'derecha'),
  banca('banca-armas-2', KIOSKO.x + EJE, 16.8, 'izquierda'),
  banca('banca-armas-3', KIOSKO.x - EJE - 1, 20.6, 'derecha'),
  banca('banca-armas-4', KIOSKO.x + EJE, 20.6, 'izquierda'),
  // Eje norte (abajo del kiosko).
  banca('banca-armas-5', KIOSKO.x - EJE - 1, 37.9, 'derecha'),
  banca('banca-armas-6', KIOSKO.x + EJE, 37.9, 'izquierda'),
  // Ejes oriente y poniente.
  banca('banca-armas-7', 73.4, KIOSKO.y - EJE - 1, 'abajo'),
  banca('banca-armas-8', 73.4, KIOSKO.y + EJE, 'arriba'),
  banca('banca-armas-9', 91.6, KIOSKO.y - EJE - 1, 'abajo'),
  banca('banca-armas-10', 91.6, KIOSKO.y + EJE, 'arriba'),
];

/** El nicho de una banca: losa un poco más grande que ella, abierta en el jardín. */
function nicho(o: MapObject): GroundShape {
  return { kind: 'losa', rect: { x: o.x - 0.25, y: o.y - 0.25, w: o.w + 0.5, h: o.h + 0.5 } };
}

const armasBancas: MapObject[] = [
  ...bancasDeEje,
  // En el andador de alrededor, de espaldas a la reja del jardín.
  banca('banca-armas-11', 75.5, 13.4, 'arriba'),
  banca('banca-armas-12', 89.5, 13.4, 'arriba'),
  banca('banca-armas-13', 75.5, 41.6, 'abajo'),
  banca('banca-armas-14', 89.5, 41.6, 'abajo'),
  banca('banca-armas-15', 70.4, 20.5, 'izquierda'),
  banca('banca-armas-16', 70.4, 36.0, 'izquierda'),
  banca('banca-armas-17', 95.6, 20.5, 'derecha'),
  banca('banca-armas-18', 95.6, 36.0, 'derecha'),
];

const armasFuentes = FUENTES.map((f, i) => fuente(`fuente-armas-${i + 1}`, f.x, f.y, 'taza'));

/** Laureles recortados en hilera dentro de los jardines, y fresnos grandes en medio. */
const armasArboles: MapObject[] = [
  // (Sin laurel frente a cada fuente: se ve desde el andador.)
  ...[73.2, 79.2, 88.2, 94.2].map((x, i) => arbol(`laurel-armas-sur-${i + 1}`, x - 0.5, 15.2)),
  ...[73.2, 79.2, 88.2, 94.2].map((x, i) => arbol(`laurel-armas-norte-${i + 1}`, x - 0.5, 39.6)),
  ...[18.6, 23.0, 36.5, 40.0].map((y, i) => arbol(`laurel-armas-oriente-${i + 1}`, 71.9, y - 0.5)),
  ...[18.6, 23.0, 36.5, 40.0].map((y, i) => arbol(`laurel-armas-poniente-${i + 1}`, 94.1, y - 0.5)),
  arbol('fresno-armas-1', 74.0, 26.5, 'fresno'),
  arbol('fresno-armas-2', 92.0, 25.0, 'fresno'),
  // En el andador de afuera, junto a Abasolo y Allende.
  ...[14.0, 19.0, 24.0, 33.0, 38.0, 43.0].map((y, i) =>
    arbol(`laurel-abasolo-${i + 1}`, 97.8, y - 0.5),
  ),
  ...[70.0, 78.0, 89.0, 97.0].map((x, i) => arbol(`laurel-allende-${i + 1}`, x - 0.5, 11.2)),
];

const armasFaroles: MapObject[] = [
  farol('farol-armas-1', 78.4, 29.0),
  farol('farol-armas-2', 88.0, 29.0),
  farol('farol-armas-7', 81.5, 12.4),
  farol('farol-armas-8', 84.6, 43.2),
];

/**
 * Pilastras-farol: un par en la boca de cada diagonal (a los lados, sobre la
 * reja) y una fila por la orilla que da al andador Juárez.
 */
const armasPilastras: MapObject[] = [
  pilastra('pilastra-armas-1', 73.05, JARDIN.y, 'izquierda'),
  pilastra('pilastra-armas-2', JARDIN.x, 16.45, 'izquierda'),
  pilastra('pilastra-armas-3', 93.95, JARDIN.y, 'derecha'),
  pilastra('pilastra-armas-4', JARDIN.x + JARDIN.w, 16.45, 'derecha'),
  pilastra('pilastra-armas-5', 73.25, JARDIN.y + JARDIN.h, 'izquierda'),
  pilastra('pilastra-armas-6', JARDIN.x, 39.85, 'izquierda'),
  pilastra('pilastra-armas-7', 93.75, JARDIN.y + JARDIN.h, 'derecha'),
  pilastra('pilastra-armas-8', JARDIN.x + JARDIN.w, 39.85, 'derecha'),
  pilastra('pilastra-andador-1', 69.0, 17.0, 'izquierda'),
  pilastra('pilastra-andador-2', 69.0, 25.5, 'izquierda'),
  pilastra('pilastra-andador-3', 69.0, 35.5, 'izquierda'),
];

// ─── Plaza Juárez (entre la Plaza de Armas y el atrio) ─────────────────────

const juarezSuelo: GroundShape[] = [
  // Dos hileras de laureles, cada una en su arriate cercado, a los lados del andador.
  { kind: 'jardin', rect: { x: 57.8, y: 17, w: 1.4, h: 22 } },
  { kind: 'jardin', rect: { x: 62.8, y: 17, w: 1.4, h: 22 } },
  // Glorieta de la fuentecita y la de la estatua, en losa.
  { kind: 'losa', circle: { x: 61, y: 41.6, r: 2.3 } },
  { kind: 'losa', circle: { x: 61, y: 13.8, r: 2.4 } },
];

const juarezBancas: MapObject[] = [
  banca('banca-juarez-1', 59.25, 19.5, 'derecha'),
  banca('banca-juarez-2', 59.25, 26.0, 'derecha'),
  banca('banca-juarez-3', 59.25, 32.5, 'derecha'),
  banca('banca-juarez-4', 61.75, 22.5, 'izquierda'),
  banca('banca-juarez-5', 61.75, 29.0, 'izquierda'),
  banca('banca-juarez-6', 61.75, 35.5, 'izquierda'),
];

const juarezArboles: MapObject[] = [
  ...[18.5, 22.0, 25.5, 29.0, 32.5, 36.0].map((y, i) => arbol(`laurel-juarez-a-${i + 1}`, 58.0, y)),
  ...[18.5, 22.0, 25.5, 29.0, 32.5, 36.0].map((y, i) => arbol(`laurel-juarez-b-${i + 1}`, 63.0, y)),
  arbol('fresno-juarez-1', 66.2, 24.0, 'fresno'),
  arbol('fresno-juarez-2', 66.2, 33.0, 'fresno'),
];

/** La fuente de columna del andador, cerca de Madero: pileta de tableros, columna anillada, copa y jarrón. */
const fuenteJuarez = fuente('fuente-juarez', 61, 41.6, 'columna', 1.3);

// ─── Plaza Melchor Ocampo ─────────────────────────────────────────────────

/**
 * La estatua de Melchor Ocampo (bronce, 1888, de Primitivo Miranda): de pie
 * sobre un dado de piedra oscura con su placa, en una pileta baja de piedra
 * gris oscura en cuya orilla se sienta la gente. Desde 2008 ya no hay fuente
 * al norte: ahí brotan del piso las fuentes danzantes.
 */
const monumentoOcampo: MapObject = {
  id: 'monumento-ocampo',
  kind: 'fuente',
  x: 9.5,
  y: 15,
  w: 4,
  h: 3,
  variant: 'ocampo',
  solid: [{ x: 0, y: 0.2, w: 4, h: 2.8 }],
};
const fuentesDanzantes: MapObject = {
  id: 'fuentes-danzantes',
  kind: 'chorros',
  x: 9.5,
  y: 36.5,
  w: 4,
  h: 4,
};

/** Por la reja del atrio: bancas-cubo de cantera clara y macetones, uno y uno. */
const ocampoCubos: MapObject[] = [12.2, 16.2, 24.2, 28.2, 32.2, 36.2, 40.2].map((y, i) =>
  cubo(`cubo-ocampo-${i + 1}`, 20.3, y),
);
const macetones: MapObject[] = [14.2, 26.2, 30.2, 34.2, 38.2].map((y, i) => ({
  id: `maceton-ocampo-${i + 1}`,
  kind: 'jardinera',
  x: 20.3,
  y,
  w: 1,
  h: 1,
  variant: 'maceton',
}));

/** Del lado de Morelos: jardineras de cantera con bugambilias y un naranjo. */
const jardineras: MapObject[] = [
  {
    id: 'jardinera-ocampo-1',
    kind: 'jardinera',
    x: 5.3,
    y: 12.3,
    w: 2,
    h: 3.6,
    variant: 'naranjo',
  },
  {
    id: 'jardinera-ocampo-2',
    kind: 'jardinera',
    x: 5.3,
    y: 21.6,
    w: 2,
    h: 3.6,
    variant: 'bugambilia',
  },
  {
    id: 'jardinera-ocampo-3',
    kind: 'jardinera',
    x: 5.3,
    y: 27.6,
    w: 2,
    h: 3.6,
    variant: 'naranjo',
  },
  {
    id: 'jardinera-ocampo-4',
    kind: 'jardinera',
    x: 5.3,
    y: 33.6,
    w: 2,
    h: 3.6,
    variant: 'bugambilia',
  },
];

/**
 * Donde estuvo el Árbol de los Liberales (una acacia que ya no existe) queda
 * una losa de cantera con la frase de Ocampo. Está a ras de piso: se pisa.
 */
const losaLiberales: MapObject = {
  id: 'losa-liberales',
  kind: 'placa',
  x: 5.5,
  y: 18.3,
  w: 1.6,
  h: 1,
  variant: 'losa',
  solid: [],
};

/** El asta bandera, muy alta y delgada, al centro de la explanada. */
const astaBandera: MapObject = {
  id: 'asta-bandera',
  kind: 'asta',
  x: 14,
  y: 27,
  w: 1,
  h: 1,
  solid: [{ x: 0.25, y: 0.45, w: 0.5, h: 0.5 }],
};

const ocampoArboles: MapObject[] = [
  // Jacarandas del lado de Madero.
  ...[8.0, 14.5, 18.5].map((x, i) => jacaranda(`jacaranda-ocampo-${i + 1}`, x, 42.9)),
  arbol('fresno-ocampo-1', 18.8, 13.2, 'fresno'),
];

/** Postes negros con dos faroles de campana en su travesaño. */
const ocampoFaroles: MapObject[] = [
  farol('farol-ocampo-1', 8.6, 20.0, 'campanas'),
  farol('farol-ocampo-2', 8.6, 32.6, 'campanas'),
  farol('farol-ocampo-3', 17.4, 22.6, 'campanas'),
  farol('farol-ocampo-4', 17.4, 34.4, 'campanas'),
];

/** La vendimia de la explanada: el globero con su racimo y el carrito de churros. */
const vendimia: MapObject[] = [
  {
    id: 'globero',
    kind: 'puesto',
    x: 11,
    y: 24,
    w: 1,
    h: 1,
    variant: 'globos',
    solid: [{ x: 0.2, y: 0.45, w: 0.6, h: 0.5 }],
  },
  { id: 'carrito-churros', kind: 'puesto', x: 16.5, y: 29.4, w: 2, h: 1, variant: 'churros' },
];

// ─── El atrio y la Catedral ───────────────────────────────────────────────

/**
 * La Catedral: torres de 4.5 tiles, cuerpo central de 11; la puerta mayor al
 * centro (x 34). Su huella llega hasta la banqueta de Allende, que pasa por
 * detrás del ábside como la de verdad.
 */
const CATEDRAL: MapObject = { id: 'catedral', kind: 'catedral', x: 24, y: 11, w: 20, h: 25 };

/**
 * La reja del atrio: barrotes de hierro sobre un murete de cantera. Tramos
 * acostados (norte) y parados (oriente y poniente); los portones son sus
 * propios objetos, con pilares de cantera y arco de herrería.
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

/** Portón del atrio: dos pilares de cantera con perillones y el arco de herrería; se cruza por en medio. */
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
        { x: 0, y: 0.25, w: 0.75, h: 0.75 },
        { x: ancho - 0.75, y: 0.25, w: 0.75, h: 0.75 },
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
      { x: 0, y: 0, w: 0.75, h: 0.75 },
      { x: 0, y: ancho - 0.75, w: 0.75, h: 0.75 },
    ],
  };
}

// Reja norte (sobre y = 41.5–42.5), con el portón mayor frente a la puerta y uno frente a cada torre.
const rejaNorte: MapObject[] = [
  reja('reja-norte-1', 22.5, 41.5, 3.0, 1),
  porton('porton-torre-oriente', 25.5, 41.5, 2.5, 'norte'),
  reja('reja-norte-2', 28.0, 41.5, 4.5, 1),
  porton('porton-mayor', 32.5, 41.5, 3.0, 'norte'),
  reja('reja-norte-3', 35.5, 41.5, 4.5, 1),
  porton('porton-torre-poniente', 40.0, 41.5, 2.5, 'norte'),
  reja('reja-norte-4', 42.5, 41.5, 13.5, 1),
];
// Reja oriente (x = 22.25), de Allende a Madero, con portón hacia la Melchor Ocampo.
const rejaOriente: MapObject[] = [
  reja('reja-oriente-1', 22.25, 11.2, 1, 8.8),
  porton('porton-oriente', 22.25, 20.0, 2.5, 'lado'),
  reja('reja-oriente-2', 22.25, 22.5, 1, 19.5),
];
// Reja poniente (x = 55.5): del norte hasta la mitad del atrio (como la real); más al sur, abierto.
const rejaPoniente: MapObject[] = [
  reja('reja-poniente-1', 55.5, 21.5, 1, 7.0),
  porton('porton-poniente', 55.5, 28.5, 2.5, 'lado'),
  reja('reja-poniente-2', 55.5, 31.0, 1, 11.0),
];

const atrioCubos: MapObject[] = [28.5, 30.5, 37.0, 39.0, 46.0, 49.0, 52.0].map((x, i) =>
  cubo(`cubo-atrio-${i + 1}`, x, 40.0),
);

const atrioArboles: MapObject[] = [
  arbol('fresno-atrio-1', 52.6, 22.5, 'fresno'),
  arbol('fresno-atrio-2', 53.4, 30.0, 'fresno'),
  arbol('fresno-atrio-3', 51.2, 36.2, 'fresno'),
];

const atrioFaroles: MapObject[] = [
  farol('farol-atrio-1', 30.2, 37.6),
  farol('farol-atrio-2', 37.8, 37.6),
  farol('farol-atrio-3', 46.0, 33.0),
];

// ─── Allende: portales y fachadas de enfrente ─────────────────────────────

/**
 * Los portales de Allende frente a la Plaza de Armas y la Juárez: arcos de
 * medio punto sobre pilares de cantera cada 3 tiles, con el andador cubierto
 * detrás (y = 5–7) y los comercios al fondo. Lo sólido son los pilares; el
 * Café abre en el arco de x 71.75–74.
 */
const PORTAL_X = 56;
const PORTAL_ARCOS = 14;
const portales: MapObject = {
  id: 'portales-allende',
  kind: 'portal',
  x: PORTAL_X,
  y: 0,
  w: PORTAL_ARCOS * 3 + 1,
  h: 7,
  solid: Array.from({ length: PORTAL_ARCOS + 1 }, (_, i) => ({
    x: i * 3,
    y: 6.2,
    w: 0.75,
    h: 0.8,
  })),
};
/** La puerta del Café, al fondo del arco entre los pilares de x 71 y 74. */
const PUERTA_CAFE = { x: 72.875, y: 5.1 };

/** Fachadas sin portal: dos pisos de cantera o aplanado, con balcones y comercios. */
function edificio(id: string, x: number, w: number, variant: string): MapObject {
  return { id, kind: 'edificio', x, y: 0, w, h: 7, variant };
}
const edificios: MapObject[] = [
  edificio('casa-allende-1', 4, 6, 'cantera'),
  edificio('casa-allende-2', 10, 5, 'ocre'),
  edificio('casa-allende-3', 15, 4, 'cantera'),
  edificio('casa-allende-4', 19, 5, 'rosa'),
  edificio('casa-allende-5', 24, 7, 'ocre'),
  edificio('casa-allende-6', 31, 6, 'cantera'),
  edificio('casa-allende-7', 37, 7, 'rosa'),
  edificio('casa-allende-8', 44, 6, 'cantera'),
  edificio('casa-allende-9', 50, 6, 'ocre'),
];

/**
 * El fondo de los portales: los comercios que se ven entre los arcos (el
 * Café, la panadería, el restaurante…). Va aparte de los arcos para que quien
 * camina bajo el portal quede delante de las puertas y detrás de los pilares.
 */
const comercios: MapObject = {
  id: 'comercios-allende',
  kind: 'comercios',
  x: PORTAL_X,
  y: 3,
  w: PORTAL_ARCOS * 3 + 1,
  h: 2,
};

const maderoFaroles: MapObject[] = [6, 20, 47, 58, 70, 96].map((x, i) =>
  farol(`farol-madero-${i + 1}`, x, 44.3),
);

// ─── Placas y encuadres ───────────────────────────────────────────────────

const placaUnesco: MapObject = {
  id: 'placa-unesco',
  kind: 'placa',
  x: 65.6,
  y: 42.9,
  w: 1,
  h: 1,
  variant: 'unesco',
  solid: [{ x: 0.2, y: 0.5, w: 0.6, h: 0.45 }],
};
const estatuaJuarez: MapObject = {
  id: 'estatua-juarez',
  kind: 'estatua',
  x: 60.2,
  y: 12.6,
  w: 1.6,
  h: 1.6,
  variant: 'juarez',
};

const signs: Sign[] = [
  {
    id: 'placa-unesco',
    x: 66.1,
    y: 44.0,
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
    x: 34,
    y: 36.4,
    reach: 1.9,
    label: 'Ver la Catedral',
    title: 'Catedral de Morelia',
    body: [
      'Dedicada a la Transfiguración del Señor, se levantó en cantera rosa entre 1660 y 1744. Sus dos torres miden 62 metros, 66 con sus cruces, y se ven desde toda la ciudad.',
      'Su fachada no mira a una plaza sino a la Avenida Madero. Por ahora está cerrada: pronto se podrá entrar.',
    ],
  },
  {
    id: 'placa-juarez',
    x: 61,
    y: 14.9,
    reach: 1.5,
    label: 'Leer la placa',
    title: 'Benito Juárez',
    body: [
      'Presidente de México, defensor de la República y de las Leyes de Reforma. Su estatua, de 1962, está en la punta del andador que lleva su nombre, frente a la calle Allende.',
    ],
  },
  {
    id: 'placa-ocampo',
    x: 11.5,
    y: 18.7,
    reach: 1.2,
    label: 'Leer la placa',
    title: 'Melchor Ocampo',
    body: [
      'Liberal michoacano, gobernador del estado y uno de los autores de las Leyes de Reforma. Por él, el nombre oficial del estado es Michoacán de Ocampo.',
      'Su estatua de bronce, de 1888, es obra de Primitivo Miranda.',
    ],
  },
  {
    id: 'placa-liberales',
    x: 6.3,
    y: 18.9,
    reach: 1.4,
    label: 'Leer la losa',
    title: 'Árbol de los Liberales',
    body: [
      'Aquí estuvo el Árbol de los Liberales, una acacia que plantaron los masones. Se perdió hace años, y el que lo reemplazó cayó en 2022.',
      'Queda esta losa con la frase de Melchor Ocampo: «Ser liberal en todo cuesta trabajo porque se requiere ser hombre en todo».',
    ],
  },
  {
    id: 'placa-armas',
    x: KIOSKO.x,
    y: KIOSKO_BASE.y + 3.0,
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
const cameraZones: CameraZone[] = [{ x: 22, y: 33, w: 34, h: 13, lookUp: 6 }];

// ─── El mapa ──────────────────────────────────────────────────────────────

const bancas = [...armasBancas, ...juarezBancas, ...ocampoCubos, ...atrioCubos];
const fuentesConBorde = [...armasFuentes, fuenteJuarez];

export const PLAZA: MapDef = {
  id: 'plaza',
  version: 2,
  name: 'La Plaza',
  width: W,
  height: H,
  cellsPerTile: 4,
  ground,
  objects: [
    CATEDRAL,
    comercios,
    portales,
    ...edificios,
    ...rejaNorte,
    ...rejaOriente,
    ...rejaPoniente,
    {
      // Kiosko octagonal de hierro fundido (1887) sobre su base de cantera.
      // Lo sólido es la base: el octágono, casi un círculo.
      id: 'kiosko',
      kind: 'kiosko',
      x: KIOSKO.x - 3,
      y: KIOSKO_BASE.y - 2.8,
      w: 6,
      h: 5.6,
      solid: [{ circle: { x: 3, y: 2.8, r: KIOSKO_BASE.r } }],
    },
    ...armasFuentes,
    fuenteJuarez,
    monumentoOcampo,
    fuentesDanzantes,
    estatuaJuarez,
    placaUnesco,
    losaLiberales,
    astaBandera,
    ...jardineras,
    ...macetones,
    ...vendimia,
    ...bancas,
    ...armasArboles,
    ...juarezArboles,
    ...ocampoArboles,
    ...atrioArboles,
    ...armasFaroles,
    ...armasPilastras,
    ...ocampoFaroles,
    ...atrioFaroles,
    ...maderoFaroles,
  ],
  spawns: {
    // En el atrio, frente a la puerta mayor, mirando la fachada.
    entrada: { x: 34, y: 39.9, facing: 'up' },
    // Bajo los portales, en la puerta del Café.
    'desde-cafe': { x: PUERTA_CAFE.x, y: 5.75, facing: 'down' },
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
    // En la orilla de la pileta de Ocampo, a los lados de la placa.
    ...bordeDeFuente(monumentoOcampo, 3, [-1.3, 1.3]),
  ],
  signs,
  cameraZones,
  paint: [
    ...armasSuelo,
    ...bancasDeEje.map(nicho),
    ...juarezSuelo,
    // Pasos de cebra en Madero, frente a cada plaza.
    { kind: 'cebra', rect: { x: 9.5, y: 46, w: 2.5, h: 3 } },
    { kind: 'cebra', rect: { x: 32.5, y: 46, w: 3, h: 3 } },
    { kind: 'cebra', rect: { x: 60, y: 46, w: 2.5, h: 3 } },
    { kind: 'cebra', rect: { x: 82.25, y: 46, w: 2.5, h: 3 } },
  ],
};
