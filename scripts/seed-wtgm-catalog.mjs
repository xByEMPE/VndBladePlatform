// Genera el SQL para cargar un catálogo de turbinas (turbine_catalog.json) en la tabla "wtgmFile".
// Uso: node scripts/seed-wtgm-catalog.mjs <ruta/turbine_catalog.json> [salida.sql]
// Cada modelo queda como un registro (method = 'catalog', sin fotos) con su documento .wtgm ya armado,
// por lo que aparece en la lista de WtgGeneratorPage con su botón "Generar .wtgm".
// El id es determinista (uuid v5 del id del modelo): volver a ejecutar el SQL actualiza, no duplica.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { FIELDS, GENERIC } from '../src/pages/wtgwtgmgenerator/src/wtgGeometry.js';
import { buildWtgm } from '../src/pages/wtgwtgmgenerator/src/wtgmFormat.js';

const [, , inputPath, outPath = 'supabase/seeds/wtgm_catalog.sql'] = process.argv;
if (!inputPath) {
  console.error('Uso: node scripts/seed-wtgm-catalog.mjs <turbine_catalog.json> [salida.sql]');
  process.exit(1);
}

const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
function uuidV5(name) {
  const ns = Buffer.from(NAMESPACE.replace(/-/g, ''), 'hex');
  const h = createHash('sha1').update(Buffer.concat([ns, Buffer.from(name)])).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

const sqlText = (v) => (v == null || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const sqlNum = (v) => (Number.isFinite(Number(v)) && v != null ? String(Number(v)) : 'NULL');
const sqlJson = (o) => `$json$${JSON.stringify(o)}$json$::jsonb`;

// Equivalencia catálogo -> los 11 campos del .wtgm
function toGeometry(m) {
  const d = m.dimensions || {};
  const assumptions = [];
  const values = {
    hubLength: m.hubLength,
    bladeFlangeRadius: d.flangeDiameter / 2,
    bladeMaxChordWidth: d.maxChordWidth,
    hubCenterToBladeFlange: d.hubCenterToFlange,
    hubCenterToMaxChordWidth: d.hubCenterToMaxChordWidth,
    bladeTiltAngle: d.bladeTilt,
    rotorAxisAngle: d.totalTilt,
    towerCenterToHubCenter: d.towerToBladeCenter,
    towerBottomRadius: d.towerDiameterBase / 2,
    towerTopRadius: d.towerDiameterTop / 2,
    nacelleThickness: undefined,
  };
  assumptions.push('rotorAxisAngle tomado de totalTilt del catálogo.');
  assumptions.push('towerCenterToHubCenter tomado de towerToBladeCenter del catálogo.');
  const missing = [];
  // Campos que el catálogo no trae (o trae en null): se usa el valor genérico y se deja constancia
  for (const id of ['hubLength', 'nacelleThickness']) {
    if (!Number.isFinite(values[id])) {
      values[id] = GENERIC[id];
      missing.push(id);
      assumptions.push(`${id} no existe en el catálogo: valor genérico ${GENERIC[id]} m.`);
    }
  }
  for (const f of FIELDS) {
    if (!Number.isFinite(values[f.id])) throw new Error(`${m.id}: falta ${f.id} en el catálogo`);
  }
  return { values, missing, assumptions };
}

const catalog = JSON.parse(readFileSync(inputPath, 'utf8'));
const statements = [];

for (const m of catalog.models) {
  const { values, missing, assumptions } = toGeometry(m);
  const turbine = {
    id: '',
    type: m.id,
    windpark: m.source?.job || '',
    powerRating: m.nominalPowerMw != null ? `${m.nominalPowerMw} MW` : '',
    rotorDiameter: m.rotorDiameter,
    towerHeight: m.nominalTowerHeight,
    bladeLength: m.dimensions?.bladeLength,
    bladeLengthRef: 'hub',
    axisSource: 'nacelle_roof',
  };
  const wtgm = await buildWtgm({
    turbine,
    result: { values, diagnostics: { scaleMetersPerPixel: NaN, rotorRadiusErrorPct: NaN }, warnings: assumptions },
    sources: {},
    method: 'catalog',
    sigmaPx: null,
  });
  wtgm.generator = 'WtgCatalog/1.0';
  wtgm.turbine.manufacturer = m.manufacturer || null;
  wtgm.turbine.unitTypeCode = m.unitTypeCode || null;

  const id = uuidV5(`wtgm-catalog:${m.id}`);
  const cols = {
    wind_farm: sqlText(turbine.windpark),
    manufacturer: sqlText(m.manufacturer),
    wtg_model: sqlText(m.id),
    tower_height_m: sqlNum(m.nominalTowerHeight),
    rotor_diameter_m: sqlNum(m.rotorDiameter),
    blade_length_m: sqlNum(m.dimensions?.bladeLength),
    blade_length_ref: sqlText('hub'),
    axis_source: sqlText('nacelle_roof'),
    power_rating: sqlText(turbine.powerRating),
    missing_fields: `ARRAY[${missing.map(sqlText).join(', ')}]::text[]`,
    geometry: sqlJson({ values, source: 'catalog', assumptions, catalog: m }),
    uncertainty: sqlJson({}),
    wtgm: sqlJson(wtgm),
    method: sqlText('catalog'),
  };
  const names = Object.keys(cols);
  statements.push(
    `-- ${m.id} (${m.manufacturer})\n` +
    `INSERT INTO public."wtgmFile" (id, ${names.join(', ')})\n` +
    `VALUES ('${id}', ${names.map((n) => cols[n]).join(', ')})\n` +
    `ON CONFLICT (id) DO UPDATE SET\n  ${names.map((n) => `${n} = EXCLUDED.${n}`).join(',\n  ')};\n`,
  );
}

const sql = `-- Catálogo de turbinas -> "wtgmFile" (generado por scripts/seed-wtgm-catalog.mjs)\n` +
  `-- Requiere haber ejecutado antes 20261024120000_wtgm_file.sql. Se puede volver a ejecutar sin duplicar.\n\n` +
  statements.join('\n');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, sql);
console.log(`${catalog.models.length} modelos -> ${outPath}`);
