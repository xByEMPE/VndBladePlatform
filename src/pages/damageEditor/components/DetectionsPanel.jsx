import React from "react";
import { normSev, getDamageMetrics, damageTypeLabel } from "../../shared/damage";
import { PanelTitle, DetectionList } from "@/components/damageEditor/panels";

export const DetectionsPanel = ({ t, i18n, detections, setIsSidebarOpen, currentImage, getSectionLabel, selectedDamageId, listFilter, setListFilter, bladeName, bladeDamages, goToDamage, SECTION_ORDER }) => (
  <div className="flex min-h-[16rem] flex-1 flex-col p-3">
    <PanelTitle
      aside={
        <span className="text-[11px] tabular-nums text-ink-muted">{bladeDamages.length}</span>
      }
    >
      {t("common.detections")} · {bladeName || "Global"}
    </PanelTitle>
    {(() => {
      const filterOptions = [
        { key: "all", label: t("common.all", { defaultValue: "Todas" }), count: bladeDamages.length },
        ...SECTION_ORDER.map((sec) => ({
          key: sec,
          label: getSectionLabel(sec),
          count: bladeDamages.filter((d) => d.section === sec).length,
        })),
      ];

      const items = bladeDamages
        .filter((d) => listFilter === "all" || d.section === listFilter)
        .map((d) => {
          // Si está abierto en el lienzo se usan sus valores en vivo
          const live = detections.find((x) => String(x.id) === String(d.id));
          const m = getDamageMetrics(d);
          const liveRadio = live ? parseFloat(live.radio) : NaN;
          const radio = Number.isFinite(liveRadio) ? liveRadio : m.radio;
          const sev = live?.severity || normSev(d.severity);
          return {
            id: d.id,
            section: d.section,
            severity: sev,
            severityLabel: sev,
            typeLabel: damageTypeLabel(
              { ...d, severity: sev, attributes: { ...(d.attributes || {}), damage_type: live?.damage_type || m.damage_type } },
              i18n
            ),
            sectionLabel: getSectionLabel(d.section),
            radiusLabel: radio > 0 ? `${Number(radio).toFixed(1)} m` : "",
            onCurrentImage: d.capture_id === currentImage?.id,
            selected: String(d.id) === String(selectedDamageId),
            radio,
          };
        })
        .sort(
          (a, b) =>
            SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section) ||
            (b.radio ?? -1) - (a.radio ?? -1)
        );

      return (
        <DetectionList
          items={items}
          filterOptions={filterOptions}
          filter={listFilter}
          onFilterChange={setListFilter}
          onSelect={(id) => {
            goToDamage(id);
            if (window.innerWidth < 1024) setIsSidebarOpen(false);
          }}
          labels={{
            empty: t("common.noDetections", { defaultValue: "No hay detecciones." }),
            thisImage: t("common.thisImage", { defaultValue: "esta imagen" }),
          }}
        />
      );
    })()}
  </div>
);
