import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/theme.css';
import './app/app.css';

// tema escolhido antes (claro/escuro), aplicado antes do primeiro desenho
try {
  if (localStorage.getItem('m4f-tema') === 'light') document.documentElement.dataset.theme = 'light';
} catch {
  // sem armazenamento: tema escuro
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
