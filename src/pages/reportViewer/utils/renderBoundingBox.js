// === CORRECCIÓN: Función para renderizar bounding box en imagen ===
export const renderBoundingBox = (imgElement, bboxData) => {
  if (!imgElement || !bboxData || !bboxData.bbox_xywh_norm) return;

  try {
    // Buscar o crear overlay
    let overlay = imgElement.parentElement?.querySelector(".bbox-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "bbox-overlay";
      overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 10;
      `;

      if (imgElement.parentElement) {
        imgElement.parentElement.style.position = "relative";
        imgElement.parentElement.appendChild(overlay);
      }
    }

    // Limpiar overlays existentes
    overlay.innerHTML = "";

    // Obtener dimensiones de la imagen
    const rect = imgElement.getBoundingClientRect();
    const naturalWidth = imgElement.naturalWidth || rect.width;
    const naturalHeight = imgElement.naturalHeight || rect.height;

    // Calcular escala manteniendo aspect ratio
    const scaleX = rect.width / naturalWidth;
    const scaleY = rect.height / naturalHeight;
    const scale = Math.min(scaleX, scaleY);

    // Dimensiones escaladas de la imagen
    const scaledWidth = naturalWidth * scale;
    const scaledHeight = naturalHeight * scale;

    // Offset para centrar la imagen
    const offsetX = (rect.width - scaledWidth) / 2;
    const offsetY = (rect.height - scaledHeight) / 2;

    // Convertir coordenadas normalizadas a píxeles de pantalla
    const [nx, ny, nw, nh] = bboxData.bbox_xywh_norm;
    const bboxX = offsetX + nx * scaledWidth;
    const bboxY = offsetY + ny * scaledHeight;
    const bboxW = nw * scaledWidth;
    const bboxH = nh * scaledHeight;

    // Función para obtener color según severidad (hexadecimal)
    const getSeverityColor = (severity) => {
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

    const borderColor = getSeverityColor(bboxData.severity);

    // Crear elemento del bounding box
    const bboxDiv = document.createElement("div");
    bboxDiv.className = "damage-bbox";
    bboxDiv.style.cssText = `
      position: absolute;
      left: ${Math.round(bboxX)}px;
      top: ${Math.round(bboxY)}px;
      width: ${Math.round(bboxW)}px;
      height: ${Math.round(bboxH)}px;
      border: 3px solid ${borderColor};
      background-color: transparent;
      box-sizing: border-box;
      pointer-events: none;
      z-index: 15;
    `;

    overlay.appendChild(bboxDiv);

    console.log("[BBOX] Bounding box renderizado:", {
      normalized: bboxData.bbox_xywh_norm,
      pixels: { x: bboxX, y: bboxY, w: bboxW, h: bboxH },
      confidence: bboxData.confidence,
    });
  } catch (e) {
    console.error("[BBOX] Error renderizando bounding box:", e);
  }
};
