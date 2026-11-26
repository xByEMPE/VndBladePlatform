// Script de prueba para verificar SPA routing
import express from 'express';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const app = express();
const PORT = 3333;
const distPath = './dist';

// Servir archivos estáticos
app.use(express.static(distPath));

// Lista de rutas SPA para probar
const spaRoutes = [
  '/report-viewer/16/A2.04',
  '/report-viewer/17/B3.05',
  '/reports-portal',
  '/projects',
  '/capture',
  '/progress',
  '/login',
  '/invite',
  '/password-reset'
];

// SPA fallback
app.get('*', (req, res) => {
  const indexPath = join(distPath, 'index.html');
  
  if (existsSync(indexPath)) {
    const html = readFileSync(indexPath, 'utf-8');
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } else {
    res.status(404).send('index.html not found in dist/');
  }
});

app.listen(PORT, () => {
  console.log(`🧪 Servidor de prueba SPA ejecutándose en http://localhost:${PORT}`);
  console.log('');
  console.log('📋 Rutas para probar:');
  spaRoutes.forEach(route => {
    console.log(`   http://localhost:${PORT}${route}`);
  });
  console.log('');
  console.log('✅ Todas estas rutas deberían cargar sin error 404');
  console.log('🔄 Puedes recargar cualquier ruta y debería funcionar');
  console.log('');
  console.log('Para detener el servidor: Ctrl+C');
});

export default app;

