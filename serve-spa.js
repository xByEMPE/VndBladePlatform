// Servidor simple para servir SPA con fallback
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5173;
const distPath = join(__dirname, 'dist');

// Middleware para servir archivos estáticos
app.use(express.static(distPath));

// SPA fallback - todas las rutas no-API devuelven index.html
app.get('*', (req, res) => {
  const indexPath = join(distPath, 'index.html');
  
  if (existsSync(indexPath)) {
    const html = readFileSync(indexPath, 'utf-8');
    res.send(html);
  } else {
    res.status(404).send('index.html not found');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor SPA ejecutándose en http://localhost:${PORT}`);
  console.log(`📁 Sirviendo desde: ${distPath}`);
  console.log('✅ Configuración SPA activa - las rutas funcionarán al recargar');
});

export default app;

