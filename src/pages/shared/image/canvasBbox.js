import { getSeverityColorForPDF } from "../damage/severity";

// === Helper to load image safely ===
export const loadImageElement = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

// === Función para agregar bounding box a imagen completa ===
export const addBboxToImage = async (
  imageUrl,
  bboxInput,
  maxWidthPx = 300,
  quality = 0.8,
  severity = "Cat 3",
) => {
  try {
    const img = await loadImageElement(imageUrl);

    const originalWidth = img.naturalWidth;
    const originalHeight = img.naturalHeight;

    // Escalar imagen para el PDF
    const scale = Math.min(
      1,
      maxWidthPx / Math.max(originalWidth, originalHeight),
    );
    const targetWidth = Math.max(1, Math.round(originalWidth * scale));
    const targetHeight = Math.max(1, Math.round(originalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");

    // Dibujar imagen
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    // Normalizar coordenadas si es necesario
    let [nx, ny, nw, nh] = bboxInput;

    // Auto-detect: si los valores son > 2, asumimos que son píxeles
    if (nx > 2 || ny > 2 || nw > 2 || nh > 2) {
      nx = nx / originalWidth;
      ny = ny / originalHeight;
      nw = nw / originalWidth;
      nh = nh / originalHeight;
    }

    // Asegurarse de que las coordenadas estén normalizadas y numéricas
    if (isNaN(nx) || isNaN(ny) || isNaN(nw) || isNaN(nh)) {
      console.warn("[BBOX] Invalid coordinates:", bboxInput);
      return null;
    }

    const bboxX = nx * targetWidth;
    const bboxY = ny * targetHeight;
    const bboxW = nw * targetWidth;
    const bboxH = nh * targetHeight;

    // Obtener color según la categoría
    const severityColor = getSeverityColorForPDF(severity);

    // Estilo del bounding box
    ctx.strokeStyle = severityColor;
    ctx.lineWidth = Math.max(2, targetWidth / 100);
    ctx.setLineDash([]);
    ctx.strokeRect(bboxX, bboxY, bboxW, bboxH);

    return canvas.toDataURL("image/jpeg", quality);
  } catch (err) {
    console.warn("[BBOX] Error agregando bounding box a imagen:", err);
    return null;
  }
};

// === Función para recortar imagen según bounding box ===
export const cropImageFromBbox = async (
  imageUrl,
  bboxInput,
  maxWidthPx = 800,
  quality = 0.8,
) => {
  try {
    const img = await loadImageElement(imageUrl);

    const originalWidth = img.naturalWidth;
    const originalHeight = img.naturalHeight;

    let [nx, ny, nw, nh] = bboxInput;

    // Auto-detect: si los valores son > 2, asumimos que son píxeles
    if (nx > 2 || ny > 2 || nw > 2 || nh > 2) {
      nx = nx / originalWidth;
      ny = ny / originalHeight;
      nw = nw / originalWidth;
      nh = nh / originalHeight;
    }

    // Sanity check/clamping
    if (nx > 1.5 || ny > 1.5) {
      if (nx > 1) nx = 0;
      if (ny > 1) ny = 0;
      if (nw > 1) nw = 0.2;
      if (nh > 1) nh = 0.2;
    }

    let cropX = Math.round(nx * originalWidth);
    let cropY = Math.round(ny * originalHeight);
    let cropW = Math.round(nw * originalWidth);
    let cropH = Math.round(nh * originalHeight);

    // Clamping agresivo
    cropX = Math.max(0, Math.min(cropX, originalWidth - 1));
    cropY = Math.max(0, Math.min(cropY, originalHeight - 1));

    if (cropX + cropW > originalWidth) cropW = originalWidth - cropX;
    if (cropY + cropH > originalHeight) cropH = originalHeight - cropY;

    if (cropW <= 0) cropW = Math.min(100, originalWidth - cropX);
    if (cropH <= 0) cropH = Math.min(100, originalHeight - cropY);

    if (cropW <= 0 || cropH <= 0) return null;

    const scale = Math.min(1, maxWidthPx / Math.max(cropW, cropH));
    const targetWidth = Math.max(1, Math.round(cropW * scale));
    const targetHeight = Math.max(1, Math.round(cropH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(
      img,
      cropX,
      cropY,
      cropW,
      cropH,
      0,
      0,
      targetWidth,
      targetHeight,
    );

    // MODIFICACIÓN: Devolver objeto con dataURL y aspectRatio
    return {
      dataUrl: canvas.toDataURL("image/jpeg", quality),
      aspectRatio: cropW / cropH
    };
  } catch (err) {
    console.warn("[CROP] Error recortando imagen:", err);
    return null;
  }
};
