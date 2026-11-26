import React from "react";
import { tx } from "@/i18n/tx";
import { FOCUS } from "@/components/reportViewer/viewerKit";
import Overline from "@/components/ui/Overline";
import { downloadNegativePng, downloadWithWatermark } from "../utils/downloads";
import { Crosshair, Loader2, Download, ChevronDown, Menu } from "lucide-react";

// Botón Descargar (verde): misma receta que los rojos y los amarillos (fondo tenue + texto y borde verdes;
// el fondo sube al hover). Es el mismo tono que "success" de las herramientas.
const DOWNLOAD_BTN = `inline-flex h-8 items-center gap-1.5 rounded-md border border-status-done/40 bg-status-done/10 px-2.5 text-xs font-medium text-status-done transition-colors hover:bg-status-done/25 disabled:opacity-50 ${FOCUS}`;

// Cabecera del editor: solo acciones y estado de edición (el rol vive en el Header superior).
export const EditorHeader = ({ t, editingDetection, damageInfo, detections, downloading, setDownloading, showDownloadMenu, setShowDownloadMenu, isSidebarOpen, setIsSidebarOpen, imageSrc, imageAlt, navigationData, currentImage, section, project, getSectionLabel }) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 sm:px-4">
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="min-w-0">
        {/* Icono en línea con el sobretítulo técnico (celeste) */}
        <Overline as="p" className="flex items-center gap-1.5 text-info">
          <Crosshair className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{navigationData.projectName || tx("Parque")}</span>
        </Overline>
        <h1 className="truncate text-sm font-semibold text-ink sm:text-base">
          {navigationData.wtg || "WTG"} · {navigationData.blade || "Pala"} · {getSectionLabel(section)}
        </h1>
      </div>
    </div>

    <div className="flex items-center gap-2">
      {editingDetection && (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-brand/40 bg-brand/10 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand">
          <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-brand" />
          Editando
        </span>
      )}

      {/* Menú de descarga */}
      <div className="relative">
          <button
            onClick={() => setShowDownloadMenu(!showDownloadMenu)}
            disabled={downloading}
            className={DOWNLOAD_BTN}
          >
            {downloading ? (
              <Loader2 className="w-3 h-3 animate-spin text-ink" />
            ) : (
              <Download className="w-3 h-3" />
            )}
            {t("buttons.download", { defaultValue: "Descargar" })}
            <ChevronDown className="w-3 h-3" />
          </button>
          {showDownloadMenu && (
            <div className="absolute right-0 top-full z-50 mt-1 min-w-[220px] rounded-md border border-line-subtle bg-surface-panel py-1 shadow-xl">
              <button
                onClick={async () => {
                  setShowDownloadMenu(false);
                  setDownloading(true);
                  try {
                    // Obtener la imagen como blob para forzar la descarga
                    const res = await fetch(imageSrc, { mode: "cors" });
                    if (!res.ok)
                      throw new Error(
                        tx("No se pudo descargar la imagen ({{status}})", { status: res.status })
                      );
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = imageAlt || "imagen-limpia";
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  } catch (e) {
                    console.error(e);
                    alert(
                      tx("No se pudo descargar la imagen. Probable bloqueo CORS.")
                    );
                  } finally {
                    setDownloading(false);
                  }
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-ink hover:bg-line-subtle"
              >
                <Download className="w-3 h-3" />
                {t("imageViewer.cleanImage", { defaultValue: "Imagen Limpia (Original)" })}
              </button>
              <button
                onClick={async () => {
                  setShowDownloadMenu(false);
                  setDownloading(true);
                  try {
                    // Enriquecer navigationData con wind_farm si no existe
                    const enrichedNavData = {
                      ...navigationData,
                      windFarm: project?.wind_farm || navigationData?.windFarm || navigationData?.wind_farm || currentImage?.wind_farm || "N/A",
                      wtg: navigationData?.wtg || currentImage?.turbine_name || "N/A",
                      blade: navigationData?.blade || currentImage?.blade || "N/A",
                      section: getSectionLabel(damageInfo?.section || navigationData?.section || section) || "N/A",
                    };

                    // Usar editingDetection o el primer detection disponible
                    const detectionToUse = editingDetection || (detections.length > 0 ? detections[0] : null);

                    await downloadWithWatermark(
                      imageSrc,
                      damageInfo,
                      enrichedNavData,
                      `${imageAlt || "imagen"}-watermark.png`,
                      detectionToUse
                    );
                  } catch (e) {
                    console.error(e);
                    alert(
                      tx("No se pudo descargar con marca de agua. Probable bloqueo CORS.")
                    );
                  } finally {
                    setDownloading(false);
                  }
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-ink hover:bg-line-subtle"
              >
                <Download className="w-3 h-3" />
                {t("imageViewer.watermarkImage", { defaultValue: "Con Marca de Agua" })}
              </button>
              <button
                onClick={async () => {
                  setShowDownloadMenu(false);
                  setDownloading(true);
                  try {
                    await downloadNegativePng(
                      imageSrc,
                      `${imageAlt || "imagen"}-negativo.png`
                    );
                  } catch (e) {
                    console.error(e);
                    alert(
                      tx("No se pudo descargar en negativo. Probable bloqueo CORS.")
                    );
                  } finally {
                    setDownloading(false);
                  }
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-ink hover:bg-line-subtle"
              >
                <Download className="w-3 h-3" />
                {t("imageViewer.negativeImage", { defaultValue: "Imagen en Negativo" })}
              </button>
            </div>
          )}
        </div>

      <button
        type="button"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        aria-label={isSidebarOpen ? t("common.hideSidebar") : t("common.showSidebar")}
        aria-expanded={isSidebarOpen}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-line-subtle bg-surface-card text-ink hover:border-line-medium lg:hidden ${FOCUS}`}
      >
        <Menu className="h-4 w-4" />
      </button>
    </div>
  </div>
);
