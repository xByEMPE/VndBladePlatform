import React from "react";
import { tx, dateLocale } from "@/i18n/tx";
import { supabase } from "@/lib/supabase";
import { FIELD, ICON_BTN, OVERLINE, BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER, SeverityBadge, OriginTag, Callout, Metric } from "@/components/reportViewer/viewerKit";
import { DAMAGE_TYPES, getLocalizedDamageString, getDamageExtraData } from "../../../shared/damage";
import { getSuggestedAction } from "../../utils/labels";
import { Pencil, Loader, Trash2, Check, X } from "lucide-react";
import { DamageThumbnail } from "../DamageThumbnail";
import TranslatedText from "@/components/TranslatedText";

export const DamageCard = ({ damage, t, i18n, isClient, isAdmin, selectedBlade, sectionAliases, damageImages, savingAlias, getSectionLabel, updateSectionAlias, selectedDamages, toggleDamageSelection, openImageInNewWindow, editingDamage, editingFields, deletingDamages, setEditingDamage, updateDamageField, saveDamageChanges, handleDeleteDamage }) => {
  // CORRECCIÓN: Buscar imagen asociada al daño
  const bladeNameForSearch = selectedBlade.replace(
    "Blade ",
    "Pala ",
  );

  // Primero intentar obtener la imagen específica del daño (para daños creados manualmente)
  let imageInfo = null;
  let damageImageFile = null;

  if (damage.description) {
    try {
      const desc = JSON.parse(damage.description);
      if (desc.image_path) {
        // Daño creado manualmente con imagen específica
        imageInfo = {
          originalPath: desc.image_path,
          imageName:
            desc.image_name ||
            `damage_${damage.id}.jpg`,
          section: damage.section,
          blade: bladeNameForSearch,
        };
        damageImageFile = {
          name:
            desc.image_name ||
            `damage_${damage.id}.jpg`,
          path: desc.image_path,
          inspection_file_id: desc.inspection_file_id,
        };
      }
    } catch (e) {
      console.log(
        "Error parsing damage description:",
        e,
      );
    }
  }

  // CORRECCIÓN: Usar ruta directa si viene de la relación 'captures'
  if (!imageInfo && damage.capture_storage_path) {
    imageInfo = {
      originalPath: damage.capture_storage_path,
      imageName: damage.capture_storage_path
        .split("/")
        .pop(),
      section: damage.section,
      blade: bladeNameForSearch,
      inspection_file_id: damage.capture_id, // Usar capture_id como ID de archivo
    };
  }

  // Si no hay imagen específica, buscar en damageImages (para daños de IA)
  if (!imageInfo) {
    const damageImageInfo = Object.entries(
      damageImages,
    ).find(([imageKey, info]) => {
      // MATCH LOGIC ALIGNED WITH PDF GENERATOR
      const keyMatches =
        imageKey.includes(
          `_${damage.section}_${bladeNameForSearch}`,
        ) ||
        imageKey.includes(
          `_${damage.section}_${selectedBlade}`,
        );

      const sectionMatches =
        info.section === damage.section;
      const bladeMatches =
        info.blade === bladeNameForSearch ||
        info.blade === selectedBlade;

      const isAutoDetected =
        damage.title && damage.title.includes("Auto");
      const hasDetections =
        info.detections && info.detections.length > 0;

      return (
        (keyMatches &&
          sectionMatches &&
          bladeMatches) ||
        (isAutoDetected &&
          sectionMatches &&
          bladeMatches &&
          hasDetections)
      );
    });

    imageInfo = damageImageInfo
      ? damageImageInfo[1]
      : null;
  }

  const isDamageSelected = selectedDamages.has(
    damage.id,
  );


  // --- Valores a mostrar (mismas reglas que antes, unificadas para la nueva tarjeta) ---
  const extra = getDamageExtraData(damage);
  const isAuto = !!(
    damage.title && damage.title.includes("Auto")
  );
  // Tipo y subdaño ("Tipo - Subdaño"): se muestran completos y por separado
  const splitType = (dbType) => {
    if (!dbType) return null;
    const idx = dbType.indexOf(" - ");
    const main = idx === -1 ? dbType : dbType.slice(0, idx);
    const sub = idx === -1 ? "" : dbType.slice(idx + 3);
    return {
      main: getLocalizedDamageString(main, i18n),
      sub: sub ? getLocalizedDamageString(sub, i18n) : "",
    };
  };
  const typeParts = splitType(extra.damage_type);
  const typeMetrics = typeParts
    ? [
        { label: t("reportViewer.type"), value: typeParts.main, wide: true },
        ...(typeParts.sub
          ? [{ label: t("reportViewer.subtype", { defaultValue: "Subdaño" }), value: typeParts.sub, wide: true }]
          : []),
      ]
    : [];
  let metrics = [];
  if (!isAuto) {
    metrics = [
      ...typeMetrics,
      extra.radius_mm && {
        label: t("reportViewer.radius"),
        value: `${extra.radius_mm} mm`,
      },
      extra.length_mm && {
        label: t("reportViewer.length"),
        value: `${extra.length_mm} mm`,
      },
      extra.width_mm && {
        label: t("reportViewer.width"),
        value: `${extra.width_mm} mm`,
      },
    ].filter(Boolean);
  } else if (
    extra.damage_type ||
    extra.radius_mm ||
    extra.length_mm ||
    extra.width_mm
  ) {
    metrics = [
      ...typeMetrics,
      Number(extra.radius_mm) > 0 && {
        label: t("reportViewer.radius"),
        value: `${Number(extra.radius_mm).toFixed(0)} mm`,
      },
      Number(extra.length_mm) > 0 && {
        label: t("reportViewer.length"),
        value: `${extra.length_mm} mm`,
      },
      Number(extra.width_mm) > 0 && {
        label: t("reportViewer.width"),
        value: `${extra.width_mm} mm`,
      },
      Number(extra.area) > 0 && {
        label: tx("Área"),
        value: `${extra.area} mm²`,
      },
    ].filter(Boolean);
  }
  const suggestedAction = (() => {
    const act = getSuggestedAction(damage.severity, t);
    return act && act !== "-" && act !== " "
      ? act
      : damage.severity || "Revisar";
  })();
  const isEditingThis =
    editingDamage === damage.id && !isClient;
  return (
    <article
      key={damage.id}
      data-damage-id={damage.id}
      className={`rounded-md border bg-surface-panel transition-colors ${
                                  isDamageSelected
                                    ? "border-brand/60 ring-1 ring-brand/30"
                                    : "border-line-subtle"
                                }`}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-subtle px-4 py-3">
        <SeverityBadge severity={damage.severity} />

        {/* Sección: admin ve selector, el resto una etiqueta */}
        {isAdmin ? (
          <span
            className="inline-flex items-center gap-1"
            title={tx("Sección (solo para admins: cambiar visualización)")}
          >
            <select
              value={getSectionLabel(damage.section)}
              onChange={(e) =>
                updateSectionAlias(
                  damage.section,
                  e.target.value,
                )
              }
              onClick={(e) => e.stopPropagation()}
              disabled={savingAlias}
              aria-label={tx("Sección del daño")}
              className={`${FIELD} !w-auto !py-1 font-semibold ${savingAlias ? "cursor-wait opacity-50" : "cursor-pointer"}`}
            >
              {["TE", "PS", "LE", "SS"].map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            {sectionAliases[damage.section] && (
              <span
                className="text-xs text-brand"
                title={tx("Original: {{section}}", { section: damage.section })}
              >
                *
              </span>
            )}
          </span>
        ) : (
          <span className="text-sm font-medium text-ink">
            {getSectionLabel(damage.section)}
          </span>
        )}

        <OriginTag auto={isAuto} />

        {damage.radius && (
          <span className="text-xs text-ink-muted">
            {t("reportViewer.radius")}: {damage.radius} cm
          </span>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Incluir en PDF - Solo para Admins */}
          {isAdmin && (
            <label className="group flex cursor-pointer select-none items-center gap-2">
              <input
                type="checkbox"
                checked={isDamageSelected}
                onChange={() => toggleDamageSelection(damage.id)}
                className="h-4 w-4 cursor-pointer rounded accent-brand"
              />
              <span
                className={`text-xs font-medium transition-colors ${
                                            isDamageSelected
                                              ? "text-brand"
                                              : "text-ink-muted group-hover:text-ink"
                                          }`}
              >
                {tx("Incluir en PDF")}
              </span>
            </label>
          )}
          {!isClient && !isEditingThis && (
            <>
              <button
                type="button"
                onClick={() => setEditingDamage(damage.id)}
                title={t("reportViewer.editDamageInfo")}
                className={ICON_BTN}
              >
                <Pencil size={14} aria-hidden="true" />
                <span className="hidden sm:inline">
                  {t("reportViewer.editDamage")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleDeleteDamage(damage.id)}
                disabled={deletingDamages.has(damage.id)}
                title={t("reportViewer.deleteDamage")}
                aria-label={t("reportViewer.deleteDamage")}
                className={`${ICON_BTN} hover:!border-error-border hover:!text-error-text`}
              >
                {deletingDamages.has(damage.id) ? (
                  <Loader size={14} className="animate-spin text-ink" aria-hidden="true" />
                ) : (
                  <Trash2 size={14} aria-hidden="true" />
                )}
              </button>
            </>
          )}
        </div>
      </header>

      <div
        className={`grid gap-4 p-4 ${imageInfo ? "md:grid-cols-[14rem_minmax(0,1fr)]" : ""}`}
      >
        {imageInfo && (
          <div className="mx-auto md:mx-0">
            <DamageThumbnail
              damage={damage}
              imageInfo={imageInfo}
              damageImageFile={damageImageFile}
              supabase={supabase}
              openImageInNewWindow={openImageInNewWindow}
              t={t}
            />
            <p className="mt-1.5 text-center text-xs text-ink-muted">
              {t("reportViewer.clickToViewDamageDetails")}
            </p>
          </div>
        )}

        <div className="min-w-0 space-y-3">
          {!isEditingThis && (
            <Callout title={t("reportViewer.suggestedActions")}>
              {suggestedAction}
            </Callout>
          )}

          {isEditingThis ? (
            <div className="rounded-md border border-line-subtle bg-surface-card/40 p-3 sm:p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* Severidad */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink">
                      {t("reportViewer.severity", { defaultValue: "Severidad" })}:
                      {damage.title &&
                        damage.title.includes(
                          "Auto",
                        ) && (
                          <span className="text-brand ml-1">
                            (IA)
                          </span>
                        )}
                      {damage.updated_at &&
                        damage.notes &&
                        (() => {
                          try {
                            return JSON.parse(damage.notes || "{}").last_edited;
                          } catch (e) {
                            return false;
                          }
                        })() && (
                          <span className="text-status-done ml-1">
                            (Editado)
                          </span>
                        )}
                    </label>
                    <select
                      value={(() => {
                        const val =
                          editingFields[damage.id]
                            ?.severity !== undefined
                            ? editingFields[damage.id]
                                .severity
                            : damage.severity;
                        // Normalize to "Cat X" format to match options
                        if (
                          val &&
                          !String(val).startsWith(
                            "Cat",
                          )
                        ) {
                          return `Cat ${val}`;
                        }
                        return val || "Cat 3"; // Default to Cat 3 if null
                      })()}
                      onChange={(e) => {
                        const newVal = e.target.value;
                        // Update Severity
                        updateDamageField(
                          damage.id,
                          "severity",
                          newVal,
                        );
                        // Also sync damage_type to keep them consistent
                        updateDamageField(
                          damage.id,
                          "damage_type",
                          newVal,
                        );
                      }}
                      className="w-full rounded-md border border-line-subtle bg-surface-card !px-2.5 !py-1.5 text-xs text-ink outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/30"
                    >
                      <option value="Cat 1">
                        {t("reportViewer.cat1")}
                      </option>
                      <option value="Cat 2">
                        {t("reportViewer.cat2")}
                      </option>
                      <option value="Cat 3">
                        {t("reportViewer.cat3")}
                      </option>
                      <option value="Cat 4">
                        {t("reportViewer.cat4")}
                      </option>
                      <option value="Cat 5">
                        {t("reportViewer.cat5")}
                      </option>
                    </select>
                  </div>

                  {/* Acción sugerida según la severidad en edición */}
                  <div className="sm:col-span-2">
                    <Callout title={t("reportViewer.suggestedActions")}>
                      {(() => {
                        const sev =
                          editingFields[damage.id]?.severity !== undefined
                            ? editingFields[damage.id].severity
                            : damage.severity;
                        const act = getSuggestedAction(sev, t);
                        return act && act !== "-" && act !== " "
                          ? act
                          : sev || "Revisar";
                      })()}
                    </Callout>
                  </div>

                  {/* Tipo de Daño */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink">
                      {t("reportViewer.damageType")}:
                    </label>
                    <select
                      value={(() => {
                        const curType =
                          editingFields[damage.id]
                            ?.damage_type !==
                          undefined
                            ? editingFields[damage.id]
                                .damage_type
                            : getDamageExtraData(
                                damage,
                              ).damage_type || "";
                        return curType.includes(" - ")
                          ? curType.split(" - ")[0]
                          : curType;
                      })()}
                      onChange={(e) => {
                        const mainType =
                          e.target.value;
                        const subTypes =
                          DAMAGE_TYPES[mainType] ||
                          [];
                        const newType =
                          subTypes.length > 0
                            ? `${mainType} - ${subTypes[0]}`
                            : mainType;
                        updateDamageField(
                          damage.id,
                          "damage_type",
                          newType,
                        );
                      }}
                      className="w-full rounded-md border border-line-subtle bg-surface-card !px-2.5 !py-1.5 text-xs text-ink outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/30 mb-2"
                    >
                      <option value="">
                        {t(
                          "reportViewer.selectDamageType",
                        )}
                      </option>
                      {Object.keys(DAMAGE_TYPES).map(
                        (catName) => (
                          <option
                            key={catName}
                            value={catName}
                          >
                            {getLocalizedDamageString(
                              catName,
                              i18n,
                            )}
                          </option>
                        ),
                      )}
                    </select>

                    {(() => {
                      const currentFullType =
                        editingFields[damage.id]
                          ?.damage_type !== undefined
                          ? editingFields[damage.id]
                              .damage_type
                          : getDamageExtraData(damage)
                              .damage_type || "";
                      const currentMainType =
                        currentFullType.includes(
                          " - ",
                        )
                          ? currentFullType.split(
                              " - ",
                            )[0]
                          : currentFullType;
                      const currentSubType =
                        currentFullType.includes(
                          " - ",
                        )
                          ? currentFullType.split(
                              " - ",
                            )[1]
                          : "";
                      const subOptions =
                        DAMAGE_TYPES[
                          currentMainType
                        ] || [];

                      if (subOptions.length > 0) {
                        return (
                          <select
                            value={currentSubType}
                            onChange={(e) => {
                              const subType =
                                e.target.value;
                              const newType = `${currentMainType} - ${subType}`;
                              updateDamageField(
                                damage.id,
                                "damage_type",
                                newType,
                              );
                            }}
                            className="w-full rounded-md border border-line-subtle bg-surface-card !px-2.5 !py-1.5 text-xs text-ink outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/30"
                          >
                            {subOptions.map(
                              (subOption) => (
                                <option
                                  key={subOption}
                                  value={subOption}
                                >
                                  {getLocalizedDamageString(
                                    subOption,
                                    i18n,
                                  )}
                                </option>
                              ),
                            )}
                          </select>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {/* Radio (mm) */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink">
                      {t("reportViewer.radius")}:
                      (mm):
                    </label>
                    <input
                      type="number"
                      value={
                        editingFields[damage.id]
                          ?.radius_mm !== undefined
                          ? editingFields[damage.id]
                              .radius_mm
                          : getDamageExtraData(damage)
                              .radius_mm || ""
                      }
                      onChange={(e) =>
                        updateDamageField(
                          damage.id,
                          "radius_mm",
                          e.target.value,
                        )
                      }
                      placeholder="0"
                      className="w-full rounded-md border border-line-subtle bg-surface-card !px-2.5 !py-1.5 text-xs text-ink outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/30"
                    />
                  </div>

                  {/* Longitud (mm) */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink">
                      {t("reportViewer.length")}:
                      (mm):
                    </label>
                    <input
                      type="number"
                      value={
                        editingFields[damage.id]
                          ?.length_mm !== undefined
                          ? editingFields[damage.id]
                              .length_mm
                          : getDamageExtraData(damage)
                              .length_mm || ""
                      }
                      onChange={(e) =>
                        updateDamageField(
                          damage.id,
                          "length_mm",
                          e.target.value,
                        )
                      }
                      placeholder="0"
                      className="w-full rounded-md border border-line-subtle bg-surface-card !px-2.5 !py-1.5 text-xs text-ink outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/30"
                    />
                  </div>

                  {/* Anchura (mm) */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink">
                      {t("reportViewer.width")}: (mm):
                    </label>
                    <input
                      type="number"
                      value={
                        editingFields[damage.id]
                          ?.width_mm !== undefined
                          ? editingFields[damage.id]
                              .width_mm
                          : getDamageExtraData(damage)
                              .width_mm || ""
                      }
                      onChange={(e) =>
                        updateDamageField(
                          damage.id,
                          "width_mm",
                          e.target.value,
                        )
                      }
                      placeholder="0"
                      className="w-full rounded-md border border-line-subtle bg-surface-card !px-2.5 !py-1.5 text-xs text-ink outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/30"
                    />
                  </div>

                  {/* Notas */}
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-ink">
                      {t("reportViewer.notes")}:
                    </label>
                    <textarea
                      value={
                        editingFields[damage.id]
                          ?.additional_notes !==
                        undefined
                          ? editingFields[damage.id]
                              .additional_notes
                          : getDamageExtraData(damage)
                              .additional_notes || ""
                      }
                      onChange={(e) =>
                        updateDamageField(
                          damage.id,
                          "additional_notes",
                          e.target.value,
                        )
                      }
                      placeholder={t(
                        "reportViewer.notesPlaceholder",
                      )}
                      rows={2}
                      className="w-full rounded-md border border-line-subtle bg-surface-card !px-2.5 !py-1.5 text-xs text-ink outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/30 resize-none"
                    />
                  </div>
                </div>
                {/* Botones de acción - Solo para admin/technician */}
                {!isClient && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-line-subtle pt-3">
                    <button
                      type="button"
                      onClick={() => saveDamageChanges(damage.id)}
                      className={BTN_PRIMARY}
                    >
                      <Check size={16} aria-hidden="true" />
                      {t("reportViewer.save")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingDamage(null)}
                      className={BTN_SECONDARY}
                    >
                      <X size={16} aria-hidden="true" />
                      {t("reportViewer.cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDamage(damage.id)}
                      disabled={deletingDamages.has(damage.id)}
                      title={tx("Eliminar daño (Útil para eliminar duplicados de IA)")}
                      className={`${BTN_DANGER} sm:ml-auto`}
                    >
                      {deletingDamages.has(damage.id) ? (
                        <Loader size={16} className="animate-spin text-ink" aria-hidden="true" />
                      ) : (
                        <Trash2 size={16} aria-hidden="true" />
                      )}
                      {t("reportViewer.deleteDamage")}
                    </button>
                  </div>
                )}
              </div>
          ) : (
            <>
              {metrics.length > 0 && (
                <div>
                  <p className={`${OVERLINE} mb-2`}>
                    {t("reportViewer.damageInfo")}
                  </p>
                  <dl className="grid grid-cols-2 gap-2 lg:grid-cols-3 2xl:grid-cols-5">
                    {metrics.map((m) => (
                      <Metric key={m.label} label={m.label} value={m.value} wide={m.wide} />
                    ))}
                  </dl>
                </div>
              )}

              {extra.additional_notes && (
                <div className="rounded-md border border-line-subtle bg-surface-card/40 px-3 py-2">
                  <p className={OVERLINE}>{t("reportViewer.notes")}</p>
                  <TranslatedText
                    as="p"
                    text={extra.additional_notes}
                    className="mt-0.5 text-sm text-ink"
                  />
                </div>
              )}

              {isAuto && extra.last_edited && (
                <p className="text-xs text-ink-muted">
                  {t("reportViewer.lastEdited")}:{" "}
                  {new Date(extra.last_edited).toLocaleString(dateLocale(), { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
              {isAuto && imageInfo && imageInfo.processed_at && (
                <p className="text-xs text-ink-muted">
                  {t("reportViewer.processed")}:{" "}
                  {new Date(imageInfo.processed_at).toLocaleString(dateLocale(), { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
};
