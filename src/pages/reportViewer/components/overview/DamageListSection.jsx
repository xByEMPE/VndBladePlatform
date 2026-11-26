import React from "react";
import { ICON_BTN, PANEL, OVERLINE, INPUT } from "@/components/reportViewer/viewerKit";
import { sortDamagesBySeverity } from "../../../shared/damage";
import { Loader, AlertCircle } from "lucide-react";
import { DamageCard } from "./DamageCard";

export const DamageListSection = ({ t, i18n, isClient, isAdmin, selectedBlade, sectionAliases, damages, damageImages, savingAlias, getSectionLabel, updateSectionAlias, loadingDamages, severityFilter, setSeverityFilter, selectedSeverity, selectedDamages, toggleDamageSelection, selectAllBladeDamages, clearBladeDamageSelection, openImageInNewWindow, editingDamage, editingFields, deletingDamages, setEditingDamage, updateDamageField, saveDamageChanges, handleDeleteDamage, selectedBladeDamageCount }) => (
  <div
    role="region"
    aria-labelledby="rv-damages-title"
    className={PANEL}
  >
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-4 py-3 sm:px-5">
      <h3 id="rv-damages-title" className={OVERLINE}>
        {t("reportViewer.damagesRegistered")} {selectedBlade}
        <span className="ml-2 tabular-nums text-ink-muted">
          ({selectedBladeDamageCount})
        </span>
      </h3>

      {/* Orden por severidad */}
      <label className="flex items-center gap-2 text-sm text-ink">
        <span>{t("reportViewer.sortBy")}</span>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className={`${INPUT} !h-9 !w-auto sm:!h-9`}
        >
          <option value="desc">
            {t("reportViewer.severityGravesFirst")}
          </option>
          <option value="asc">
            {t("reportViewer.severityLevesFirst")}
          </option>
          <option value="all">
            {t("reportViewer.noSorting")}
          </option>
        </select>
      </label>
    </div>

    {/* Controles de selección para PDF - Solo para Admins */}
    {isAdmin && (
      <div className="flex flex-wrap items-center gap-2 border-b border-line-subtle bg-surface-card/40 px-4 py-2.5 sm:px-5">
        <span className="text-xs font-medium text-ink">
          {t("reportViewer.pdfSelection", { defaultValue: "Selección para PDF:" })}
        </span>
        <button
          type="button"
          onClick={() => selectAllBladeDamages(selectedBlade)}
          className={ICON_BTN}
        >
          {t("reportViewer.selectAll", { defaultValue: "Seleccionar todos" })} ({selectedBladeDamageCount})
        </button>
        <button
          type="button"
          onClick={() => clearBladeDamageSelection(selectedBlade)}
          className={ICON_BTN}
        >
          {t("reportViewer.removeSelection", { defaultValue: "Quitar selección" })}
        </button>
        {(() => {
          const bladeSelected = damages.filter(
            (d) =>
              d.blade === selectedBlade &&
              selectedDamages.has(d.id),
          ).length;
          return bladeSelected > 0 ? (
            <span className="ml-auto text-xs font-semibold text-brand">
              {bladeSelected} {t("reportViewer.of", { defaultValue: "de" })} {selectedBladeDamageCount}{" "}
              {t("reportViewer.selected", { defaultValue: "seleccionados" })}
            </span>
          ) : (
            <span className="ml-auto text-xs text-ink-muted">
              {t("reportViewer.noSelectionInBlade", { defaultValue: "Sin selección en esta pala" })}
            </span>
          );
        })()}
      </div>
    )}

    {loadingDamages ? (
      <div className="flex items-center justify-center py-12">
        <Loader size={22} className="mr-2 animate-spin text-ink" aria-hidden="true" />
        <span className="text-sm text-ink-muted">
          {t("reportViewer.loadingDamages")}
        </span>
      </div>
    ) : selectedBladeDamageCount === 0 ? (
      <div className="flex flex-col items-center justify-center py-12 text-center text-ink-muted">
        <AlertCircle size={28} className="mb-2 opacity-60" aria-hidden="true" />
        <p className="text-sm">
          {t("reportViewer.noDamagesRegistered")} {selectedBlade}
        </p>
      </div>
    ) : (
      <div className="space-y-4 p-4 sm:p-5">
        {sortDamagesBySeverity(
          damages.filter((d) => {
            const bladeMatch = d.blade === selectedBlade;

            // Normalizar comparación de severidad
            const severityMatch = selectedSeverity
              ? (() => {
                  const damageSev = d.severity || "";
                  const damageSevNorm = damageSev
                    .replace(/Cat\s*/i, "")
                    .trim();
                  const selectedSevNorm =
                    selectedSeverity.replace("Cat ", "");

                  // Comparar: "2" === "2" o "Cat 2" === "Cat 2"
                  return (
                    damageSevNorm === selectedSevNorm ||
                    damageSev === selectedSeverity
                  );
                })()
              : true;

            return bladeMatch && severityMatch;
          }),
          severityFilter,
        ).map((damage) => (
          <DamageCard
            key={damage.id}
            damage={damage}
            t={t}
            i18n={i18n}
            isClient={isClient}
            isAdmin={isAdmin}
            selectedBlade={selectedBlade}
            sectionAliases={sectionAliases}
            damageImages={damageImages}
            savingAlias={savingAlias}
            getSectionLabel={getSectionLabel}
            updateSectionAlias={updateSectionAlias}
            selectedDamages={selectedDamages}
            toggleDamageSelection={toggleDamageSelection}
            openImageInNewWindow={openImageInNewWindow}
            editingDamage={editingDamage}
            editingFields={editingFields}
            deletingDamages={deletingDamages}
            setEditingDamage={setEditingDamage}
            updateDamageField={updateDamageField}
            saveDamageChanges={saveDamageChanges}
            handleDeleteDamage={handleDeleteDamage}
          />
        ))}
      </div>
    )}
  </div>
);
