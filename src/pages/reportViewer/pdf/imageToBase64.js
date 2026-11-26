import { loadImageElement } from "../../shared/image";

  // === Función auxiliar para convertir imagen a base64 ===
export const imageToBase64 = async (imageUrl, maxWidthPx = 1200, quality = 0.7) => {
    try {
      const response = await fetch(imageUrl, { cache: "no-store" });
      if (!response.ok) return null;
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      // Usar Image() standard para consistencia con addBboxToImage
      const img = await loadImageElement(objectUrl);

      const originalWidth = img.naturalWidth;
      const originalHeight = img.naturalHeight;

      const scale = Math.min(
        1,
        maxWidthPx / Math.max(originalWidth, originalHeight),
      );
      const targetWidth = Math.max(1, Math.round(originalWidth * scale));
      const targetHeight = Math.max(1, Math.round(originalHeight * scale));

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      const dataURL = canvas.toDataURL("image/jpeg", quality);

      URL.revokeObjectURL(objectUrl); // Clean up
      return dataURL;
    } catch (err) {
      console.warn("[PDF] No se pudo preparar imagen, fallback simple:", err);
      return null;
    }
  };
