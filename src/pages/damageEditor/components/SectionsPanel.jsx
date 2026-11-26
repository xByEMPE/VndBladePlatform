import React from "react";
import { getThumbPublicUrl } from "../../shared/image";
import { PanelTitle, SectionTiles } from "@/components/damageEditor/panels";

export const SectionsPanel = ({ t, setIsSidebarOpen, compareImage, setCompareImage, stateData, section, allImages, getSectionLabel, centerRadiusMeters, bladeDamages, SECTION_ORDER }) => (
  <div className="flex-shrink-0 border-b border-line-subtle p-3">
    <PanelTitle>{t("common.otherSections")}</PanelTitle>
    {(() => {
      // Imagen más cercana (por radio) de cada sección
      const findClosestImage = (targetSection) => {
        if (!allImages || allImages.length === 0) {
            return null;
        }

        // Filter by section and blade (if applicable)
        const candidates = allImages.filter(img =>
          (img.section === targetSection) &&
          (!stateData.blade || img.blade === stateData.blade)
        );

        if (candidates.length === 0) {
             return null;
        }

        // Find closest by radius
        // centerRadiusMeters is current position
        // image radius is often in calculated_height_m or metadata
        return candidates.reduce((prev, curr) => {
          const getRadius = (img) => {
              if (img.calculated_height_m !== undefined && img.calculated_height_m !== null) return img.calculated_height_m;
              if (img.metadata?.radius) return img.metadata.radius / 1000;
              return -999; // Penalty for missing data
          };

          const prevR = getRadius(prev);
          const currR = getRadius(curr);

          if (prevR === -999 && currR === -999) return prev; // Both bad
          if (prevR === -999) return curr;
          if (currR === -999) return prev;

          return Math.abs(currR - centerRadiusMeters) < Math.abs(prevR - centerRadiusMeters) ? curr : prev;
        });
      };

      const tiles = SECTION_ORDER.map((sec) => {
        const img = findClosestImage(sec);
        return {
          key: sec,
          label: getSectionLabel(sec),
          count: bladeDamages.filter((d) => d.section === sec).length,
          isCurrent: sec === section,
          isComparing: !!(compareImage && img && compareImage.id === img.id),
          thumb: img
            ? { src: img.publicUrl || "", thumbnailSrc: getThumbPublicUrl(img.storage_path) }
            : null,
          img,
        };
      });

      return (
        <SectionTiles
          sections={tiles}
          onSelect={(sec) => {
            const tile = tiles.find((x) => x.key === sec);
            if (!tile || tile.isCurrent || !tile.img) return;
            if (window.innerWidth < 1024) setIsSidebarOpen(false);
            // Vista dividida: en lugar de navegar, se muestra la sección al lado
            if (compareImage?.id === tile.img.id) {
              setCompareImage(null); // Toggle off if clicking same
            } else {
              setCompareImage(tile.img);
            }
          }}
          labels={{
            group: t("common.otherSections"),
            current: t("common.principal"),
            compare: t("common.comparing"),
          }}
        />
      );
    })()}
  </div>
);
