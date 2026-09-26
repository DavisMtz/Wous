import '@fontsource-variable/big-shoulders-display';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource/permanent-marker';
import './ui/styles/tokens.css';
import './ui/styles/base.css';
import './ui/styles/tianguis.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';

// Solo desarrollo: ?quieto congela el movimiento para capturar el estado final.
if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('quieto')) {
  document.documentElement.dataset.quieto = '';
}

const root = document.getElementById('root');
if (!root) throw new Error('Falta #root en index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
