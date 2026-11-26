import React from "react";
import { tx } from "@/i18n/tx";
import { SEV, sevNumber, ICON_BTN, PANEL, OVERLINE, FOCUS } from "@/components/reportViewer/viewerKit";
import { RefreshCw } from "lucide-react";

export const BladeDetailSection = ({ t, selectedBlade, turbine, isRefreshing, handleManualRefresh, selectedSeverity, setSelectedSeverity, totalImages, selectedBladeImages, severityCountFor, selectedBladeDamageCount }) => (
  <section aria-labelledby="rv-detail-title" className={PANEL}>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-4 py-3 sm:px-5">
      <h3 id="rv-detail-title" className={OVERLINE}>
        Detalle · {selectedBlade}
      </h3>
      <button
        type="button"
        onClick={handleManualRefresh}
        disabled={isRefreshing}
        title={t("reportViewer.updateDamagesManually")}
        className={ICON_BTN}
      >
        <RefreshCw
          size={14}
          className={isRefreshing ? "animate-spin" : ""}
          aria-hidden="true"
        />
        {t("reportViewer.refresh")}
      </button>
    </div>

    <dl className="grid grid-cols-1 divide-line-subtle sm:grid-cols-3 sm:divide-x">
      <div className="p-4 sm:p-5">
        <dt className={OVERLINE}>{t("reportViewer.capturedImages")}</dt>
        <dd className="mt-1.5 text-3xl font-semibold tabular-nums text-ink">
          {selectedBladeImages}
        </dd>
        <p className="mt-0.5 text-xs text-ink-muted">
          {t("reportViewer.in")} {selectedBlade} · {t("reportViewer.totalTurbine")}: {totalImages}
        </p>
      </div>
      <div className="border-t border-line-subtle p-4 sm:border-t-0 sm:p-5">
        <dt className={OVERLINE}>{t("reportViewer.damagesDetected")}</dt>
        <dd className="mt-1.5 text-3xl font-semibold tabular-nums text-ink">
          {selectedBladeDamageCount}
        </dd>
        <p className="mt-0.5 text-xs text-ink-muted">
          {t("reportViewer.in")} {selectedBlade}
        </p>
      </div>
      <div className="border-t border-line-subtle p-4 sm:border-t-0 sm:p-5">
        <dt className={OVERLINE}>{t("reportViewer.lastUpdate")}</dt>
        <dd className="mt-1.5 text-xl font-semibold tabular-nums text-ink">
          {turbine.inspection_date
            ? new Date(turbine.inspection_date).toLocaleDateString("es-MX", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" })
            : "N/A"}
        </dd>
        <p className="mt-0.5 text-xs text-ink-muted">
          {t("reportViewer.inspectionDate")}
        </p>
      </div>
    </dl>

    {/* Distribución por severidad (filtro) */}
    <div className="border-t border-line-subtle px-4 py-3 sm:px-5">
      <p className={`${OVERLINE} mb-2`}>
        {t("reportViewer.severityDistribution")}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {["Cat 5", "Cat 4", "Cat 3", "Cat 2", "Cat 1"].map((severity) => {
          const count = severityCountFor(selectedBlade, severity);
          const isSelected = selectedSeverity === severity;
          const style = SEV[sevNumber(severity)];
          return count > 0 ? (
            <button
              key={severity}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelectedSeverity(isSelected ? null : severity)}
              title={
                isSelected
                  ? tx("Click para quitar filtro")
                  : tx("Click para filtrar solo {{severity}}", { severity })
              }
              className={`inline-flex items-center rounded-sm border px-2.5 py-1 text-xs font-semibold tabular-nums transition-all ${FOCUS} ${style.chip} ${
                                  isSelected ? "ring-2 ring-ink/60" : "hover:brightness-125"
                                }`}
            >
              {severity}: {count}
            </button>
          ) : null;
        })}
        {selectedSeverity && (
          <span className="inline-flex items-center gap-2 text-xs text-ink">
            Filtrado por: <strong className="text-ink">{selectedSeverity}</strong>
            <button
              type="button"
              onClick={() => setSelectedSeverity(null)}
              className="text-error-text underline hover:text-error-text"
            >
              Limpiar filtro
            </button>
          </span>
        )}
        {severityCountFor(selectedBlade, "Cat 1") +
          severityCountFor(selectedBlade, "Cat 2") +
          severityCountFor(selectedBlade, "Cat 3") +
          severityCountFor(selectedBlade, "Cat 4") +
          severityCountFor(selectedBlade, "Cat 5") ===
          0 && (
          <span className="text-xs text-ink-muted">{tx("Sin daños registrados")}</span>
        )}
      </div>
    </div>
  </section>
);
