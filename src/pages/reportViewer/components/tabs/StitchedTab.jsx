import React from "react";
import { getImageUrl } from "@/lib/storageUrls";
import { PANEL, OVERLINE, FOCUS } from "@/components/reportViewer/viewerKit";
import { TabsContent } from "@/components/ui/tabs";
import { Image as ImageIcon, ExternalLink, X } from "lucide-react";

export const StitchedTab = ({ t, getStitchedMap, openStitchedInViewer }) => (
  <TabsContent value="stitched" className="mt-0">
    <div className="space-y-4">
      <div>
        <h3 className={OVERLINE}>
          {t("reportViewer.stitchedReconstructions", { defaultValue: "Reconstrucciones Panorámicas (Stitched)" })}
        </h3>
        <p className="mt-1 text-xs text-ink-muted">
          {t("reportViewer.stitchedOpenHint", { defaultValue: "Haz clic en una imagen para abrirla en el visor, en una pestaña nueva." })}
        </p>
      </div>

      {(() => {
        // Leer el mapa JSON de la turbina
        const stitchedMap = getStitchedMap();

        const getStitchedUrl = (path) => {
          if (!path) return null;
          const data = { publicUrl: getImageUrl(path) };
          return data.publicUrl;
        };

        const hasAnyStitched = Object.keys(stitchedMap).length > 0;

        if (!hasAnyStitched) {
          return (
            <div className={`${PANEL} flex flex-col items-center justify-center py-16 text-ink-muted`}>
              <ImageIcon size={30} className="mb-3 opacity-60" aria-hidden="true" />
              <p className="text-sm">{t("reportViewer.noStitchedAvailable", { defaultValue: "No hay reconstrucciones panorámicas disponibles." })}</p>
            </div>
          );
        }

        return (
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-3">
            {['A', 'B', 'C'].map((blade) => {
              const bladeData = stitchedMap[blade] || {};

              return (
                <section
                  key={blade}
                  aria-label={`Blade ${blade}`}
                  className={`${PANEL} overflow-hidden`}
                >
                  <h4 className="border-b border-line-subtle px-4 py-3 text-sm font-semibold text-brand">
                    Blade {blade}
                  </h4>

                  <div className="overflow-x-auto">
                    <div className="grid min-w-[34rem] grid-cols-4 divide-x divide-line-subtle">
                      {['LeadingEdge', 'PressureSide', 'SuctionSide', 'TrailingEdge'].map((section) => {
                        const path = bladeData[section];
                        const url = getStitchedUrl(path);

                        // Formatear nombre para mostrar
                        const displaySection = section.replace('LeadingEdge', 'LE')
                                                     .replace('TrailingEdge', 'TE')
                                                     .replace('PressureSide', 'PS')
                                                     .replace('SuctionSide', 'SS');

                        return (
                          <div key={section} className="flex min-w-0 flex-col">
                            <span className="border-b border-line-subtle bg-surface-card/40 py-2 text-center text-xs font-semibold uppercase tracking-widest text-ink">
                              {displaySection}
                            </span>
                            {url ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => {
                                  // Clic normal: visor de imágenes. Con Ctrl/Cmd/Shift o clic central
                                  // se conserva el comportamiento del enlace (imagen directa).
                                  if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
                                    e.preventDefault();
                                    openStitchedInViewer(blade, section);
                                  }
                                }}
                                aria-label={t("reportViewer.openStitchedAria", { blade, section: displaySection })}
                                className={`group relative flex min-h-[600px] flex-1 items-center justify-center bg-surface-base transition-colors hover:bg-surface-base ${FOCUS} focus-visible:ring-inset focus-visible:ring-offset-0`}
                              >
                                <img
                                  src={url}
                                  alt={`${blade}-${section}`}
                                  loading="lazy"
                                  decoding="async"
                                  className="h-full w-full object-contain transition-opacity group-hover:opacity-90"
                                />
                                <span className="pointer-events-none absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md border border-line-medium bg-surface-base/70 text-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                                  <ExternalLink size={14} aria-hidden="true" />
                                </span>
                              </a>
                            ) : (
                              <div className="flex min-h-[600px] flex-1 flex-col items-center justify-center gap-2 bg-surface-base text-xs text-ink-muted">
                                <X size={20} aria-hidden="true" />
                                <span>N/A</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        );
      })()}
    </div>
  </TabsContent>
);
