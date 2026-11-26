import React from "react";
import { tx } from "@/i18n/tx";
import { ToolGroup, ToolBtn, ToolSlider } from "@/components/damageEditor/panels";
import { Contrast as ContrastIcon, Crosshair, Maximize, Sun, ZoomOut, RotateCcw, ZoomIn } from "lucide-react";

export const EditorToolbar = ({ t, zoom, editingDetection, setEditingDetection, brightness, setBrightness, contrast, setContrast, detections, negativeMode, setNegativeMode, isCreating, setIsCreating, showMeasurementRulers, setShowMeasurementRulers, toolMode, setToolMode, setPolygons, fitScale, canEdit, selectedDamageId, handleZoom, resetImage, handleDeleteDetection, handleSaveDetection }) => (
  <div className="flex items-center gap-2 overflow-x-auto border-t border-line-subtle px-3 py-2 [scrollbar-width:none] sm:px-4 [&::-webkit-scrollbar]:hidden">
    {/* Edición - Para admin y technician */}
    {canEdit && (
      <ToolGroup label={t("common.editMode", { defaultValue: "Edición" }).replace(/:$/, "")}>
        {/* Botón Nuevo Daño */}
        <ToolBtn
          tone={isCreating ? "success" : "default"}
          title={tx("Añadir nuevo daño")}
          onClick={() => {
             if (isCreating) {
                 setIsCreating(false);
             } else {
                 setIsCreating(true);
                 setEditingDetection(null); // Deselect others
             }
          }}
          icon={<span className="text-sm font-bold leading-none">+</span>}
        >
          {isCreating ? t("messages.loading", { defaultValue: "Creando..." }) : t("buttons.new", { defaultValue: "Nuevo" })}
        </ToolBtn>

        <ToolBtn
          tone={editingDetection ? "danger" : "info"}
          onClick={() => {
            if (editingDetection) {
              setEditingDetection(null);
            } else if (detections.length > 0) {
              setEditingDetection(
                detections.find((d) => String(d.id) === String(selectedDamageId)) || detections[0]
              );
            }
          }}
        >
          {editingDetection ? t("buttons.cancel", { defaultValue: "Cancelar" }) : t("buttons.edit", { defaultValue: "Editar" })}
        </ToolBtn>
        <ToolBtn
          tone="success"
          onClick={() => {
              if (editingDetection) handleSaveDetection(editingDetection);
          }}
          disabled={!editingDetection}
        >
          {t("buttons.save", { defaultValue: "Guardar" })}
        </ToolBtn>
        <ToolBtn
          tone="danger"
          onClick={() => handleDeleteDetection(editingDetection?.id)}
          disabled={!editingDetection || !editingDetection.id}
        >
          {t("buttons.deleteDelineation", { defaultValue: "Eliminar Marcación" })}
        </ToolBtn>
      </ToolGroup>
    )}

    {/* Herramientas de medición */}
    <ToolGroup label={tx("Medición")}>
      {/* Botón Reglas de Medición */}
      <ToolBtn
        tone={showMeasurementRulers ? "active" : "default"}
        title={tx("Mostrar/Ocultar reglas de medición")}
        onClick={() => setShowMeasurementRulers((v) => !v)}
        icon={<ContrastIcon className="h-3.5 w-3.5" />}
      >
        {showMeasurementRulers ? t("common.hideRulers", { defaultValue: "Ocultar Reglas" }) : t("common.showRulers", { defaultValue: "Mostrar Reglas" })}
      </ToolBtn>

      {/* Botón Crosshair */}
      <ToolBtn
        tone={toolMode === "crosshair" ? "info" : "default"}
        title={tx("Herramienta Crosshair")}
        onClick={() => {
          setToolMode(toolMode === "crosshair" ? "none" : "crosshair");
        }}
        icon={<Crosshair className="h-3.5 w-3.5" />}
      >
        {t("common.crosshair", { defaultValue: "Crosshair" })}
      </ToolBtn>

      {/* Botón Area (Polygon) */}
      <ToolBtn
        tone={toolMode === "area" ? "info" : "default"}
        title={tx("Herramienta de Área (Dibujar Polígono)")}
        onClick={() => {
          setToolMode(toolMode === "area" ? "none" : "area");
          if (toolMode === "area") {
            setPolygons([]); // Reset polygons when toggling off
          }
        }}
        icon={<Maximize className="h-3.5 w-3.5" />}
      >
        {t("common.drawArea", { defaultValue: "Área (Dibujar)" })}
      </ToolBtn>
    </ToolGroup>

    {/* Imagen */}
    <ToolGroup label={tx("Imagen")}>
      {/* Botón Imagen Negativa */}
      <ToolBtn
        tone={negativeMode ? "purple" : "default"}
        title={tx("Alternar vista en negativo")}
        onClick={() => setNegativeMode((v) => !v)}
        icon={<Sun className="h-3.5 w-3.5" />}
      >
        {negativeMode ? t("common.normal", { defaultValue: "Normal" }) : t("common.negative", { defaultValue: "Negativo" })}
      </ToolBtn>
      <ToolSlider
        label={t("common.brightness", { defaultValue: "Brillo" })}
        value={brightness}
        onChange={(e) => setBrightness(parseInt(e.target.value))}
      />
      <ToolSlider
        label={t("common.contrast", { defaultValue: "Contraste" })}
        value={contrast}
        onChange={(e) => setContrast(parseInt(e.target.value))}
      />
    </ToolGroup>

    {/* Zoom */}
    <ToolGroup label="Zoom">
      <ToolBtn title="Zoom Out" aria-label="Zoom Out" onClick={() => handleZoom(-0.1)} icon={<ZoomOut className="h-3.5 w-3.5" />} />
      <ToolBtn title="Reset View" aria-label="Reset View" onClick={resetImage} icon={<RotateCcw className="h-3.5 w-3.5" />} />
      <span className="w-10 text-center text-xs tabular-nums text-ink">
        {((zoom / (fitScale || 1)) * 100).toFixed(0)}%
      </span>
      <ToolBtn title="Zoom In" aria-label="Zoom In" onClick={() => handleZoom(0.1)} icon={<ZoomIn className="h-3.5 w-3.5" />} />
    </ToolGroup>
  </div>
);
