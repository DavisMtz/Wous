import type { Facing } from '@wous/game-core';

/**
 * Esquema de un mapa (§15). El mapa visual (Phaser) y el autoritativo
 * (servidor) salen de estos mismos datos versionados.
 */

export const MAP_IDS = ['plaza', 'cafe'] as const;
export type MapId = (typeof MAP_IDS)[number];

/** Tipos de suelo. Los marcados en BLOCKING_GROUND no se pisan. */
export type GroundKind =
  | 'fachada'
  | 'azotea'
  | 'banqueta'
  | 'adoquin'
  | 'losa'
  | 'empedrado'
  | 'portal'
  | 'ladrillo'
  | 'pasto'
  | 'seto'
  | 'calle'
  | 'duela'
  | 'mosaico'
  | 'pared';

export const BLOCKING_GROUND: ReadonlySet<GroundKind> = new Set([
  'fachada',
  'azotea',
  'seto',
  'calle',
  'pared',
]);

export type ObjectKind =
  | 'catedral'
  | 'kiosko'
  | 'fuente'
  | 'estatua'
  | 'reja'
  | 'portal'
  | 'comercios'
  | 'edificio'
  | 'puesto'
  | 'banca'
  | 'arbol'
  | 'jacaranda'
  | 'farol'
  | 'placa'
  | 'jardinera'
  | 'papel-picado'
  | 'mesa'
  | 'barra'
  | 'vitroleros'
  | 'maceta'
  | 'tapete'
  | 'focos';

/** Objetos que se dibujan pero no estorban (van encima o son solo decoración). */
export const NON_SOLID: ReadonlySet<ObjectKind> = new Set([
  'papel-picado',
  'tapete',
  'focos',
  'comercios',
]);

/** Un rectángulo de tiles: esquina superior izquierda, ancho y alto (acepta fracciones). */
export type TileRect = { x: number; y: number; w: number; h: number };

/** Una parte sólida de un objeto, relativa a su esquina: rectángulo o círculo (en tiles). */
export type SolidPart = TileRect | { circle: { x: number; y: number; r: number } };

export type MapObject = TileRect & {
  id: string;
  kind: ObjectKind;
  /** Variación visual (color de lona, flor de la maceta…). No afecta la colisión. */
  variant?: string;
  /**
   * Lo que estorba, relativo a la esquina del objeto. Sin esto, estorba toda
   * la huella (salvo los de NON_SOLID). Sirve para lo que se cruza por
   * debajo o por dentro (los arcos de un portal, la reja con su puerta) y
   * para lo redondo (una fuente, el kiosko).
   */
  solid?: readonly SolidPart[];
};

export type SpawnPoint = { x: number; y: number; facing: Facing };

export type Portal = {
  id: string;
  /** Centro del portal en tiles. */
  x: number;
  y: number;
  /** Distancia máxima (tiles) desde los pies para poder usarlo (§16). */
  reach: number;
  to: { map: MapId; spawn: string };
  /** Texto del botón contextual («Entrar al Café»). */
  label: string;
};

/**
 * Un lugar donde sentarse (ADR-0013). Sentarse lo decide la sala: quien
 * pide está cerca y el lugar está libre. Sentado no se camina; al pedir
 * caminar (o «Levantarse») se queda de pie en `exit`.
 */
export type Seat = {
  id: string;
  /** Pies de quien está sentado (tiles). Puede caer sobre algo sólido: la banca. */
  x: number;
  y: number;
  /** Hacia dónde mira quien se sienta. */
  facing: Facing;
  /** Dónde queda de pie al levantarse: tiene que ser un lugar donde se pueda estar. */
  exit: { x: number; y: number };
  /** El objeto donde está el asiento (la banca, la fuente). */
  object: string;
  /**
   * Cuántos pixeles de arte se levanta el dibujo de quien se sienta para que
   * quede sobre el asiento (una silla es más alta que una banca). Solo dibujo.
   */
  lift?: number;
};

/**
 * Algo que se lee (una placa, un letrero). No cambia nada del mundo: lo
 * muestra el cliente, sin pasar por la sala.
 */
export type Sign = {
  id: string;
  x: number;
  y: number;
  /** Distancia máxima (tiles) desde los pies para leerlo. */
  reach: number;
  /** Texto del botón contextual («Leer la placa»). */
  label: string;
  title: string;
  /** Párrafos. */
  body: readonly string[];
};

/** Materiales que se pueden pintar con una forma (ver `GroundShape`). */
export type ShapeKind =
  | 'pasto'
  | 'jardin'
  | 'adoquin'
  | 'losa'
  | 'ladrillo'
  | 'empedrado'
  | 'cebra';

/** Formas que además de dibujarse estorban: el jardín con su reja baja. */
export const BLOCKING_SHAPES: ReadonlySet<ShapeKind> = new Set(['jardin']);

/**
 * Una forma del suelo, en tiles. Pinta un material sobre tiles que se pisan,
 * así los andadores en diagonal y el anillo del kiosko no son escalones. Casi
 * todas son solo dibujo; `jardin` (pasto con su reja baja) además estorba,
 * con la precisión de la rejilla fina. La cebra (paso peatonal) va sobre la
 * calle.
 */
export type GroundShape =
  | { kind: ShapeKind; rect: TileRect }
  | { kind: ShapeKind; circle: { x: number; y: number; r: number } }
  | { kind: ShapeKind; path: { points: readonly (readonly [number, number])[]; width: number } }
  | { kind: ShapeKind; polygon: readonly (readonly [number, number])[] };

/**
 * Encuadre: dentro del rectángulo, la cámara sube `lookUp` tiles para que
 * se vea lo alto que tienes enfrente (las torres de la Catedral). Solo
 * cambia lo que se ve; nunca dónde estás.
 */
export type CameraZone = TileRect & { lookUp: number };

export type MapDef = {
  id: MapId;
  version: number;
  name: string;
  width: number;
  height: number;
  /** Celdas de colisión por lado de tile (ADR-0013): 1 en cuartos rectos, 4 con diagonales. */
  cellsPerTile: number;
  /** Suelo fila por fila (width × height). */
  ground: GroundKind[];
  objects: MapObject[];
  spawns: Record<string, SpawnPoint>;
  /** Spawn para quien llega sin venir de un portal. */
  defaultSpawn: string;
  portals: Portal[];
  seats: Seat[];
  signs: Sign[];
  cameraZones: CameraZone[];
  /** Formas del suelo, en orden (la última gana). Solo dibujo. */
  paint: GroundShape[];
};
