import { DAMAGE_TRANSLATIONS_EN } from "./damageTranslations";

export const getLocalizedDamageString = (str, i18n) => {
  if (!str) return "";
  if (i18n && i18n.language && i18n.language.startsWith("en")) {
    // Tipos genéricos que la IA/la app guardan como "Categoría N"
    const cat = /^Categor[ií]a\s+(\d+)$/i.exec(String(str).trim());
    if (cat) return `Category ${cat[1]}`;
    if (/^Categor[ií]a Desconocida$/i.test(String(str).trim())) return "Unknown Category";
    if (DAMAGE_TRANSLATIONS_EN[str]) return DAMAGE_TRANSLATIONS_EN[str];
    // "Tipo - Subdaño": traducir cada parte por separado
    const idx = String(str).indexOf(" - ");
    if (idx !== -1) {
      return `${getLocalizedDamageString(str.slice(0, idx), i18n)} - ${getLocalizedDamageString(str.slice(idx + 3), i18n)}`;
    }
    return str;
  }
  return str;
};
