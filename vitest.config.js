import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Configuración de pruebas separada de vite.config.js para no tocar el build de producción.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    css: false,
    // El primer render de cada archivo paga el arranque en frío de jsdom/React; con la máquina
    // cargada superaba los 5s por defecto (pruebas triviales que fallaban por timeout, no por lógica).
    testTimeout: 15000,
  },
});
