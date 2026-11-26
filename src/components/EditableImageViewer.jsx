import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ZoomIn, ZoomOut, RotateCcw, X, Eye, EyeOff, Plus } from "lucide-react";
import { ToolBtn } from "./damageEditor/panels";
import VirtualBladeRuler from "./VirtualBladeRuler";
import DetectionEditModal from "./DetectionEditModal";
import { useExifData } from "@/hooks/useExifData";

const EditableImageViewer = ({
  isOpen,
  onClose,
  imageSrc,
  imageAlt,
  date,
  detections = [],
  onSaveDetection,
  onDeleteDetection,
  onUpdateDetection,
  translations = {},
  userRole = "client",
  // Legacy props (kept for now just in case, but unused for new ruler logic mostly)
  bladeLength,
  allImages = [],
  currentImage = null,
  damages = [],
  section = "",
  onImageClick = null,
}) => {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showLayers, setShowLayers] = useState(true);
  const [showRuler, setShowRuler] = useState(true); // New state for ruler toggle

  const [editingDetection, setEditingDetection] = useState(null);
  const [newDetection, setNewDetection] = useState(null);
  const [isCreatingDetection, setIsCreatingDetection] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);

  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  // Fetch EXIF data for the current image to power the ruler
  // Assuming imageSrc or currentImage has the ID or Path
  const { exifData } = useExifData(imageSrc, currentImage?.id);

  // ... (handleZoom, resetView, etc. - keep existing)
  const handleZoom = (delta) => {
    setZoom((prevZoom) => Math.max(0.1, Math.min(5, prevZoom + delta)));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const resetImage = () => {
    setBrightness(100);
    setContrast(100);
    resetView();
  };

  const applyImageFilters = () => {
    if (imageRef.current) {
      imageRef.current.style.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    }
  };

  const handleMouseDown = (e) => {
    // Only drag if clicking on container/canvas background, not buttons
    if (e.target === canvasRef.current || e.target === containerRef.current) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - pan.x,
        y: e.clientY - pan.y,
      });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // ... (drawDetections - keep existing)
  const drawDetections = () => {
    // ... (existing draw logic)
    const canvas = canvasRef.current;
    if (!canvas || !imageRef.current) return;

    const ctx = canvas.getContext("2d");
    const img = imageRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!showLayers) return;

    detections.forEach((detection, index) => {
      const { bbox, severity, confidence, category } = detection;
      const [x1, y1, x2, y2] = bbox;

      const colors = {
        "Cat 1": "#10B981",
        "Cat 2": "#84CC16",
        "Cat 3": "#F59E0B",
        "Cat 4": "#F97316",
        "Cat 5": "#EF4444",
      };

      const color = colors[severity] || "#6B7280";

      // Draw simple rect at natural coords
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * (1 / zoom); // Scale line width inverse to zoom so it stays constant-ish
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

      // ... label logic ...
    });
  };

  // 1. Bloquear el scroll de la página de fondo cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    
    // Limpieza al desmontar
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // 2. Convertir la rueda del mouse en Zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isOpen) return;

    const handleWheel = (e) => {
      e.preventDefault(); // Evita que la página intente hacer scroll

      // Si hace scroll hacia arriba (negativo), acerca. Si es hacia abajo, aleja.
      // Ajustamos la sensibilidad: 0.1 es suave, puedes subirlo a 0.2 si lo quieres más rápido
      const zoomDelta = e.deltaY < 0 ? 0.1 : -0.1;
      
      setZoom((prevZoom) => Math.max(0.1, Math.min(5, prevZoom + zoomDelta)));
    };

    // Usar { passive: false } es CRUCIAL en React para poder usar e.preventDefault() en la rueda
    container.addEventListener("wheel", handleWheel, { passive: false });
    
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [isOpen]);

  // 3. Reiniciar el zoom, posición y filtros cada vez que se abre una nueva imagen
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setBrightness(100);
      setContrast(100);
    }
  }, [isOpen, imageSrc]); // Se ejecuta al abrir el visor o al cambiar de foto

  useEffect(() => {
    applyImageFilters();
  }, [brightness, contrast]);

  // Manejador de clics en el canvas para evitar el colapso (crasheo)
  const handleCanvasClick = (e) => {
    if (userRole === "client" || !isCreatingDetection) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Calcular coordenadas reales considerando el zoom y la posición
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Aquí iría la lógica de dibujo si estás trazando un bounding box,
    // pero con esto evitamos el crasheo inmediato al hacer click en la foto.
    console.log("Clic en imagen (X, Y):", x, y);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-base/90 backdrop-blur-sm">
      <div className="relative w-[95vw] h-[95vh] bg-surface-card rounded-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-line-medium border-b border-line-medium shrink-0">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-ink">{imageAlt}</h3>
            {/* Si NO es una vista Stitched, mostramos las herramientas de edición */}
            {!(typeof imageAlt === 'string' && imageAlt.includes("Stitched")) && (
              <>
                <ToolBtn
                  onClick={() => setShowLayers(!showLayers)}
                  tone={showLayers ? "success" : "default"}
                  icon={showLayers ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                >
                  {showLayers ? t("imageViewer.hideLayers") : t("imageViewer.showLayers")}
                </ToolBtn>

                {/* Ruler Toggle */}
                <ToolBtn onClick={() => setShowRuler(!showRuler)} tone={showRuler ? "active" : "default"}>
                  📏 {t("imageViewer.ruler")}
                </ToolBtn>

                {/* Add Damage Button (Admin Only) */}
                {(userRole === "admin" || userRole === "dev") && (
                  <ToolBtn
                    tone="info"
                    icon={<Plus className="w-4 h-4" />}
                    onClick={() => {
                       if (!imageRef.current) return;
                       
                       const w = imageRef.current.naturalWidth || 1000;
                       const h = imageRef.current.naturalHeight || 1000;
                       const cx = w / 2;
                       const cy = h / 2;
                       const size = Math.min(w, h) * 0.1 || 100;

                       const newBox = {
                           bbox: [cx - size/2, cy - size/2, cx + size/2, cy + size/2],
                           severity: "Cat 3",
                           category: t("imageViewer.damage"),
                           confidence: 1.0,
                           manual: true,
                           isNew: true
                       };
                       
                       setEditingDetection(newBox);
                       setNewDetection(newBox); 
                       setIsCreatingDetection(true);
                    }}
                  >
                    {t("imageViewer.addDamage")}
                  </ToolBtn>
                )}
              </>
            )}
          </div>

          {/* Controls (Brightness, Zoom, etc) */}
          <div className="flex items-center gap-4">
            {/* ... (Brightness/Contrast sliders) ... */}
            <div className="flex items-center gap-2">
              {/* Zoom Buttons */}
              <button onClick={() => handleZoom(-0.1)}>
                <ZoomOut className="w-4 h-4 text-ink" />
              </button>
              <span className="text-ink text-sm w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button onClick={() => handleZoom(0.1)}>
                <ZoomIn className="w-4 h-4 text-ink" />
              </button>
              <button onClick={resetView}>
                <RotateCcw className="w-4 h-4 text-ink" />
              </button>
            </div>

            <button onClick={onClose}>
              <X className="w-5 h-5 text-ink" />
            </button>
          </div>
        </div>

        {/* REMOVED: BladeRuler (Legacy) */}
        {/* 
        {allImages && allImages.length > 0 && ( ... )}
        */}

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Image Viewer */}
          <div className="flex-1 relative overflow-hidden bg-surface-panel flex items-center justify-center">
            <div
              ref={containerRef}
              className="w-full h-full flex items-center justify-center cursor-move"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Transform Container - Scales the Image AND the Overlays together */}
              <div
                style={{
                  transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${
                    pan.y / zoom
                  }px)`,
                  transformOrigin: "center center",
                  position: "relative",
                  display: "inline-block", // Wrap content specifically
                }}
              >
                <img
                  ref={imageRef}
                  src={imageSrc}
                  alt={imageAlt}
                  className="max-w-none block" // Allow full size
                  onLoad={() => {
                    const canvas = canvasRef.current;
                    if (canvas && imageRef.current) {
                      canvas.width = imageRef.current.naturalWidth;
                      canvas.height = imageRef.current.naturalHeight;
                      drawDetections();
                    }
                  }}
                  draggable={false}
                />

                {/* Canvas for Detections (Same size as image, on top) */}
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 pointer-events-auto"
                  onClick={handleCanvasClick}
                  // No transform here! It inherits from parent.
                  style={{ width: "100%", height: "100%" }}
                />

                {/* Virtual Ruler - On top of everything */}
                <VirtualBladeRuler
                  imageRef={imageRef}
                  zoom={zoom}
                  // Pass pre-calculated values from backend
                  pixelScale={currentImage?.raw_metadata?.Calculated_GSD_mm_px}
                  currentRadius={currentImage?.raw_metadata?.Calculated_Radius_m}
                  isTipAtTop={true} // Default Assumption: Top of Image = Tip (Highest Radius)
                  showRuler={showRuler}
                />
              </div>
            </div>
          </div>

          {/* Sidebar (Layers) - Oculto si es vista Stitched */}
          {!(typeof imageAlt === 'string' && imageAlt.includes("Stitched")) && (
            <div className="w-80 bg-line-medium border-l border-line-medium overflow-y-auto shrink-0">
              <div className="p-4">
                <h4 className="text-lg font-semibold text-ink mb-4">
                  {t("imageViewer.detections")}
                </h4>
                <div className="space-y-2">
                  {detections.map((detection, index) => (
                    <div
                      key={index}
                      className="p-3 bg-surface-card rounded mb-2 text-ink"
                    >
                      {detection.severity} - {detection.category}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modals */}
        {editingDetection && (
          <DetectionEditModal
            detection={editingDetection}
            onClose={() => {
                setEditingDetection(null);
                setIsCreatingDetection(false);
                setNewDetection(null);
            }}
            onSave={(updated) => {
                // If we are creating, we might need to handle it differently?
                // The parent (ReportViewerPage) via onSaveDetection usually expects an object.
                // If it's new, `updated` won't have an ID yet.
                // onSaveDetection in ReportViewerPage handles insert.
                if (isCreatingDetection) {
                    onSaveDetection(updated);
                } else {
                    onUpdateDetection(updated);
                }
                setEditingDetection(null);
                setIsCreatingDetection(false);
            }}
          />
        )}
      </div>
    </div>
  );
};


export default EditableImageViewer;

