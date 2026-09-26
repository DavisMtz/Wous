// Banco de desarrollo: la Plaza sin sesión, para revisar el arte y el HUD a
// ojo. ?persona=N elige el look; ?quieto congela el movimiento ambiental.
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

const root = document.getElementById('root');
if (!root) throw new Error('Falta #root');
createRoot(root).render(
  <StrictMode>
    <PlazaJuego
      look={look}
      nombre="Prueba"
      conectar={false}
      onSalir={() => window.location.reload()}
      {...(params.get('spawn') ? { spawn: params.get('spawn') ?? '' } : {})}
    />
  </StrictMode>,
);
