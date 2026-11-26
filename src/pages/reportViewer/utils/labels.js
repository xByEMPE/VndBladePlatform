// === Utilidades ===
export const getBladeDisplayName = (bladeName) => {
  const bladeNameMap = {
    "Pala A": "Blade A",
    "Pala B": "Blade B",
    "Pala C": "Blade C",
    A: "Blade A",
    B: "Blade B",
    C: "Blade C",
  };
  return bladeNameMap[bladeName] || `Blade ${bladeName}`;
};

// Función para obtener acciones sugeridas según categoría
export const getSuggestedAction = (severity, t) => {
  if (!severity) return t("reportViewer.cat3Action");
  const cat = parseInt(String(severity).replace(/[^0-9]/g, "")) || 3;
  switch (cat) {
    case 1:
      return t("reportViewer.cat1Action");
    case 2:
      return t("reportViewer.cat2Action");
    case 3:
      return t("reportViewer.cat3Action");
    case 4:
      return t("reportViewer.cat4Action");
    case 5:
      return t("reportViewer.cat5Action");
    default:
      return t("reportViewer.cat3Action");
  }
};
