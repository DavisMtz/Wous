/**
 * Los pregones de los vendedores de la Plaza (investigacion.md §2.9): al pasar
 * cerca, el globero, el de los churros, el del gazpacho, el elotero y el
 * bolero te ofrecen lo suyo en un globo. No se compra nada (el plan deja la
 * economía para después del MVP): es ambiente, del cliente.
 */

/** Lo que dice cada puesto, por su `variant`; se turnan. */
export const PREGONES: Readonly<Record<string, readonly string[]>> = {
  globos: ['¡Globos, globos!', '¡Lleve su globo!'],
  churros: ['¡Churros calientitos!', '¡Hay churros con azúcar!'],
  gazpacho: ['¡Gazpachos, gazpachos!', '¡Hay gazpacho de mango!'],
  elotes: ['¡Elotes, esquites!', '¡Hay elotes calientitos!'],
  bolero: ['¿Se los boleo, joven?', '¡Bolee, bolee!'],
};

/** Qué tan cerca hay que pasar (tiles, desde el frente del puesto). */
export const PREGON_RADIO = 3.2;
/** Cuánto tarda el mismo vendedor en volver a pregonar (ms). */
export const PREGON_PAUSA_MS = 40_000;
/** Cuánto dura el globo del pregón (ms). */
export const PREGON_MS = 3_200;

/** El pregón que toca: el siguiente de la lista del puesto, o nada si no pregona. */
export function pregonDe(variant: string | undefined, vez: number): string | null {
  const lista = variant ? PREGONES[variant] : undefined;
  if (!lista || lista.length === 0) return null;
  return lista[vez % lista.length] ?? null;
}
