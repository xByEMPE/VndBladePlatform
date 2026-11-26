import { getLocalizedDamageString } from "./localizeDamage";

export const getDamageExtraData = (damage) => {
  if (!damage) return {};

  let data = {};
  if (damage.description && typeof damage.description === "string") {
    try {
      if (damage.description.trim().startsWith("{")) {
        data = JSON.parse(damage.description);
      }
    } catch (e) {
      console.warn("Error parsing damage description in getDamageExtraData", e);
    }
  } else if (damage.description && typeof damage.description === "object") {
    data = damage.description;
  }

  const attributes = damage.attributes || {};

  // === CORRECCIÓN: Parseo Inteligente del Tipo de Daño ===
  let rawType = damage.damage_type || attributes.damage_type || data.damage_type || data.category || "";
  
  // Extraer el número real de la severidad (ej. "Cat 4" -> "4", o "4" -> "4")
  const sevMatch = String(damage.severity || "").match(/\d+/);
  const sevLevel = sevMatch ? sevMatch[0] : "";

  // Evaluar si es un tipo genérico o residual de la IA
  const isGeneric = !rawType || 
                    rawType === "Unknown" || 
                    /^\d+$/.test(rawType.trim()) || 
                    /^Cat\s*\d+/i.test(rawType.trim()) || 
                    /^Categor[ií]a\s*\d+/i.test(rawType.trim());

  if (isGeneric && sevLevel) {
      rawType = `Categoría ${sevLevel}`;
  } else if (isGeneric) {
      rawType = "Categoría Desconocida";
  }

  return {
    damage_type: rawType,
    radius_mm: (() => {
      const r_m = attributes.radio || attributes.radius || data.radio || data.radius || damage.radio || damage.radius;
      const r_mm = damage.radius_mm || data.radius_mm;
      let finalRadius = 0;
      if (r_mm !== undefined && r_mm !== null && Number(r_mm) !== 0) {
        finalRadius = Number(r_mm);
      } else if (r_m !== undefined && r_m !== null && Number(r_m) !== 0) {
        finalRadius = Number(r_m) > 200 ? Number(r_m) : Number(r_m) * 1000;
      }
      if (finalRadius <= 0) return 500;
      return Math.round(finalRadius);
    })(),
    length_mm: damage.length || damage.length_mm || attributes.length || data.length || data.length_mm || 0,
    width_mm: damage.width || damage.width_mm || attributes.width || data.width || data.width_mm || 0,
    height_mm: damage.height || damage.height_mm || attributes.height || data.height || data.height_mm || 0,
    area: damage.area || attributes.area || data.area || 0,
    ...data,
    ...attributes,
  };
};

// Métricas guardadas del daño (sin recalcular): radio en metros, largo/ancho en mm.
export const getDamageMetrics = (d) => {
  const a = d?.attributes || {};
  const num = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };
  let radio = num(a.radio ?? a.radius ?? d?.radio ?? d?.radius);
  if (radio !== null && radio > 200) radio = radio / 1000; // viene en mm
  return {
    radio,
    width: a.width ?? a.width_mm ?? d?.width ?? d?.width_mm ?? null,
    length: a.length ?? a.length_mm ?? d?.length ?? d?.length_mm ?? null,
    area: a.area ?? d?.area ?? null,
    damage_type: a.damage_type || d?.damage_type || null,
  };
};

// Tipo de daño en texto ("Tipo - Subdaño"); si es genérico o falta, "Categoría N"
export const damageTypeRaw = (d) => {
  const raw = getDamageMetrics(d).damage_type;
  const n = String(d?.severity ?? "").replace(/\D/g, "") || "3";
  const isGeneric =
    !raw ||
    raw === "Unknown" ||
    /^\d+$/.test(String(raw).trim()) ||
    /^Cat\s*\d+/i.test(String(raw).trim()) ||
    /^Categor[ií]a\s*\d+/i.test(String(raw).trim());
  return isGeneric ? `Categoría ${n}` : raw;
};

// Lo mismo, traducido para mostrar en listas
export const damageTypeLabel = (d, i18n) => {
  const raw = damageTypeRaw(d);
  const idx = raw.indexOf(" - ");
  return idx === -1
    ? getLocalizedDamageString(raw, i18n)
    : `${getLocalizedDamageString(raw.slice(0, idx), i18n)} - ${getLocalizedDamageString(raw.slice(idx + 3), i18n)}`;
};
