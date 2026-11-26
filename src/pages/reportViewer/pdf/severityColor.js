  // === Función para obtener color según categoría (para PDF) ===
export const getSeverityColorForPDF = (severity) => {
    if (!severity) return "#FFFF00";
    const cat = parseInt(String(severity).replace(/[^0-9]/g, "")) || 3;
    switch (cat) {
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
