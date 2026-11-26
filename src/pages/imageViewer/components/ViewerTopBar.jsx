import React from "react";
import { tx } from "@/i18n/tx";
import { ZoomOut, ZoomIn, RotateCcw, Plus, Sun, Contrast as ContrastIcon, Loader2, Download } from "lucide-react";
import { ToolBtn } from "@/components/damageEditor/panels";
import { FOCUS_RING } from "@/lib/classes";

// Botón de icono de los controles de zoom (misma receta de tokens que el resto del visor)
const ICON_BTN = `rounded p-1.5 transition-colors hover:bg-line-medium ${FOCUS_RING}`;
const FIELD_LABEL = "text-[10px] text-ink-muted";
const SLIDER = "h-1 cursor-pointer appearance-none rounded-lg bg-line-medium accent-brand";

export const ViewerTopBar = ({ t, toast, userRole, setEditingDetection, setNewDetection, isCreatingDetection, setIsCreatingDetection, zoom, brightness, setBrightness, contrast, setContrast, negativeMode, setNegativeMode, showRuler, setShowRuler, isStitched, calibSaving, calibStep, setCalibStep, setCalibTipTemp, calibLength, setCalibLength, downloading, setDownloading, toolMode, setToolMode, polygons, setPolygons, currentImage, canCalibrate, savedCalib, stitchedRuler, startCalibration, commitCalibLength, clearCalibration, handleZoom, resetView }) => (
  <div className="flex items-center justify-between p-2 bg-surface-panel border-b border-line-medium shrink-0 z-50">
    <div className="flex items-center gap-4">
      <h2 className="text-sm font-semibold text-ink truncate max-w-[300px]">
         {currentImage.file_name || currentImage.name || t("imageViewer.image")}
      </h2>
    </div>

    {/* TOOLBAR */}
    <div className="flex items-center gap-4">
      {/* Zoom Controls */}
      <div className="flex items-center bg-surface-card rounded-lg p-1 text-ink">
        <button
          onClick={() => handleZoom(-0.2)}
          className={ICON_BTN}
        >
          <ZoomOut size={16} />
        </button>
        <span className="text-xs px-2 w-[50px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => handleZoom(0.2)}
          className={ICON_BTN}
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={resetView}
          className={`${ICON_BTN} ml-1 border-l border-line-medium`}
          title={t("imageViewer.resetView")}
        >
          <RotateCcw size={16} />
        </button>
      </div>


      {/* Add Damage Button (Admin Only) */}
      {(userRole === "admin" || userRole === "dev") && !isStitched && (
        <ToolBtn
           tone={isCreatingDetection ? "success" : "info"}
           icon={<Plus size={14} />}
           onClick={() => {
               // Switch to Area tool for drawing
               setToolMode("area");
               setIsCreatingDetection(true);
               setNewDetection(null);
               setEditingDetection(null);
               setPolygons([]); // Clear existing
               toast({
                   title: t("imageViewer.creationMode"),
                   description: t("imageViewer.drawPolygonInstructions")
               });
           }}
        >
          {isCreatingDetection ? t("imageViewer.drawing") : t("imageViewer.addDamage")}
        </ToolBtn>
      )}

      {/* Effect Controls */}
      <div className="flex items-center gap-2 border-l border-line-medium pl-2">
        {/* Brightness/Contrast Sliders */}
        <div className="flex flex-col w-24 mr-2">
          <label className={`${FIELD_LABEL} flex justify-between`}>
            {t("imageViewer.brightness")} <span>{brightness}%</span>
          </label>
          <input
            type="range"
            min="50"
            max="150"
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            className={SLIDER}
          />
        </div>
        <div className="flex flex-col w-24 mr-2">
          <label className={`${FIELD_LABEL} flex justify-between`}>
            {t("imageViewer.contrast")} <span>{contrast}%</span>
          </label>
          <input
            type="range"
            min="50"
            max="150"
            value={contrast}
            onChange={(e) => setContrast(Number(e.target.value))}
            className={SLIDER}
          />
        </div>

        <ToolBtn
          tone={negativeMode ? "purple" : "default"}
          icon={<Sun size={16} />}
          onClick={() => setNegativeMode(!negativeMode)}
          title={t("imageViewer.invertColors")}
          aria-label={t("imageViewer.invertColors")}
          aria-pressed={negativeMode}
        />
        {!isStitched && (
          <>
        <ToolBtn
          tone={showRuler ? "active" : "default"}
          icon={<ContrastIcon size={14} />}
          onClick={() => setShowRuler(!showRuler)}
        >
          {t("imageViewer.ruler")}
        </ToolBtn>
        <ToolBtn
          tone={toolMode === "crosshair" ? "info" : "default"}
          icon={
            <div className="w-3 h-3 border border-current flex items-center justify-center text-[8px]">
              +
            </div>
          }
          onClick={() =>
            setToolMode(toolMode === "crosshair" ? "none" : "crosshair")
          }
        >
          {t("imageViewer.crosshair")}
        </ToolBtn>
        <ToolBtn
          tone={toolMode === "area" ? "purple" : "default"}
          icon={<div className="w-3 h-3 border border-dashed border-current bg-ink/20" />}
          onClick={() => setToolMode(toolMode === "area" ? "none" : "area")}
        >
          {t("imageViewer.area")}
        </ToolBtn>

          </>
        )}

        {/* Reset Measurements Button (Next to Area) */}
        {!isStitched && toolMode === "area" && polygons.length > 0 && (
          <ToolBtn
            tone="danger"
            onClick={() => setPolygons([])}
            className="animate-in fade-in slide-in-from-left-2"
          >
            {t("imageViewer.resetMeasurements")}
          </ToolBtn>
        )}
      </div>

      {/* Regla en stitched: todos ven la calibración guardada; solo admin/técnico la editan */}
      {isStitched && (canCalibrate || savedCalib) && (
        <div className="flex items-center gap-2 border-l border-line-medium pl-2">
          {canCalibrate && (
            <label className={`flex flex-col ${FIELD_LABEL}`}>
              {tx("Largo de pala (m)")}
              <input
                type="number"
                min="1"
                step="0.1"
                value={calibLength}
                onChange={(e) => setCalibLength(e.target.value)}
                onBlur={commitCalibLength}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                disabled={calibStep !== null || calibSaving}
                className="h-6 w-20 rounded border border-line-medium bg-surface-card !px-1.5 !py-0 text-xs text-ink"
              />
            </label>
          )}
          {canCalibrate &&
            (calibStep === null ? (
              <ToolBtn
                tone="active"
                onClick={startCalibration}
                disabled={calibSaving}
              >
                {calibSaving ? tx("Guardando...") : savedCalib ? tx("Recalibrar") : tx("Calibrar regla")}
              </ToolBtn>
            ) : (
              <>
                <span className="text-xs font-semibold text-brand">
                  {calibStep === "tip"
                    ? tx("1/2 · Clic en la PUNTA de la pala")
                    : tx("2/2 · Clic en la RAÍZ de la pala")}
                </span>
                <ToolBtn
                  onClick={() => {
                    setCalibStep(null);
                    setCalibTipTemp(null);
                  }}
                >
                  {tx("Cancelar")}
                </ToolBtn>
              </>
            ))}
          {savedCalib && calibStep === null && (
            <>
              <ToolBtn
                tone={showRuler ? "active" : "default"}
                icon={<ContrastIcon size={14} />}
                onClick={() => setShowRuler(!showRuler)}
              >
                {t("imageViewer.ruler")}
              </ToolBtn>
              {stitchedRuler && (
                <span className={FIELD_LABEL}>
                  {stitchedRuler.mmPerPx.toFixed(1)} mm/px
                </span>
              )}
              {canCalibrate && (
                <ToolBtn
                  onClick={clearCalibration}
                  disabled={calibSaving}
                >
                  {tx("Borrar")}
                </ToolBtn>
              )}
            </>
          )}
        </div>
      )}

      {/* Download */}
      <div className="relative">
        <ToolBtn
          tone="success"
          icon={downloading ? <Loader2 size={14} className="animate-spin text-ink" /> : <Download size={14} />}
          onClick={async () => {
            const url = currentImage?.src || currentImage?.url || currentImage?.signedUrl || currentImage?.publicUrl || currentImage?.file_path || currentImage?.path;
            if (!url) return;
            try {
              setDownloading(true);
              // We might need to handle CORS if the image is on another domain.
              // If fetch fails due to CORS, it falls back to window.open
              const response = await fetch(url);
              if (!response.ok) throw new Error("Network response was not ok");
              const blob = await response.blob();
              const blobUrl = window.URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = blobUrl;
              link.download = currentImage?.file_name || currentImage?.name || "image.jpg";
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              window.URL.revokeObjectURL(blobUrl);
            } catch (error) {
              console.error("Error downloading image:", error);
              // Fallback: just open the image in a new tab if fetch fails
              window.open(url, "_blank");
            } finally {
              setDownloading(false);
            }
          }}
          disabled={downloading}
        >
          {t("imageViewer.download")}
        </ToolBtn>
      </div>
    </div>
  </div>
);
