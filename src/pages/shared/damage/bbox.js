// === CORRECCIÓN: Función para obtener datos de bounding box de daños ===
export const getDamageBboxData = (damage) => {
  // 1. PRIORITY: Check for 'region' column (Manual Edits / New Editor)
  if (damage.region && typeof damage.region === "object") {
    const { x, y, width, height } = damage.region;
    // Validate basic existence
    if (x !== undefined && width !== undefined) {
      return {
        bbox_xywh_norm: [Number(x), Number(y), Number(width), Number(height)],
        confidence: damage.attributes?.confidence || 1.0,
        auto_detected: damage.attributes?.auto_detected || false,
        severity: damage.severity || "Cat 3",
      };
    }
  }

  // 2. FALLBACK: Check 'description' (Legacy ML Format)
  try {
    if (!damage.description) return null;

    // Some legacy descriptions are just text
    if (
      typeof damage.description !== "string" ||
      !damage.description.startsWith("{")
    )
      return null;

    const desc = JSON.parse(damage.description);

    // Verificar que tenemos bbox_xywh_norm válido
    if (
      !desc.bbox_xywh_norm ||
      !Array.isArray(desc.bbox_xywh_norm) ||
      desc.bbox_xywh_norm.length !== 4
    ) {
      return null;
    }

    return {
      bbox_xywh_norm: desc.bbox_xywh_norm.map(Number),
      image_width: desc.image_width || 0,
      image_height: desc.image_height || 0,
      confidence: desc.confidence || 0,
      auto_detected: desc.auto_detected || false,
      severity: damage.severity || "Cat 3",
    };
  } catch (e) {
    return null;
  }
};

// Región del daño en coordenadas normalizadas [x, y, ancho, alto].
// El modelo de ML guarda region.bbox_xywh_norm; las ediciones manuales, region.{x,y,width,height}.
export const getDamageBbox = (d) => {
  const r = d?.region;
  if (r && Array.isArray(r.bbox_xywh_norm) && r.bbox_xywh_norm.length === 4) {
    return r.bbox_xywh_norm.map(Number);
  }
  if (r && r.x !== undefined && r.width !== undefined) {
    return [Number(r.x), Number(r.y), Number(r.width), Number(r.height)];
  }
  return null;
};
