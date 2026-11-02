import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { registerOfflineShell } from './app/offline-shell';
import { startI18n } from './i18n/dom';
import { EN } from './i18n/dictionary';
import './app/theme.css';
import './app/app.css';
import './app/cards.css';

// tema escolhido antes (claro/escuro), aplicado antes do primeiro desenho
try {
  if (localStorage.getItem('m4f-tema') === 'light') document.documentElement.dataset.theme = 'light';
} catch {
  // sem armazenamento: tema escuro
}

// idioma (v0.40): traduz a tela antes do primeiro desenho; o botão EN/PT troca na hora
startI18n(EN);

registerOfflineShell();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
