import React from "react";
import { SEV, sevNumber, OVERLINE } from "@/components/reportViewer/viewerKit";
import { DAMAGE_TYPES, getLocalizedDamageString } from "../../shared/damage";

export const DamageInfoPanel = ({ t, i18n, editingDetection, setEditingDetection, damageInfo, setDetections }) => (
  <div className="flex-shrink-0 border-b border-line-subtle p-3">
    <div
      className={`rounded-md border p-3 ${
                  editingDetection
                    ? "border-brand/40 bg-brand/[0.06]"
                    : "border-line-subtle bg-surface-card/40"
                }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className={OVERLINE}>
          {editingDetection ? t("common.editingDamage") : t("common.damageInfo")}
        </h3>
        {editingDetection && (
          <span className="rounded-sm bg-brand px-1.5 py-0.5 text-[10px] font-bold text-surface-base">
            ACTIVO
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
        {/* Severidad / categoría */}
        <div className="col-span-2">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            {t("common.categorySeverity")}
          </p>
          {editingDetection ? (
            <select
              value={editingDetection.severity && !editingDetection.severity.startsWith("Cat ") ? "Cat " + editingDetection.severity : editingDetection.severity || "Cat 1"}
              onChange={(e) => {
                  const newVal = e.target.value;

                  setEditingDetection(prev => ({
                      ...prev,
                      severity: newVal
                  }));

                  setDetections(prev => prev.map(d => d.id === editingDetection.id ? {
                      ...d,
                      severity: newVal
                  } : d));
              }}
              className="w-full rounded-md border border-line-subtle bg-surface-card !px-2 !py-1.5 text-xs text-ink outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/30"
            >
              {["Cat 1", "Cat 2", "Cat 3", "Cat 4", "Cat 5"].map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          ) : damageInfo.severity ? (
            <span
              className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-semibold ${
                          (SEV[sevNumber(damageInfo.severity)] || SEV[3]).chip
                        }`}
            >
              {damageInfo.severity.startsWith("Cat ") ? damageInfo.severity : `Cat ${damageInfo.severity}`}
            </span>
          ) : (
            <p className="text-xs font-medium text-ink">-</p>
          )}
        </div>

        {/* Tipo de daño y subdaño */}
        <div className="col-span-2">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            {t("reportViewer.damageType", { defaultValue: "Tipo de Daño" })}
          </p>
          {editingDetection ? (
            <div className="space-y-2">
              <select
                value={(editingDetection.damage_type && editingDetection.damage_type.includes(" - ")) ? editingDetection.damage_type.split(" - ")[0] : ""}
                onChange={(e) => {
                    const mainType = e.target.value;
                    const subTypes = DAMAGE_TYPES[mainType] || [];
                    const newType = subTypes.length > 0 ? `${mainType} - ${subTypes[0]}` : mainType;

                    setEditingDetection(prev => ({
                        ...prev,
                        damage_type: newType
                    }));
                    setDetections(prev => prev.map(d => d.id === editingDetection.id ? { ...d, damage_type: newType } : d));
                }}
                className="w-full rounded-md border border-line-subtle bg-surface-card !px-2 !py-1.5 text-xs text-ink outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/30"
              >
                <option value="">{t("reportViewer.selectDamageType", { defaultValue: "Seleccione Categoría Principal" })}</option>
                {Object.keys(DAMAGE_TYPES).map(catName => (
                    <option key={catName} value={catName}>{getLocalizedDamageString(catName, i18n)}</option>
                ))}
              </select>

              {(() => {
                  const currentFullType = editingDetection.damage_type || "";
                  const currentMainType = currentFullType.includes(" - ") ? currentFullType.split(" - ")[0] : currentFullType;
                  const currentSubType = currentFullType.includes(" - ") ? currentFullType.split(" - ")[1] : "";
                  const subOptions = DAMAGE_TYPES[currentMainType] || [];

                  if (subOptions.length > 0) {
                      return (
                          <select
                            value={currentSubType}
                            onChange={(e) => {
                                const subType = e.target.value;
                                const newType = `${currentMainType} - ${subType}`;
                                setEditingDetection(prev => ({
                                    ...prev,
                                    damage_type: newType
                                }));
                                setDetections(prev => prev.map(d => d.id === editingDetection.id ? { ...d, damage_type: newType } : d));
                            }}
                            className="w-full rounded-md border border-line-subtle bg-surface-card !px-2 !py-1.5 text-xs text-ink outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/30"
                          >
                              {subOptions.map(subOption => (
                                  <option key={subOption} value={subOption}>{getLocalizedDamageString(subOption, i18n)}</option>
                              ))}
                          </select>
                      );
                  }
                  return null;
              })()}
            </div>
          ) : (
            (() => {
              const dt = damageInfo.damage_type || "";
              if (!dt) return <p className="text-xs font-medium text-ink">-</p>;
              const idx = dt.indexOf(" - ");
              const main = idx === -1 ? dt : dt.slice(0, idx);
              const sub = idx === -1 ? "" : dt.slice(idx + 3);
              return (
                <>
                  <p className="break-words text-xs font-medium text-ink">{getLocalizedDamageString(main, i18n)}</p>
                  {sub && (
                    <p className="mt-0.5 break-words text-xs text-ink">{getLocalizedDamageString(sub, i18n)}</p>
                  )}
                </>
              );
            })()
          )}
        </div>

        {/* Dimensiones (de solo lectura, calculadas del recuadro) */}
        {[
          { label: t("common.radiusM", { defaultValue: "Radio (m)" }), value: damageInfo.radio },
          { label: t("common.lengthMm"), value: damageInfo.length },
          { label: t("common.widthMm"), value: damageInfo.width },
          { label: t("common.areaMm2"), value: damageInfo.area, accent: true },
        ].map((m) => (
          <div key={m.label} className="min-w-0 rounded-md border border-line-subtle bg-surface-card/40 px-2.5 py-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-ink-muted">{m.label}</p>
            <p className={`mt-0.5 truncate text-xs font-semibold tabular-nums ${m.accent ? "text-brand" : "text-ink"}`}>
              {m.value || "-"}
            </p>
          </div>
        ))}
      </div>
    </div>
  </div>
);
