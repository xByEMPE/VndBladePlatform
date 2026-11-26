import React from "react";
import BladeInspectionViewer from "@/components/BladeInspectionViewer";
import { ChevronRight, ChevronLeft } from "lucide-react";

export const ViewerCanvas = ({ t, setEditingDetection, newDetection, setNewDetection, isCreatingDetection, imageDimensions, setImageDimensions, zoom, setZoom, pan, setPan, showRuler, isStitched, calibStep, isSidebarOpen, setIsSidebarOpen, setSidebarHover, toolMode, setToolMode, polygons, setPolygons, currentImage, masterGSD_mm_px, globalStartMeters, calibration, stitchedRuler, handleCalibrationClick, calibMarkers, handleImageLoaded, filterStyle }) => (
  <div className="flex-1 overflow-hidden relative flex flex-col">
     <BladeInspectionViewer
        imageUrl={
          currentImage.src ||
          currentImage.url ||
          currentImage.signedUrl ||
          currentImage.publicUrl ||
          currentImage.file_path ||
          currentImage.path
        }
        zoom={zoom}
        setZoom={setZoom}
        pan={pan}
        setPan={setPan}
        pixelScale={stitchedRuler ? stitchedRuler.mmPerPx : masterGSD_mm_px}
        localPixelScale={
          currentImage?.raw_metadata?.Calculated_GSD_mm_px || null
        }
        bladeRadius={currentImage?.raw_metadata?.Calculated_Blade_Radius_mm}
        globalStartMeters={stitchedRuler ? stitchedRuler.startMeters : globalStartMeters}
        isRootToTip={stitchedRuler ? stitchedRuler.isRootToTip : false}
        isTipAtTop={true} /* <-- LÍNEA CLAVE PARA FORZAR EL DESCENSO VISUAL */
        rotation={calibration?.rotation || 0}
        showRuler={isStitched ? !!stitchedRuler && showRuler && calibStep === null : showRuler}
        toolMode={calibStep ? "calibrate" : toolMode}
        onCalibrationClick={handleCalibrationClick}
        markers={isStitched ? calibMarkers : []}
        onDebug={() =>
          console.log(
            "[ImageViewer] Ruler PixelScale passed:",
            currentImage?.raw_metadata?.Calculated_GSD_mm_px
          )
        }
        filterStyle={filterStyle}
        onImageLoad={(dims) => {
          handleImageLoaded(dims);
          if (dims) setImageDimensions({ width: dims.width, height: dims.height });
        }}
      polygons={polygons}
      onPolygonsChange={(newPolys) => {
          setPolygons(newPolys);

          // Check if a complete polygon (4 points) matches creation mode
          if (isCreatingDetection && newPolys.length > 0) {
              const lastPoly = newPolys[newPolys.length - 1];

              if (lastPoly.length === 4) { // Only finish if 4 points are drawn
                  // Calculate bounding box from polygon
                  const xs = lastPoly.map(p => p.x);
                  const ys = lastPoly.map(p => p.y);
                  const minX = Math.min(...xs);
                  const maxX = Math.max(...xs);
                  const minY = Math.min(...ys);
                  const maxY = Math.max(...ys);

                  // Calculate metrics
                  const widthPx = maxX - minX;
                  const heightPx = maxY - minY;

                  // Get scale (mm/px)
                  const scale = currentImage?.raw_metadata?.Calculated_GSD_mm_px || masterGSD_mm_px || 1.0;

                  const widthMm = widthPx * scale;
                  const heightMm = heightPx * scale;
                  const areaPx = (widthPx * heightPx); // Simplified for bbox
                  const areaMm = areaPx * (scale * scale);

                  // Radius Calculation (Distance from Root)
                  // This logic is simplified, could be improved with real calibration
                  const imageCenterY = imageDimensions.height / 2;
                  const boxCenterY = minY + (heightPx / 2);
                  const diffY = boxCenterY - imageCenterY; // Pixels from center
                  const diffMm = diffY * scale;

                  const baseRadius = currentImage?.raw_metadata?.Calculated_Blade_Radius_mm || (currentImage?.blade_height_meters * 1000) || 0;

                  let radius = baseRadius + diffMm; 
                  if (radius < 0) radius = 0; // Clamp to 0

                  const newBox = {
                      bbox: [minX, minY, maxX, maxY], // x1, y1, x2, y2
                      severity: "Cat 3",
                      category: t("imageViewer.damage"),
                      damage_type: "Otro",
                      description: "",
                      confidence: 1.0,
                      manual: true,
                      isNew: true,
                      width: widthMm,
                      length: heightMm,
                      area: areaMm,
                      radius: radius,
                      width_mm: widthMm,
                      length_mm: heightMm,
                      radius_mm: radius
                  };

                  setNewDetection(newBox);
                  setEditingDetection(newBox);
                  setToolMode("none"); // Stop drawing
              }
          }
      }}
      detections={newDetection ? [newDetection] : []}
      />

      {/* Sidebar Toggle Button (Inside Viewer Area, Right Side) */}
      <div 
      className="absolute right-0 top-1/2 transform -translate-y-1/2 z-40 pointer-events-none flex items-center justify-end h-full w-8"
      >
      <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          onMouseEnter={() => setSidebarHover(true)}
          onMouseLeave={() => setSidebarHover(false)}
          className={`
                    pointer-events-auto
                    h-16 w-6 bg-surface-card border-y border-l border-line-medium rounded-l-lg 
                    flex items-center justify-center text-ink-muted hover:text-ink hover:bg-line-medium
                    shadow-lg transition-all duration-300
                    ${isSidebarOpen ? "bg-surface-card" : "opacity-50 hover:opacity-100"}
                `}
          title={isSidebarOpen ? t("common.hideSidebar") : t("common.showSidebar")}
      >
          {isSidebarOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
      </div>
  </div>
);
