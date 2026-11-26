// Elimina una carpeta completa de un bucket de Supabase Storage usando la API (no SQL: el DELETE directo
// sobre storage.objects está bloqueado y dejaría archivos huérfanos).
//
// Uso (por defecto es DRY-RUN: solo cuenta y muestra, no borra):
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<clave> \
//     node scripts/delete-storage-folder.mjs images "OAXACA 4"
// Para borrar de verdad, repite el nombre exacto de la carpeta:
//   ... node scripts/delete-storage-folder.mjs images "OAXACA 4" --confirm "OAXACA 4"
//
// Salvaguardas:
//  - El prefijo se compara con "/" final, así que "OAXACA 4" nunca toca "OAXACA IV" ni "OAXACA 4X".
//  - Se niega a borrar si alguna fila de public.captures (u otra referencia) apunta a esa carpeta.
//  - Solo borra con --confirm igual al nombre de la carpeta.

import { createClient } from '@supabase/supabase-js';

const [, , bucket, folder, flag, confirmValue] = process.argv;
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!bucket || !folder || !url || !key) {
  console.error('Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/delete-storage-folder.mjs <bucket> "<carpeta>" [--confirm "<carpeta>"]');
  process.exit(1);
}
if (folder.includes('/') || folder.trim() !== folder || !folder) {
  console.error('Indica solo el nombre de la carpeta de primer nivel, sin "/" ni espacios en los extremos.');
  process.exit(1);
}
const execute = flag === '--confirm' && confirmValue === folder;
if (flag === '--confirm' && !execute) {
  console.error(`--confirm no coincide con la carpeta "${folder}". No se borra nada.`);
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const prefix = `${folder}/`;

// 1) Que la base de datos no dependa de esta carpeta
const refs = await supabase.from('captures').select('id', { count: 'exact', head: true }).like('storage_path', `${prefix}%`);
if (refs.error) throw refs.error;
if (refs.count > 0) {
  console.error(`ABORTADO: ${refs.count} capturas en la base de datos apuntan a "${prefix}". No se borra nada.`);
  process.exit(1);
}

// 2) Listar recursivamente todos los archivos de la carpeta
async function listAll(path) {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(bucket).list(path, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    for (const item of data) {
      const full = `${path}/${item.name}`;
      if (item.id === null) files.push(...(await listAll(full)));
      else files.push(full);
    }
    if (data.length < 1000) break;
  }
  return files;
}

console.log(`Listando ${bucket}/${prefix} ...`);
const files = (await listAll(folder)).filter((p) => p.startsWith(prefix));
console.log(`${files.length} archivos encontrados. Ejemplo: ${files[0] ?? '-'}`);

if (!execute) {
  console.log('DRY-RUN: no se borró nada. Para borrar, agrega: --confirm "' + folder + '"');
  process.exit(0);
}

// 3) Borrar por lotes
let removed = 0;
for (let i = 0; i < files.length; i += 500) {
  const batch = files.slice(i, i + 500);
  const { error } = await supabase.storage.from(bucket).remove(batch);
  if (error) {
    console.error(`Error en el lote ${i / 500 + 1}: ${error.message}. Eliminados hasta ahora: ${removed}`);
    process.exit(1);
  }
  removed += batch.length;
  console.log(`Eliminados ${removed}/${files.length}`);
}
console.log('Listo.');
