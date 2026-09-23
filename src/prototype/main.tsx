import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './prototype.css';

const rootEl = document.getElementById('prototype-root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
