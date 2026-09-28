// Banco de desarrollo: el mundo sin sesión, para revisar el arte y el HUD a
// ojo. ?mapa=cafe elige la sala, ?spawn=… el punto, ?en=x,y cualquier lugar
// (en tiles), ?zoom=N fija el zoom (1 = el mapa entero), ?persona=N el look y
// ?quieto congela el movimiento ambiental.
// Las puertas cruzan sin servidor.
import '@fontsource-variable/big-shoulders-display';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource/permanent-marker';
import '../ui/styles/tokens.css';
import '../ui/styles/base.css';
import '../ui/styles/tianguis.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PlazaJuego } from '../app/plaza/PlazaJuego.tsx';
import { PERSONAS } from '../game/rendering/looks.ts';

const params = new URLSearchParams(window.location.search);
if (params.has('quieto')) document.documentElement.dataset.quieto = '';
const look = PERSONAS[Number(params.get('persona') ?? 0) % PERSONAS.length] ?? PERSONAS[0];
const [enX, enY] = (params.get('en') ?? '').split(',').map(Number);
const inicio =
  enX !== undefined && enY !== undefined && Number.isFinite(enX) && Number.isFinite(enY)
    ? { x: enX, y: enY }
    : undefined;

const root = document.getElementById('root');
if (!root) throw new Error('Falta #root');
createRoot(root).render(
  <StrictMode>
    <PlazaJuego
      look={look}
      nombre="Prueba"
      conectar={false}
      onSalir={() => window.location.reload()}
      {...(params.get('mapa') ? { mapa: params.get('mapa') ?? '' } : {})}
      {...(params.get('spawn') ? { spawn: params.get('spawn') ?? '' } : {})}
      {...(inicio ? { inicio } : {})}
      {...(params.get('zoom') ? { zoom: Number(params.get('zoom')) } : {})}
    />
  </StrictMode>,
);
