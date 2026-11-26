import i18n from "./i18n";
import literalsEn from "./literals.en.json";

/**
 * Traduce un texto fijo escrito en español.
 * - Idioma español: devuelve el mismo texto.
 * - Idioma inglés: busca el texto en literals.en.json (clave = texto en español).
 *
 * Admite variables con {{nombre}}: tx("Radio: {{radio}} mm", { radio }).
 * Úsalo para textos de interfaz que no tienen clave i18n; los datos del proyecto
 * (nombres de proyecto, parque, turbina, cliente) NO deben pasar por aquí.
 * El componente que lo use debe llamar a useTranslation() para re-renderizar al cambiar de idioma.
 */
const warned = new Set();

const interpolate = (text, vars) =>
  vars ? text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name) => (vars[name] ?? "")) : text;

export const tx = (es, vars) => {
  const lang = String(i18n.resolvedLanguage || i18n.language || "es").toLowerCase().split("-")[0];
  if (lang !== "en") return interpolate(es, vars);

  const en = literalsEn[es];
  if (en === undefined && import.meta.env?.DEV && !warned.has(es)) {
    warned.add(es);
    console.warn(`[i18n] Falta la traducción al inglés de: "${es}" (src/i18n/literals.en.json)`);
  }
  return interpolate(en ?? es, vars);
};

/** Locale para fechas y números según el idioma activo ("en-US" en inglés, "es-MX" en español). */
export const dateLocale = () => {
  const lang = String(i18n.resolvedLanguage || i18n.language || "es").toLowerCase().split("-")[0];
  return lang === "en" ? "en-US" : "es-MX";
};

export default tx;
