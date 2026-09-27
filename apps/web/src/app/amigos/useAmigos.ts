import type {
  BlockResponse,
  FriendActionResponse,
  FriendEntry,
  FriendListResponse,
  FriendRelation,
} from '@wous/contracts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../services/api.ts';

/**
 * Tus amistades desde tu lado (ADR-0011): amigos, lo que te mandaron y lo que
 * mandaste. Se piden al montar y cada acción actualiza la lista con lo que
 * contesta el servidor (que es quien manda): nada se da por hecho antes.
 */

export type Relacion = { relation: FriendRelation; entry: FriendEntry | null };

const VACIA: FriendListResponse = { friends: [], incoming: [], outgoing: [] };

const sin = (lista: FriendEntry[], characterId: string) =>
  lista.filter((e) => e.characterId !== characterId);

const ruta = (entry: FriendEntry, verbo: 'accept' | 'reject' | 'remove') =>
  `/friends/${encodeURIComponent(entry.friendshipId)}/${verbo}`;

/** Aplica a las listas la relación con alguien, tal como la contestó el servidor. */
function aplicar(
  listas: FriendListResponse,
  characterId: string,
  respuesta: FriendActionResponse,
): FriendListResponse {
  const limpias: FriendListResponse = {
    friends: sin(listas.friends, characterId),
    incoming: sin(listas.incoming, characterId),
    outgoing: sin(listas.outgoing, characterId),
  };
  const entry = respuesta.entry;
  if (!entry) return limpias;
  switch (respuesta.relation) {
    case 'FRIENDS':
      return { ...limpias, friends: [entry, ...limpias.friends] };
    case 'OUTGOING':
      return { ...limpias, outgoing: [entry, ...limpias.outgoing] };
    case 'INCOMING':
      return { ...limpias, incoming: [entry, ...limpias.incoming] };
    case 'NONE':
      return limpias;
  }
}

export type Amigos = {
  /** null mientras carga por primera vez. */
  listas: FriendListResponse | null;
  /** Por qué no se pudo cargar (el texto ya es para la persona). */
  error: unknown;
  recargar(): Promise<void>;
  relacionCon(characterId: string): Relacion;
  pedir(characterId: string): Promise<Relacion>;
  aceptar(entry: FriendEntry): Promise<Relacion>;
  rechazar(entry: FriendEntry): Promise<Relacion>;
  /** Cancelar tu solicitud o quitar una amistad. */
  quitar(entry: FriendEntry): Promise<Relacion>;
  bloquear(entry: FriendEntry): Promise<void>;
  /** La sala confirmó un bloqueo: el servidor ya terminó la relación, aquí solo se refleja. */
  olvidar(characterId: string): void;
};

/** `activo: false` (el banco de la plaza, sin sesión) no pide nada. */
export function useAmigos({ activo = true }: { activo?: boolean } = {}): Amigos {
  const [listas, setListas] = useState<FriendListResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const vivo = useRef(true);

  const recargar = useCallback(async () => {
    if (!activo) return;
    try {
      const data = await api.get<FriendListResponse>('/friends');
      if (!vivo.current) return;
      setListas(data);
      setError(null);
    } catch (err) {
      if (vivo.current) setError(err);
    }
  }, [activo]);

  const olvidar = useCallback((characterId: string) => {
    setListas((actual) =>
      actual ? aplicar(actual, characterId, { relation: 'NONE', entry: null }) : actual,
    );
  }, []);

  useEffect(() => {
    vivo.current = true;
    void recargar();
    return () => {
      vivo.current = false;
    };
  }, [recargar]);

  const accion = useCallback(
    async (characterId: string, pedido: Promise<FriendActionResponse>): Promise<Relacion> => {
      const respuesta = await pedido;
      if (vivo.current) setListas((actual) => aplicar(actual ?? VACIA, characterId, respuesta));
      return respuesta;
    },
    [],
  );

  const relacionCon = useCallback(
    (characterId: string): Relacion => {
      const l = listas ?? VACIA;
      const buscar = (lista: FriendEntry[]) => lista.find((e) => e.characterId === characterId);
      const amigo = buscar(l.friends);
      if (amigo) return { relation: 'FRIENDS', entry: amigo };
      const entrante = buscar(l.incoming);
      if (entrante) return { relation: 'INCOMING', entry: entrante };
      const saliente = buscar(l.outgoing);
      if (saliente) return { relation: 'OUTGOING', entry: saliente };
      return { relation: 'NONE', entry: null };
    },
    [listas],
  );

  return useMemo(
    () => ({
      listas,
      error,
      recargar,
      relacionCon,
      pedir: (characterId) =>
        accion(characterId, api.post<FriendActionResponse>('/friends/request', { characterId })),
      aceptar: (entry) =>
        accion(entry.characterId, api.post<FriendActionResponse>(ruta(entry, 'accept'))),
      rechazar: (entry) =>
        accion(entry.characterId, api.post<FriendActionResponse>(ruta(entry, 'reject'))),
      quitar: (entry) =>
        accion(entry.characterId, api.post<FriendActionResponse>(ruta(entry, 'remove'))),
      bloquear: async (entry) => {
        await api.post<BlockResponse>(`/users/${encodeURIComponent(entry.characterId)}/block`);
        if (vivo.current) olvidar(entry.characterId);
      },
      olvidar,
    }),
    [listas, error, recargar, relacionCon, accion, olvidar],
  );
}
