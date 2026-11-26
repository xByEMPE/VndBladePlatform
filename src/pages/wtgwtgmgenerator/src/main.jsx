import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import WtgCalibrator from './WtgCalibrator.jsx';

// VITE_HF_API_URL en .env para precargar el endpoint del Space
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <WtgCalibrator apiUrl={import.meta.env.VITE_HF_API_URL || ''} />
  </StrictMode>,
);
