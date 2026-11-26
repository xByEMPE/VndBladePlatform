// Lógica pura (sin red) para la carga de personal: leer el CSV, validar y planear. La usa tools/create-technicians.mjs
// y se prueba con vitest.

export const ALLOWED_ROLES = ['technician', 'admin']; // 'dev' nunca se asigna por carga masiva
const EMAIL_RE = /^[a-z0-9._-]+@(bo\.)?vindgroup\.com\.mx$/;

// CSV simple con comillas dobles opcionales. Devuelve objetos por encabezado.
export function parseCsv(text) {
  const rows = [];
  let cur = [];
  let field = '';
  let quoted = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { cur.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      cur.push(field); field = '';
      if (cur.some((x) => x !== '')) rows.push(cur);
      cur = [];
    } else field += c;
  }
  if (field !== '' || cur.length) { cur.push(field); if (cur.some((x) => x !== '')) rows.push(cur); }
  const [header, ...body] = rows;
  if (!header) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

/**
 * Valida y arma el plan. `existingEmails` son los correos que YA existen en Auth (en minúsculas).
 * @returns {{ toCreate: object[], skipped: {email:string, reason:string}[], invalid: {row:object, reason:string}[] }}
 */
export function buildPlan(rows, existingEmails = new Set()) {
  const toCreate = [];
  const skipped = [];
  const invalid = [];
  const seen = new Set();
  for (const row of rows) {
    const email = String(row.email ?? '').trim().toLowerCase();
    const nombre = String(row.nombre ?? '').trim();
    const rol = String(row.rol ?? '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) { invalid.push({ row, reason: 'correo fuera de vindgroup.com.mx o con formato inválido' }); continue; }
    if (!nombre) { invalid.push({ row, reason: 'sin nombre' }); continue; }
    if (!ALLOWED_ROLES.includes(rol)) { invalid.push({ row, reason: `rol no permitido: ${rol || '(vacío)'}` }); continue; }
    if (seen.has(email)) { skipped.push({ email, reason: 'repetido en la lista' }); continue; }
    seen.add(email);
    if (existingEmails.has(email)) { skipped.push({ email, reason: 'ya existe en Auth' }); continue; }
    toCreate.push({ email, nombre, rol, job_title: String(row.job_title ?? '').trim() || null });
  }
  return { toCreate, skipped, invalid };
}

// Contraseña aleatoria que nadie conoce (las cuentas entran por "olvidé mi contraseña"). Nunca se imprime.
export function randomPassword(randomBytes) {
  return randomBytes(24).toString('base64url') + 'aA1!';
}
