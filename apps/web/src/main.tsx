import './zod-sin-eval.ts';
import '@fontsource-variable/big-shoulders-display';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource/permanent-marker';
import './ui/styles/tokens.css';
import './ui/styles/base.css';
import './ui/styles/tianguis.css';
import './ui/styles/creador.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';

// Solo desarrollo: ?quieto congela el movimiento para capturar el estado final.
if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('quieto')) {
  document.documentElement.dataset.quieto = '';
}

// Tras un despliegue, los chunks viejos ya no existen (y el SPA responde HTML
// en su lugar): una recarga trae los nuevos. Solo una vez cada 30 s, para no
// entrar en bucle si el problema es otro; entonces decide FronteraDeError.
window.addEventListener('vite:preloadError', (event) => {
  const key = 'wous:recarga-por-despliegue';
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last < 30_000) return;
    sessionStorage.setItem(key, String(Date.now()));
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

const root = document.getElementById('root');
if (!root) throw new Error('Falta #root en index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
