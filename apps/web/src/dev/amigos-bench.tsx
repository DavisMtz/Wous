// Banco de desarrollo: la página de tu banda sin sesión ni servidor, con gente
// de ejemplo que responde en el acto. ?caso=vacio | album | cargando | error
// cambia el estado y ?quieto congela el movimiento para las capturas.
import '@fontsource-variable/big-shoulders-display';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource/permanent-marker';
import '../ui/styles/tokens.css';
import '../ui/styles/base.css';
import '../ui/styles/tianguis.css';
import '../ui/styles/amigos.css';

import type { AppearanceInput, FriendEntry, FriendListResponse } from '@wous/contracts';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Banda } from '../app/amigos/Banda.tsx';
import type { AccionesDeBanda } from '../app/amigos/piezas.tsx';
import { RouterProvider } from '../app/router.tsx';
import { appearanceFromLook } from '../game/rendering/appearance.ts';
import { randomLook, seeded } from '../game/rendering/looks.ts';
import { ApiError } from '../services/api.ts';
import { Puesto } from '../ui/components/Puesto.tsx';

const params = new URLSearchParams(window.location.search);
if (params.has('quieto')) document.documentElement.dataset.quieto = '';
const caso = params.get('caso') ?? 'normal';

// Sin servidor: los avisos por correo contestan desde aquí.
const fetchReal = window.fetch.bind(window);
let avisos = { friendRequestEmail: true, friendAcceptedEmail: false };
window.fetch = async (input, init) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.includes('/api/v1/preferences')) {
    if (init?.method === 'POST' && typeof init.body === 'string') {
      avisos = { ...avisos, ...JSON.parse(init.body) };
    }
    return new Response(JSON.stringify({ data: avisos, requestId: 'req_banco' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return fetchReal(input, init);
};

const AHORA = Date.UTC(2026, 8, 27, 18, 0);
const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

const look = (
  body: 'a' | 'b',
  skinTone: string,
  hair: string,
  hairColor: string,
  top: string,
  bottom: string,
  shoes: string,
  accessory: string | null = null,
) => ({ body, skinTone, hair, hairColor, top, bottom, shoes, accessory }) as AppearanceInput;

let n = 0;
const entry = (displayName: string, appearance: AppearanceInput, since: number): FriendEntry => {
  n += 1;
  const id = String(n).padStart(4, '0');
  return {
    friendshipId: `frn_01J8ZQ4Y7V3M2N6P8R0S1T${id}`,
    characterId: `chr_01J8ZQ4Y7V3M2N6P8R0S1T${id}`,
    displayName,
    appearance,
    since,
  };
};

const BANDA: FriendEntry[] = [
  entry(
    'Lupita Ríos',
    look(
      'b',
      'piel-2',
      'largo',
      'castano-oscuro',
      'sudadera.rosa',
      'pantalon.mezclilla',
      'tenis.blanco',
      'aretes.amarillo',
    ),
    AHORA - 2 * DIA,
  ),
  entry(
    'Chuy',
    look(
      'a',
      'piel-4',
      'rapado',
      'negro',
      'playera.amarillo',
      'short.caqui',
      'tenis.rojo',
      'gorra.rojo',
    ),
    AHORA - 5 * DIA,
  ),
  entry(
    'Marisol',
    look('b', 'piel-3', 'chongo', 'negro', 'rayas.azul', 'falda.morado', 'tenis.negro'),
    AHORA - 9 * DIA,
  ),
  entry(
    'Toño Beltrán',
    look(
      'a',
      'piel-5',
      'chino',
      'negro',
      'chamarra.verde',
      'jogger.negro',
      'tenis.blanco',
      'lentes.negro',
    ),
    AHORA - 12 * DIA,
  ),
  entry(
    'Fer',
    look(
      'b',
      'piel-1',
      'coleta',
      'rubio',
      'tirantes.naranja',
      'pantalon.azul',
      'chanclas.amarillo',
    ),
    AHORA - 15 * DIA,
  ),
  entry(
    'Beto Plática',
    look('a', 'piel-3', 'corto', 'castano', 'playera.verde', 'pantalon.mezclilla', 'tenis.azul'),
    AHORA - 20 * DIA,
  ),
];

const NOMBRES = [
  'Nayeli',
  'Kevin',
  'Ximena',
  'Iván',
  'Carmen',
  'Óscar',
  'Pau',
  'Rafa',
  'Sofi',
  'Julio',
  'Brenda',
];
const ALBUM: FriendEntry[] = [
  ...BANDA,
  ...NOMBRES.map((nombre, i) =>
    entry(nombre, appearanceFromLook(randomLook(seeded(40 + i))), AHORA - (22 + i) * DIA),
  ),
];

const LISTAS: FriendListResponse = {
  friends: caso === 'vacio' ? [] : caso === 'album' ? ALBUM : BANDA,
  incoming:
    caso === 'vacio'
      ? []
      : [
          entry(
            'Dani Olvera',
            look(
              'a',
              'piel-2',
              'corto',
              'azul',
              'manga-larga.negro',
              'pantalon.negro',
              'tenis.blanco',
              'lentes.rojo',
            ),
            AHORA - 2 * HORA,
          ),
          entry(
            'Rocío',
            look(
              'b',
              'piel-6',
              'chino',
              'negro',
              'sudadera.morado',
              'short.mezclilla',
              'tenis.verde',
              'aretes.rosa',
            ),
            AHORA - 26 * HORA,
          ),
        ],
  outgoing:
    caso === 'vacio'
      ? []
      : [
          entry(
            'Memo Garza',
            look(
              'a',
              'piel-4',
              'largo',
              'castano',
              'playera.blanco',
              'jogger.caqui',
              'tenis.negro',
              'gorra.azul',
            ),
            AHORA - 3 * DIA,
          ),
        ],
};

const pausa = () => new Promise((r) => setTimeout(r, 450));
const sin = (lista: FriendEntry[], e: FriendEntry) =>
  lista.filter((x) => x.friendshipId !== e.friendshipId);

function Banco() {
  const [listas, setListas] = useState<FriendListResponse>(LISTAS);
  const acciones: AccionesDeBanda = {
    aceptar: async (e) => {
      await pausa();
      setListas((l) => ({
        ...l,
        incoming: sin(l.incoming, e),
        friends: [{ ...e, since: AHORA }, ...l.friends],
      }));
    },
    rechazar: async (e) => {
      await pausa();
      setListas((l) => ({ ...l, incoming: sin(l.incoming, e) }));
    },
    cancelar: async (e) => {
      await pausa();
      if (e.displayName === 'Memo Garza' && params.has('fallar')) {
        throw new ApiError(
          'NETWORK_ERROR',
          'No hay conexión con Wous. Revisa tu internet e inténtalo otra vez.',
          0,
        );
      }
      setListas((l) => ({ ...l, outgoing: sin(l.outgoing, e) }));
    },
    quitar: async (e) => {
      await pausa();
      setListas((l) => ({ ...l, friends: sin(l.friends, e) }));
    },
    bloquear: async (e) => {
      await pausa();
      setListas((l) => ({ ...l, friends: sin(l.friends, e) }));
    },
  };
  const error =
    caso === 'error'
      ? new ApiError(
          'NETWORK_ERROR',
          'No hay conexión con Wous. Revisa tu internet e inténtalo otra vez.',
          0,
        )
      : null;
  return (
    <Puesto>
      <Banda
        listas={caso === 'cargando' || caso === 'error' ? null : listas}
        error={error}
        acciones={acciones}
        ahora={AHORA}
        onReintentar={() => window.location.reload()}
        onHecho={(texto) => console.info('[banda]', texto)}
      />
    </Puesto>
  );
}

// ?abrir=Nombre abre su ficha (como si se tocara su nombre); ?paso=bloquear pide confirmar.
const abrir = params.get('abrir');
if (abrir) {
  window.setTimeout(() => {
    const botones = [...document.querySelectorAll<HTMLButtonElement>('.foto__nombre')];
    botones.find((b) => b.textContent === abrir)?.click();
    const paso = params.get('paso');
    if (!paso) return;
    window.setTimeout(() => {
      const enFicha = [...document.querySelectorAll<HTMLButtonElement>('.foto__ficha button')];
      enFicha.find((b) => b.textContent?.trim().toLowerCase() === paso)?.click();
    }, 150);
  }, 400);
}

const root = document.getElementById('root');
if (!root) throw new Error('Falta #root');
createRoot(root).render(
  <StrictMode>
    <RouterProvider>
      <Banco />
    </RouterProvider>
  </StrictMode>,
);
