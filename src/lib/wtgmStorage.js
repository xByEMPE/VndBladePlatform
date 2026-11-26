import { supabase } from "@/lib/supabase";
import { FIELDS } from "@/pages/wtgwtgmgenerator/src/wtgGeometry.js";
import { buildWtgm } from "@/pages/wtgwtgmgenerator/src/wtgmFormat.js";

// Tabla y bucket comparten el nombre "wtgmFile" (el bucket es privado; admin y técnico tienen acceso por la política storage_staff_all, el cliente no)
export const WTGM_TABLE = "wtgmFile";
export const WTGM_BUCKET = "wtgmFile";

const VIEWS = ["photo1", "photo2"];

// Fotos ya subidas en esta sesión por registro y vista: evita volver a subir un JPG idéntico al guardar de nuevo
const uploadedFiles = new Map();

const toNumber = (v) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
const toText = (v) => (v == null || String(v).trim() === "" ? null : String(v).trim());
const safeName = (name) => String(name || "foto.jpg").replace(/[^\w.-]+/g, "_");

/**
 * Guarda una calibración: sube las 2 fotos al bucket y crea/actualiza la fila en `wtgmFile`
 * que las relaciona (photo1_path / photo2_path) con los datos de la turbina y las marcaciones.
 * Devuelve { id } del registro.
 */
export async function saveWtgmCalibration(payload) {
  const { turbine, points, images, result, uncertainty, wtgm, method, sigmaPx, missingFields } = payload;
  const isNew = !payload.id;
  if (wtgm?.turbine) wtgm.turbine.manufacturer = toText(turbine.manufacturer);
  const id = payload.id || crypto.randomUUID();

  const paths = {};
  const newlyUploaded = [];
  for (const view of VIEWS) {
    const img = images[view];
    if (!img?.file) throw new Error("Faltan las 2 fotos de calibración.");
    const path = `${id}/${view}_${safeName(img.name)}`;
    paths[view] = path;

    if (uploadedFiles.get(`${id}:${view}`) === img.file) continue;
    const { error } = await supabase.storage.from(WTGM_BUCKET).upload(path, img.file, {
      contentType: img.file.type || "image/jpeg",
      upsert: true,
    });
    if (error) {
      if (isNew && newlyUploaded.length) await supabase.storage.from(WTGM_BUCKET).remove(newlyUploaded);
      throw error;
    }
    newlyUploaded.push(path);
    uploadedFiles.set(`${id}:${view}`, img.file);
  }

  const row = {
    id,
    wind_farm: toText(turbine.windpark),
    manufacturer: toText(turbine.manufacturer),
    wtg_model: toText(turbine.type),
    tower_height_m: toNumber(turbine.towerHeight),
    rotor_diameter_m: toNumber(turbine.rotorDiameter),
    blade_length_m: toNumber(turbine.bladeLength),
    blade_length_ref: turbine.bladeLengthRef || null,
    axis_source: turbine.axisSource || null,
    power_rating: toText(turbine.powerRating),
    missing_fields: missingFields || [],
    photo1_path: paths.photo1,
    photo1_name: images.photo1.name,
    photo1_width: images.photo1.width,
    photo1_height: images.photo1.height,
    photo2_path: paths.photo2,
    photo2_name: images.photo2.name,
    photo2_width: images.photo2.width,
    photo2_height: images.photo2.height,
    keypoints: points,
    geometry: { values: result.values, diagnostics: result.diagnostics, warnings: result.warnings },
    uncertainty: uncertainty || {},
    wtgm,
    method,
    sigma_px: toNumber(sigmaPx),
  };

  const { error } = await supabase.from(WTGM_TABLE).upsert(row, { onConflict: "id" });
  if (error) {
    if (isNew && newlyUploaded.length) {
      await supabase.storage.from(WTGM_BUCKET).remove(newlyUploaded);
      VIEWS.forEach((v) => uploadedFiles.delete(`${id}:${v}`));
    }
    throw error;
  }
  return { id };
}

const LIST_COLUMNS =
  "id, created_at, wind_farm, manufacturer, wtg_model, power_rating, tower_height_m, rotor_diameter_m, blade_length_m, blade_length_ref, axis_source, missing_fields, method, sigma_px, uncertainty, geometry, photo1_path, photo2_path, wtgm";

/** Calibraciones guardadas, las más recientes primero. */
export async function listWtgmCalibrations() {
  const { data, error } = await supabase
    .from(WTGM_TABLE)
    .select(LIST_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Claves de los datos de turbina que se piden al crear una calibración (mismas que usa el calibrador)
const INFO_KEYS = ["windpark", "manufacturer", "type", "towerHeight", "rotorDiameter", "bladeLength"];

/**
 * Edita una calibración guardada (con o sin fotos): datos de la turbina y los 11 valores de geometría.
 * Regenera el documento .wtgm con su checksum. `form` = { turbine: {...}, values: { <campo>: número } }.
 */
export async function updateWtgmCalibration(row, form) {
  const t = form.turbine;
  const prevValues = row.geometry?.values || {};
  const changed = FIELDS.filter((f) => Number(form.values[f.id]) !== Number(prevValues[f.id])).map((f) => f.id);

  // Avisos previos: se descartan los de campos que el usuario acaba de corregir
  const notesKey = row.geometry?.assumptions ? "assumptions" : "warnings";
  const prevNotes = row.geometry?.[notesKey] || row.wtgm?.quality?.warnings || [];
  const notes = prevNotes.filter((n) => !changed.some((id) => n.startsWith(id)));

  const missingInfo = INFO_KEYS.filter((k) => toText(t[k]) == null);
  const missingGeometry = (row.missing_fields || []).filter((k) => FIELDS.some((f) => f.id === k) && !changed.includes(k));

  const uncertainty = Object.fromEntries(
    FIELDS.map((f) => [f.id, changed.includes(f.id) ? null : row.uncertainty?.[f.id] ?? null]),
  );
  const method = changed.length ? "edited" : row.method;

  const wtgm = await buildWtgm({
    turbine: t,
    result: { values: form.values, diagnostics: row.geometry?.diagnostics || {}, warnings: notes },
    uncertainty,
    sources: row.wtgm?.sources || {},
    method,
    sigmaPx: toNumber(row.sigma_px),
  });
  wtgm.turbine.manufacturer = toText(t.manufacturer);
  if (row.wtgm?.turbine?.unitTypeCode) wtgm.turbine.unitTypeCode = row.wtgm.turbine.unitTypeCode;
  if (row.wtgm?.generator) wtgm.generator = row.wtgm.generator;

  const changes = {
    wind_farm: toText(t.windpark),
    manufacturer: toText(t.manufacturer),
    wtg_model: toText(t.type),
    tower_height_m: toNumber(t.towerHeight),
    rotor_diameter_m: toNumber(t.rotorDiameter),
    blade_length_m: toNumber(t.bladeLength),
    blade_length_ref: t.bladeLengthRef || null,
    axis_source: t.axisSource || null,
    power_rating: toText(t.powerRating),
    missing_fields: [...missingInfo, ...missingGeometry],
    geometry: { ...(row.geometry || {}), values: form.values, [notesKey]: notes },
    uncertainty,
    wtgm,
    method,
  };
  const { error } = await supabase.from(WTGM_TABLE).update(changes).eq("id", row.id);
  if (error) throw error;
  return { id: row.id };
}
