// Utilidades puras de coordenadas para el mapa de aerogeneradores.
// `turbines.coordinates` (JSONB) llega en formatos distintos según el flujo que lo guardó;
// aquí se normaliza todo a { lat, lon } validado.

const LAT_KEYS = ["latitude", "lat", "Latitude", "LAT", "gps_latitude"];
const LON_KEYS = ["longitude", "lng", "lon", "long", "Longitude", "LON", "gps_longitude"];

/** Número finito o null. Trata texto vacío, null y booleanos como ausentes (Number("") sería 0). */
const toNumber = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string" || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Primer valor numérico válido entre varias llaves posibles. */
const pick = (obj, keys) => {
  for (const k of keys) {
    const n = toNumber(obj?.[k]);
    if (n !== null) return n;
  }
  return null;
};

/** true si lat/lon son numéricos, están en rango y no son 0,0 (valor típico de GPS sin fijar). */
export const isValidCoordinate = (lat, lon) => {
  const la = toNumber(lat);
  const lo = toNumber(lon);
  if (la === null || lo === null) return false;
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return false;
  return !(la === 0 && lo === 0);
};

const build = (lat, lon) => {
  const la = toNumber(lat);
  const lo = toNumber(lon);
  return isValidCoordinate(la, lo) ? { lat: la, lon: lo } : null;
};

/** Arreglo [lat, lon]; si el primer valor solo cabe como longitud (|v| > 90) se asume [lon, lat]. */
const fromPair = (pair) => {
  if (pair.length < 2) return null;
  const a = toNumber(pair[0]);
  const b = toNumber(pair[1]);
  if (a === null || b === null) return null;
  if (Math.abs(a) > 90 && Math.abs(b) <= 90) return build(b, a);
  return build(a, b);
};

const fromText = (text) => {
  const s = text.trim();
  if (!s) return null;
  if (s.startsWith("{") || s.startsWith("[")) {
    try {
      return parseCoordinates(JSON.parse(s));
    } catch {
      return null;
    }
  }
  const parts = s.split(/[,;\s]+/).filter(Boolean);
  return parts.length === 2 ? fromPair(parts) : null;
};

/**
 * Normaliza `turbines.coordinates` a { lat, lon } o null si no hay una posición válida.
 * Formatos: { lat, lng } y variantes, GeoJSON Point [lon, lat], arreglo [lat, lon],
 * texto "lat, lon", JSON serializado y `_raw`. Ignora `_section_aliases`.
 */
export const parseCoordinates = (raw) => {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") return fromText(raw);
  if (Array.isArray(raw)) return fromPair(raw);
  if (typeof raw !== "object") return null;

  // eslint-disable-next-line no-unused-vars
  const { _section_aliases, _raw, ...rest } = raw;

  if (Array.isArray(rest.coordinates) && rest.coordinates.length >= 2) {
    // GeoJSON: [lon, lat]
    const geo = build(rest.coordinates[1], rest.coordinates[0]);
    if (geo) return geo;
  }

  const direct = build(pick(rest, LAT_KEYS), pick(rest, LON_KEYS));
  if (direct) return direct;

  return typeof _raw === "string" ? fromText(_raw) : null;
};

/**
 * Rectángulo que contiene los puntos, en el orden de MapLibre: [[minLon, minLat], [maxLon, maxLat]].
 * Ignora puntos inválidos; devuelve null si no queda ninguno.
 */
export const getBounds = (points) => {
  if (!Array.isArray(points)) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const p of points) {
    if (!p || !isValidCoordinate(p.lat, p.lon)) continue;
    const lat = Number(p.lat);
    const lon = Number(p.lon);
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }
  if (minLat === Infinity) return null;
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
};

/**
 * Vista inicial del mapa para centrarlo donde están los aerogeneradores.
 * - Sin puntos válidos → null.
 * - Un solo punto (o todos en el mismo sitio) → centro + zoom fijo (no hay rectángulo que encuadrar).
 * - Varios → `bounds` con margen y zoom máximo (react-map-gl: initialViewState).
 */
export const getInitialViewState = (points, { padding = 60, maxZoom = 14, singleZoom = 13 } = {}) => {
  const bounds = getBounds(points);
  if (!bounds) return null;
  const [[minLon, minLat], [maxLon, maxLat]] = bounds;
  if (minLon === maxLon && minLat === maxLat) {
    return { longitude: minLon, latitude: minLat, zoom: singleZoom };
  }
  return { bounds, fitBoundsOptions: { padding, maxZoom } };
};

/**
 * Posición de una turbina para el mapa. Prioridad:
 * 1) `turbines.coordinates` válida → source "registered"
 * 2) mediana GPS de las fotos (calculada en la RPC) → source "estimated"
 * 3) nada → null (la turbina va a la bandeja "sin ubicación")
 */
export const resolveTurbinePosition = (coordinates, estimated) => {
  const registered = parseCoordinates(coordinates);
  if (registered) return { ...registered, source: "registered" };
  const est = estimated ? build(estimated.lat, estimated.lon) : null;
  return est ? { ...est, source: "estimated" } : null;
};
