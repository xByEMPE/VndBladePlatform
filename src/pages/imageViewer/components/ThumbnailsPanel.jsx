import React from "react";
import { Image as ImageIcon } from "lucide-react";

export const ThumbnailsPanel = ({ t, isStitched, isSidebarOpen, allImages, setCurrentImageIndex, currentImage }) => (
  <div
       className={`bg-surface-panel border-l border-line-medium overflow-hidden relative transition-all duration-300 ease-in-out flex flex-col ${isSidebarOpen ? "w-64" : "w-0 border-none"}`}
       style={{ opacity: isSidebarOpen ? 1 : 0 }}
  >
       {/* Memoized list for performance */}
       {(() => {
           // Optimization: Filter logic moving inside render for now, but better as useMemo outside.
           // However, since we are inside the return, let's just do it cleanly.
           const sidebarImages = allImages.filter(img => img.section === currentImage?.section);

           return (
              <>
               {/* Sidebar Header */}
               <div className="p-3 border-b border-line-subtle bg-surface-card">
                  <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                      <ImageIcon size={16} className="text-status-progress" />
                      {t("common.images")} ({currentImage?.section || "N/A"})
                  </h3>
                  <div className="text-[10px] text-ink-muted mt-1">
                      {sidebarImages.length} {t("common.items")}
                  </div>
               </div>

               {/* Image List */}
               <div className="flex-1 overflow-y-auto p-2 space-y-2">
                   {sidebarImages.map((img, idx) => {
                       // Find original index in allImages to set correctly
                       const originalIndex = allImages.findIndex(ai => ai.id === img.id);
                       const isSelected = img.id === currentImage.id || img.path === currentImage.path;
                       const bgClass = isSelected ? "bg-status-progress/15 border-status-progress/50" : "bg-surface-card/50 border-line-subtle hover:bg-surface-card hover:border-line-medium";

                       return (
                           <div 
                              key={img.id || idx}
                              onClick={() => {
                                  if (originalIndex !== -1) setCurrentImageIndex(originalIndex);
                              }}
                              className={`
                                        cursor-pointer rounded-lg border p-2 flex gap-2 items-center transition-all duration-200 group
                                        ${bgClass}
                                    `}
                           >
                              <div className="relative w-12 h-12 shrink-0 bg-surface-base rounded overflow-hidden border border-line-medium">
                                  {img.thumbnailSrc || img.src ? (
                                      <img 
                                          src={img.thumbnailSrc || img.src} 
                                          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                                          loading="lazy" 
                                          alt=""
                                      />
                                  ) : (
                                      <div className="w-full h-full flex items-center justify-center text-ink-muted">
                                          <ImageIcon size={16} />
                                      </div>
                                  )}
                              </div>
                              <div className="flex-1 min-w-0">
                                  <div className={`text-xs truncate font-medium ${isSelected ? "text-status-progress" : "text-ink"}`}>
                                      {img.name || img.file_name || "..."}
                                  </div>
                                  <div className="text-[10px] text-ink-muted truncate flex justify-between">
                                      <span>{isStitched ? "" : img.position_meters ? `${img.position_meters.toFixed(1)}m` : "N/A"}</span>
                                      <span>#{idx + 1}</span>
                                  </div>
                              </div>
                           </div>
                       );
                   })}
               </div>
              </>
           );
       })()}
  </div>
);
