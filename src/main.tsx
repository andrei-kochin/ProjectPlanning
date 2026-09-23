import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { PatAuthProvider } from './lib/auth';
import './styles.css';

const auth = new PatAuthProvider();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App auth={auth} />
  </StrictMode>,
);
