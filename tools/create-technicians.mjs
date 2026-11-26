#!/usr/bin/env node
// Crea cuentas de personal (technician/admin) en Supabase Auth con la Admin API, SIN enviar correos.
//
//   Simulacro (no escribe nada; solo lee los correos existentes):
//     SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<clave> node tools/create-technicians.mjs
//   Crear de verdad:
//     ... node tools/create-technicians.mjs --apply --confirm-ref <ref>
//
//   --file <ruta>        CSV (por defecto data-private/tecnicos_produccion.csv). Columnas: email,nombre,grupo,rol,job_title
//   --apply              crea las cuentas (sin esta opción es un simulacro)
//   --confirm-ref <ref>  OBLIGATORIO con --apply: debe coincidir con el ref de SUPABASE_URL (evita escribir en el proyecto equivocado)
//   --limit <n>          procesa solo las primeras n (para una prueba corta)
//
// Cada cuenta se crea con email_confirm=true, contraseña aleatoria desconocida y full_name en user_metadata. El trigger
// on_auth_user_created crea el perfil como `client`; el rol y el puesto se ajustan después por SQL (paso aparte aprobado).
// La clave solo se lee del entorno y no se imprime. Resultados en data-private/resultado_carga.csv (sin contraseñas).

import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { parseCsv, buildPlan, randomPassword } from './lib/technicians.js';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const apply = args.includes('--apply');
const file = opt('--file') ?? 'data-private/tecnicos_produccion.csv';
const limit = opt('--limit') ? Number(opt('--limit')) : Infinity;
const confirmRef = opt('--confirm-ref');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en el entorno.');
  process.exit(1);
}
const ref = new URL(url).hostname.split('.')[0];
if (apply && confirmRef !== ref) {
  console.error(`Con --apply debes pasar --confirm-ref ${ref} (el ref del proyecto de SUPABASE_URL). No se hizo nada.`);
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// Correos que ya existen en Auth (para no duplicar)
const existing = new Set();
for (let page = 1; ; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) { console.error('No se pudo leer la lista de usuarios:', error.message); process.exit(1); }
  for (const u of data.users) if (u.email) existing.add(u.email.toLowerCase());
  if (data.users.length < 1000) break;
}

const rows = parseCsv(fs.readFileSync(file, 'utf8'));
const { toCreate, skipped, invalid } = buildPlan(rows, existing);
const todo = toCreate.slice(0, limit);

console.log(`Proyecto: ${ref}  |  modo: ${apply ? 'CREAR' : 'SIMULACRO (no escribe nada)'}`);
console.log(`Filas en el CSV: ${rows.length}  |  a crear: ${todo.length}  |  ya existen / repetidas: ${skipped.length}  |  inválidas: ${invalid.length}`);
const porRol = todo.reduce((a, r) => ((a[r.rol] = (a[r.rol] || 0) + 1), a), {});
console.log('Por rol:', porRol);
for (const s of skipped) console.log(`  omitida: ${s.email} (${s.reason})`);
for (const i of invalid) console.log(`  inválida: ${i.row.email || '(sin correo)'} (${i.reason})`);

if (!apply) {
  console.log('\nSimulacro terminado. Para crear: --apply --confirm-ref ' + ref);
  process.exit(0);
}

const results = [];
for (const r of todo) {
  const { data, error } = await admin.auth.admin.createUser({
    email: r.email,
    password: randomPassword(randomBytes),
    email_confirm: true,
    user_metadata: { full_name: r.nombre },
  });
  if (error) {
    results.push({ email: r.email, status: 'error', detail: error.message });
    console.log(`  ERROR ${r.email}: ${error.message}`);
  } else {
    results.push({ email: r.email, status: 'creada', detail: data.user.id });
  }
  await new Promise((res) => setTimeout(res, 150)); // sin saturar la API
}

fs.mkdirSync('data-private', { recursive: true });
const out = ['email,status,detail', ...results.map((x) => `${x.email},${x.status},${String(x.detail).replace(/,/g, ';')}`)].join('\n');
fs.writeFileSync(path.join('data-private', 'resultado_carga.csv'), out + '\n');
console.log(`\nListo: ${results.filter((x) => x.status === 'creada').length} creadas, ${results.filter((x) => x.status === 'error').length} con error.`);
console.log('Resultado en data-private/resultado_carga.csv. Avísame para ajustar rol y puesto por SQL.');
