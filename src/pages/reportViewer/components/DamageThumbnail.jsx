import React, { useRef, useState, useCallback } from "react";
import { tx } from "@/i18n/tx";
import { getImageUrl } from "@/lib/storageUrls";
import OptimizedImage from "@/components/OptimizedImage";
import { DamageBBoxOverlay } from "@/components/reportViewer/viewerKit";
import { getDamageBboxData, getDamageExtraData } from "../../shared/damage";
import { getThumbnailUrl } from "../../shared/image";

// === CORRECCIÓN: Componente Thumbnail Reactivo (SIN BBOX VISUAL) ===
export const DamageThumbnail = ({
  damage,
  imageInfo,
  damageImageFile,
  supabase,
  openImageInNewWindow,
  t,
}) => {
  // Miniatura con el recuadro del daño (DamageBBoxOverlay). Para quitar el recuadro,
  // basta con eliminar <DamageBBoxOverlay /> de más abajo.
  const wrapRef = useRef(null);
  const [naturalSize, setNaturalSize] = useState(null);
  const bboxData = getDamageBboxData(damage);

  // Estable a propósito: OptimizedImage vuelve a cargar si cambia el handler onLoad
  const handleImageLoad = useCallback(() => {
    const img = wrapRef.current?.querySelector("img");
    if (!img || !img.naturalWidth) return;
    setNaturalSize((prev) =>
      prev && prev.w === img.naturalWidth && prev.h === img.naturalHeight
        ? prev
        : { w: img.naturalWidth, h: img.naturalHeight },
    );
  }, []);

  const originalUrl = imageInfo
    ? getImageUrl(imageInfo.originalPath)
    : "";
  const thumbnailUrl = imageInfo ? getThumbnailUrl(imageInfo.originalPath) : "";

  return (
    <div
      ref={wrapRef}
      className="w-56 h-56 bg-surface-panel rounded-lg overflow-hidden relative group"
    >
      {originalUrl ? (
        <>
          <OptimizedImage
            src={originalUrl}
            thumbnailSrc={thumbnailUrl}
            alt={tx("Daño detectado en {{section}}", { section: damage.section })}
            className="w-full h-full object-contain cursor-pointer hover:opacity-80 transition-opacity"
            onLoad={handleImageLoad}
            onClick={() => {
              const imageFile = damageImageFile || {
                name: imageInfo.imageName || `damage_${damage.id}.jpg`,
                path: imageInfo.originalPath,
                inspection_file_id: imageInfo.inspection_file_id,
              };
              // Get latest bbox data from prop
              const bboxData = getDamageBboxData(damage);

              const extraData = getDamageExtraData(damage);

              openImageInNewWindow(imageFile, damage.section, damage.blade, {
                damageId: damage.id,
                bbox_xywh_norm: bboxData?.bbox_xywh_norm || null,
                category: damage.severity || "Cat 3",
                // PASS METRICS TO PREVENT NULL RESET
                radio: extraData.radius_mm ? extraData.radius_mm / 1000 : 0,
                length: extraData.length_mm,
                width: extraData.width_mm,
                area: extraData.area,
                damage_type: extraData.damage_type,
              });
            }}
          />
          <DamageBBoxOverlay
            bbox={bboxData?.bbox_xywh_norm}
            naturalSize={naturalSize}
            severity={damage.severity}
          />
        </>
      ) : (
        <div className="flex items-center justify-center h-full text-ink-muted text-xs">
          No Image
        </div>
      )}
    </div>
  );
};
