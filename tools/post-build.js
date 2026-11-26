import { copyFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

const distPath = './dist';

console.log('🚀 Post-build: Configurando archivos SPA...');

// Copiar _redirects desde public a dist (para Netlify)
const redirectsSource = './public/_redirects';
const redirectsDest = join(distPath, '_redirects');

if (existsSync(redirectsSource)) {
  copyFileSync(redirectsSource, redirectsDest);
  console.log('✅ _redirects copiado a dist/');
} else {
  // Crear _redirects básico si no existe
  const basicRedirects = `# SPA Redirects
/report-viewer/*  /index.html  200
/*    /index.html   200`;
  
  writeFileSync(redirectsDest, basicRedirects);
  console.log('✅ _redirects básico creado en dist/');
}

// Verificar .htaccess (ya está en dist/)
const htaccessPath = join(distPath, '.htaccess');
if (existsSync(htaccessPath)) {
  console.log('✅ .htaccess existe en dist/');
} else {
  // Crear .htaccess básico si no existe
  const basicHtaccess = `<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^report-viewer/.* index.html [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^ index.html [L]
</IfModule>`;
  
  writeFileSync(htaccessPath, basicHtaccess);
  console.log('✅ .htaccess básico creado en dist/');
}

// Verificar que index.html existe
const indexPath = join(distPath, 'index.html');
if (existsSync(indexPath)) {
  console.log('✅ index.html existe en dist/');
} else {
  console.warn('❌ index.html no encontrado en dist/');
}

console.log('✅ Post-build completado. SPA debería funcionar correctamente.');
console.log('');
console.log('📋 Para probar localmente:');
console.log('   npm run serve     # Servidor con SPA fallback');
console.log('   npm run preview   # Vite preview');
console.log('');
console.log('🌐 Para despliegue:');
console.log('   Netlify: Usa _redirects automáticamente');
console.log('   Apache: Usa .htaccess automáticamente');
console.log('   Nginx: Configurar try_files manualmente');
console.log('   Vercel: Usa vercel.json automáticamente');

