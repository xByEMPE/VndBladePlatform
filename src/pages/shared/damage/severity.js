// === MAPEO DE CAT 1 A CTA 5 POR COLORES ===
export const severityToColor = (sev = "Cat 3") => {
  const n = parseInt(String(sev).replace(/\D/g, "")) || 3;
  switch (n) {
    case 1:
      return "#008000";
    case 2:
      return "#008000";
    case 3:
      return "#FFFF00";
    case 4:
      return "#FFA500";
    case 5:
      return "#FF0000";
    default:
      return "#FFFF00";
  }
};

export const getSeverityColorForPDF = (severity) => {
  return severityToColor(severity);
};

// === UTILIDAD: hex -> {r,g,b} para jsPDF setDrawColor/setFillColor ===
export const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 128, g: 128, b: 128 };
};

// Función para ordenar daños por severidad
export const sortDamagesBySeverity = (damages, order = "desc") => {
  if (order === "all") return damages;

  return [...damages].sort((a, b) => {
    const severityA =
      parseInt(String(a.severity || "").replace(/[^0-9]/g, "")) || 3;
    const severityB =
      parseInt(String(b.severity || "").replace(/[^0-9]/g, "")) || 3;

    if (order === "desc") {
      return severityB - severityA; // Cat 5 primero, luego Cat 4, etc.
    } else {
      return severityA - severityB; // Cat 1 primero, luego Cat 2, etc.
    }
  });
};

// Normaliza la severidad a formato "Cat N" (usado por el editor)
export const normSev = (sev) =>
  !sev ? "Cat 3" : String(sev).startsWith("Cat") ? String(sev) : `Cat ${sev}`;
