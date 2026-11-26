import { supabase } from "@/lib/supabase";

// URLs de imágenes del bucket "images".
// - getImageUrl(path) es síncrona: devuelve la URL firmada cacheada. Si aún no se firmó, usa la URL
//   pública (válida mientras el bucket sea público), salvo con VITE_IMAGES_PRIVATE=true: entonces
//   devuelve "" y anota la ruta (ver getUnsignedImagePaths). Con bucket privado hay que haber
//   llamado antes a primeImageUrls para esas rutas.
// - primeImageUrls(paths) firma muchas rutas en UNA petición por lote y las guarda en caché.
const BUCKET = "images";
const TTL_SECONDS = 8 * 60 * 60; // vigencia de cada URL firmada (una jornada; las URLs viven en el estado de React)
const REFRESH_MARGIN = 0.2; // se vuelve a firmar cuando queda menos del 20% de vigencia
const BATCH_SIZE = 200;

const cache = new Map(); // path -> { url, expiresAt (ms) }
const inflight = new Map(); // path -> Promise (evita firmar la misma ruta dos veces a la vez)

const isRemote = (p) => /^https?:\/\//i.test(p);
const isFresh = (entry) =>
  entry && entry.expiresAt - Date.now() > TTL_SECONDS * 1000 * REFRESH_MARGIN;

const publicUrl = (path) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

// true cuando el bucket "images" ya es privado: sin firma previa no hay URL válida, así que no se cae a la pública.
const IMAGES_PRIVATE = import.meta.env.VITE_IMAGES_PRIVATE === "true";
const unsigned = new Set(); // rutas pedidas sin firma previa (solo se llena con IMAGES_PRIVATE)

const fallbackUrl = (path, loader) => {
  if (!IMAGES_PRIVATE) return publicUrl(path);
  if (!unsigned.has(path)) {
    unsigned.add(path);
    if (import.meta.env.DEV) console.warn(`[storageUrls] ruta sin firmar (${loader}):`, path);
  }
  return "";
};

/** Rutas que se pidieron sin firma previa (diagnóstico para privatizar el bucket). */
export const getUnsignedImagePaths = () => [...unsigned];

if (import.meta.env.DEV && typeof window !== "undefined") {
  window.__getUnsignedImagePaths = getUnsignedImagePaths;
}

/** Ruta de la miniatura (.webp en /thumbnails) de una foto original. */
export function thumbPathOf(path) {
  if (!path) return null;
  const parts = path.split("/");
  const fileName = parts.pop();
  if (!fileName) return null;
  const folder = parts.join("/");
  const thumbFile = fileName.replace(/\.[^/.]+$/, ".webp");
  return folder ? `${folder}/thumbnails/${thumbFile}` : `thumbnails/${thumbFile}`;
}

/** URL de la imagen: firmada si está en caché, pública como respaldo. */
export function getImageUrl(path) {
  if (!path) return "";
  if (isRemote(path)) return path;
  const entry = cache.get(path);
  return isFresh(entry) ? entry.url : fallbackUrl(path, "getImageUrl");
}

/** URL de la miniatura de una foto original. */
export function getThumbUrl(originalPath) {
  const t = thumbPathOf(originalPath);
  return t ? getImageUrl(t) : null;
}

/**
 * Firma en lote las rutas que falten o estén por vencer. Nunca lanza: si falla un lote,
 * esas rutas siguen usando el respaldo de getImageUrl.
 * `withThumbs` firma también la miniatura de cada ruta.
 */
export async function primeImageUrls(paths, { withThumbs = false } = {}) {
  const wanted = new Set();
  for (const p of paths || []) {
    if (!p || isRemote(p)) continue;
    wanted.add(p);
    if (withThumbs) wanted.add(thumbPathOf(p));
  }
  const missing = [...wanted].filter((p) => p && !isFresh(cache.get(p)));

  const pending = [];
  const toSign = [];
  for (const p of missing) {
    if (inflight.has(p)) pending.push(inflight.get(p));
    else toSign.push(p);
  }

  for (let i = 0; i < toSign.length; i += BATCH_SIZE) {
    const chunk = toSign.slice(i, i + BATCH_SIZE);
    const job = supabase.storage
      .from(BUCKET)
      .createSignedUrls(chunk, TTL_SECONDS)
      .then(({ data, error }) => {
        if (error) throw error;
        const expiresAt = Date.now() + TTL_SECONDS * 1000;
        for (const item of data || []) {
          if (item?.path && item.signedUrl) cache.set(item.path, { url: item.signedUrl, expiresAt });
        }
      })
      .catch((e) => console.warn("[storageUrls] no se pudieron firmar URLs:", e?.message || e))
      .finally(() => chunk.forEach((p) => inflight.delete(p)));
    chunk.forEach((p) => inflight.set(p, job));
    pending.push(job);
  }

  await Promise.all(pending);
}

// --- Enlaces de larga vigencia (reporte PDF impreso) ---------------------------------------------
// Los enlaces incrustados en un PDF se abren meses después, así que no pueden vencer en 8 h.
// Una URL firmada no se puede revocar individualmente: quien tenga el PDF accede a esas fotos hasta que venza.
const LONG_TTL_SECONDS = 90 * 24 * 60 * 60; // 3 meses
const longCache = new Map(); // path -> url

/** Firma en lote rutas para enlaces del PDF (vigencia de 3 meses). Nunca lanza. */
export async function primeLongLivedUrls(paths) {
  const missing = [...new Set((paths || []).filter((p) => p && !isRemote(p) && !longCache.has(p)))];
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const chunk = missing.slice(i, i + BATCH_SIZE);
    try {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(chunk, LONG_TTL_SECONDS);
      if (error) throw error;
      for (const item of data || []) {
        if (item?.path && item.signedUrl) longCache.set(item.path, item.signedUrl);
      }
    } catch (e) {
      console.warn("[storageUrls] no se pudieron firmar enlaces de larga vigencia:", e?.message || e);
    }
  }
}

/** URL de 3 meses para enlaces del PDF (requiere primeLongLivedUrls antes; si no, respaldo según IMAGES_PRIVATE). */
export function getLongLivedUrl(path) {
  if (!path) return "";
  if (isRemote(path)) return path;
  return longCache.get(path) || fallbackUrl(path, "getLongLivedUrl");
}

/**
 * Olvida todas las URLs firmadas. Se llama al cerrar sesión o cambiar de usuario: las URLs se firman con los
 * permisos (RLS) de quien las pidió y no deben reutilizarse con otra cuenta en la misma pestaña.
 */
export function clearImageUrlCache() {
  cache.clear();
  longCache.clear();
  inflight.clear();
  unsigned.clear();
}

/** Firma y devuelve la URL de una sola ruta. */
export async function signImageUrl(path) {
  await primeImageUrls([path]);
  return getImageUrl(path);
}
