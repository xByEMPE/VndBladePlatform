import React from "react";
import { tx } from "@/i18n/tx";
import { FIELD, ICON_BTN, BladeSegment } from "@/components/reportViewer/viewerKit";
import { bladeSections, EMPTY_IMAGES, bladeTabs } from "../../utils/constants";
import { getImageFullUrl, getImageThumbUrl } from "../../utils/urls";
import { TabsContent } from "@/components/ui/tabs";
import { RefreshCw, Loader, Image as ImageIcon } from "lucide-react";
import ImageCarousel from "@/components/reportViewer/ImageCarousel";

export const ImagesTab = ({ t, isAdmin, selectedBlade, setSelectedBlade, imageSection, setImageSection, sectionAliases, allTurbineImages, imagesLoaded, loadAllBladesImages, savingAlias, getSectionLabel, updateSectionAlias, loadingImages, openImageInNewWindow, totalImages, totalImagesByBlade }) => (
  <TabsContent value="images" className="mt-0">
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BladeSegment
          blades={bladeTabs}
          value={selectedBlade}
          onChange={setSelectedBlade}
          label={t("reportViewer.bladeSelection")}
        />
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs tabular-nums text-ink-muted">
            {selectedBlade}: {totalImagesByBlade[selectedBlade] || 0} {t("reportViewer.images")} · {t("reportViewer.total")}: {totalImages}
          </span>
          <button
            type="button"
            onClick={loadAllBladesImages}
            disabled={loadingImages}
            className={ICON_BTN}
          >
            <RefreshCw
              size={14}
              className={loadingImages ? "animate-spin" : ""}
              aria-hidden="true"
            />
            {loadingImages
              ? t("reportViewer.loading")
              : t("reportViewer.reloadAllBlades")}
          </button>
        </div>
      </div>

      {loadingImages ? (
        <div className="flex items-center justify-center py-16">
          <Loader size={26} className="mr-3 animate-spin text-ink" aria-hidden="true" />
          <span className="text-sm text-ink-muted">
            {t("reportViewer.loadingImages")}
          </span>
        </div>
      ) : !imagesLoaded ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-ink-muted">
          <ImageIcon size={30} className="mb-3 opacity-60" aria-hidden="true" />
          <p className="text-sm">
            Haz clic en "{t("reportViewer.reloadAllBlades")}" para cargar las imágenes
          </p>
        </div>
      ) : (
        <ImageCarousel
          sections={bladeSections.map((sec) => ({
            key: sec,
            label: getSectionLabel(sec),
            count: allTurbineImages[selectedBlade]?.[sec]?.length || 0,
          }))}
          activeSection={imageSection}
          onSectionChange={setImageSection}
          images={allTurbineImages[selectedBlade]?.[imageSection] || EMPTY_IMAGES}
          getFullUrl={getImageFullUrl}
          getThumbUrl={getImageThumbUrl}
          onOpen={(file) =>
            openImageInNewWindow(file, imageSection, selectedBlade)
          }
          sectionExtra={
            isAdmin ? (
              <label
                className="flex items-center gap-2 text-xs text-ink"
                title={tx("Admin: cambiar sección mostrada (guardado global)")}
              >
                <span>{tx("Mostrar esta sección como")}</span>
                <select
                  value={getSectionLabel(imageSection)}
                  onChange={(e) =>
                    updateSectionAlias(imageSection, e.target.value)
                  }
                  disabled={savingAlias}
                  className={`${FIELD} !w-auto font-semibold ${savingAlias ? "cursor-wait opacity-50" : "cursor-pointer"}`}
                >
                  {["TE", "PS", "LE", "SS"].map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                {sectionAliases[imageSection] && (
                  <span
                    className="text-brand"
                    title={tx("Original: {{section}}", { section: imageSection })}
                  >
                    *
                  </span>
                )}
              </label>
            ) : null
          }
        />
      )}
    </div>
  </TabsContent>
);
