import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import './ui/style.css';
import { applyExperience, loadExperience } from './app/experience';
applyExperience(loadExperience());
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
