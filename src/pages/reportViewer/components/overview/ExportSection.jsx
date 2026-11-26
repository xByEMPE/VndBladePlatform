import React from "react";
import { BTN_PRIMARY } from "@/components/reportViewer/viewerKit";
import { Loader, Download } from "lucide-react";

export const ExportSection = ({ t, isAdmin, selectedDamages, clearAllDamageSelection, handleExportClick, isGeneratingPDF }) => (
  <section
    aria-label={t("reportViewer.exportPdf")}
    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line-subtle bg-surface-card/40 px-4 py-3"
  >
    <div className="min-w-0">
      <p className="text-sm font-medium text-ink">
        {t("reportViewer.exportPdf")}
      </p>
      {isAdmin && (
        <p className="text-xs text-ink-muted">
          {selectedDamages.size > 0
            ? t("reportViewer.exportSelectedOnly", { count: selectedDamages.size, defaultValue: `Se exportarán solo ${selectedDamages.size} daños seleccionados` })
            : t("reportViewer.noSelectionAllPdf", { defaultValue: "Sin selección — el PDF incluirá todos los daños" })}
        </p>
      )}
    </div>
    <div className="flex flex-wrap items-center gap-3">
      {isAdmin && selectedDamages.size > 0 && (
        <button
          type="button"
          onClick={clearAllDamageSelection}
          className="text-xs font-medium text-error-text underline hover:text-error-text"
        >
          {t("reportViewer.clearSelection", { defaultValue: "Limpiar selección" })}
        </button>
      )}
      <button
        type="button"
        onClick={handleExportClick}
        disabled={isGeneratingPDF}
        className={BTN_PRIMARY}
      >
        {isGeneratingPDF ? (
          <>
            <Loader size={16} className="animate-spin text-ink" aria-hidden="true" />
            {t("reportViewer.generatingPdf", { defaultValue: "Generando PDF..." })}
          </>
        ) : (
          <>
            <Download size={16} aria-hidden="true" />
            {t("reportViewer.exportPdf")}
            {isAdmin && selectedDamages.size > 0 && (
              <span className="rounded-sm bg-surface-panel/20 px-1.5 py-0.5 text-xs font-bold">
                {selectedDamages.size} {t("reportViewer.selected", { defaultValue: "seleccionados" })}
              </span>
            )}
          </>
        )}
      </button>
    </div>
  </section>
);
