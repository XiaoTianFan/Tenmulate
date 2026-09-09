import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles.css';
import './scrollbars.css';
import { registerPwa } from './app/registerPwa';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Tenmulate root element was not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerPwa();
