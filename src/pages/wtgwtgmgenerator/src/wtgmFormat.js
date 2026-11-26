// Formato de archivo .wtgm (Wind Turbine Geometry Model) para la app de vuelo Android.
// Es JSON UTF-8 con una extensión propia. El checksum SHA-256 se calcula sobre una cadena
// canónica (un campo por línea, 4 decimales) para que Kotlin lo verifique sin depender
// del orden de las llaves JSON.

import { FIELDS } from './wtgGeometry.js';

export const WTGM_EXT = '.wtgm';
export const WTGM_MIME = 'application/vnd.wtgsurvey.geometry+json';
export const WTGM_VERSION = 1;
export const GENERATOR = 'WtgCalibrator/1.0';

const round = (v, d = 4) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : null);

export function canonicalString(geometry) {
  return FIELDS.map((f) => `${f.id}=${geometry[f.id].toFixed(4)}`).join('\n');
}

export async function sha256Hex(text) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('crypto.subtle no disponible: abre el calibrador en https o localhost.');
  }
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * @param {object} p
 * @param {object} p.turbine     datos capturados en el formulario
 * @param {object} p.result      salida de compute()
 * @param {object} p.uncertainty 1σ por campo
 * @param {object} p.sources     {photo1:{fileName,width,height}, photo2:{...}}
 * @param {string} p.method      'manual' | 'ai+review'
 * @param {number} p.sigmaPx
 */
export async function buildWtgm({ turbine, result, uncertainty = {}, sources = {}, method = 'manual', sigmaPx = 2 }) {
  const geometry = Object.fromEntries(FIELDS.map((f) => [f.id, round(result.values[f.id])]));
  const units = Object.fromEntries(FIELDS.map((f) => [f.id, f.unit === '°' ? 'deg' : 'm']));
  const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
  const doc = {
    format: 'wtgm',
    formatVersion: WTGM_VERSION,
    mimeType: WTGM_MIME,
    createdAt: new Date().toISOString(),
    generator: GENERATOR,
    turbine: {
      id: turbine.id || null,
      type: turbine.type || null,
      windpark: turbine.windpark || null,
      powerRating: turbine.powerRating || null,
      rotorDiameter: num(turbine.rotorDiameter),
      towerHeight: num(turbine.towerHeight),
      bladeLength: num(turbine.bladeLength),
      bladeLengthRef: turbine.bladeLengthRef || 'flange',
    },
    geometry,
    units,
    uncertainty: Object.fromEntries(FIELDS.map((f) => [f.id, round(uncertainty[f.id], 4)])),
    quality: {
      method,
      sigmaPx,
      axisSource: turbine.axisSource || 'nacelle_roof',
      scaleMetersPerPixel: round(result.diagnostics.scaleMetersPerPixel, 6),
      rotorRadiusErrorPct: round(result.diagnostics.rotorRadiusErrorPct ?? NaN, 2),
      warnings: result.warnings,
    },
    sources,
    checksum: { algorithm: 'SHA-256', canonical: 'fields-4dp-v1', value: '' },
  };
  doc.checksum.value = await sha256Hex(canonicalString(geometry));
  return doc;
}

export function wtgmFileName(turbine) {
  const base = [turbine.windpark, turbine.id || turbine.type || 'turbina']
    .filter(Boolean).join('_').replace(/[^\w.-]+/g, '-');
  return `${base}${WTGM_EXT}`;
}

export function downloadJson(obj, fileName, mime = 'application/json') {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
