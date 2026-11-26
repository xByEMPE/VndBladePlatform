import React from "react";
import { ZoomOut, RotateCcw, ZoomIn, XCircle } from "lucide-react";
import OptimizedImage from "@/components/OptimizedImage";

export const ComparePanel = ({ t, compareImage, setCompareImage, compareZoom, setCompareZoom, comparePan, isDraggingCompare, getSectionLabel, handleCompareWheel, handleCompareMouseDown, handleCompareMouseMove, handleCompareMouseUp, resetCompareView }) => (
  <div className="w-1/2 h-full bg-surface-panel border-l border-line-medium relative overflow-hidden"
       onWheel={handleCompareWheel}
       onMouseDown={handleCompareMouseDown}
       onMouseMove={handleCompareMouseMove}
       onMouseUp={handleCompareMouseUp}
       onMouseLeave={handleCompareMouseUp}
  >
      <div className="absolute top-2 left-2 z-10 bg-status-progress/90 text-surface-base text-xs px-2 py-1 rounded shadow-lg">
          {t("common.comparing")}: {getSectionLabel(compareImage.section)}
      </div>

      {/* Close Button */}
      <div className="absolute top-2 right-2 z-10 flex gap-2">
           {/* Zoom Controls for Compare View */}
           <div className="flex items-center gap-1 bg-surface-card rounded px-1">
                <button onClick={() => setCompareZoom(z => Math.max(0.1, z - 0.1))} className="text-ink hover:text-status-progress p-1"><ZoomOut size={12}/></button>
                <button onClick={resetCompareView} className="text-ink hover:text-status-progress p-1"><RotateCcw size={12}/></button>
                <span className="text-[10px] text-ink min-w-[30px] text-center">{(compareZoom * 100).toFixed(0)}%</span>
                <button onClick={() => setCompareZoom(z => Math.min(10, z + 0.1))} className="text-ink hover:text-status-progress p-1"><ZoomIn size={12}/></button>
           </div>

          <button 
            onClick={() => setCompareImage(null)}
            className="rounded-full border border-error-border bg-error-bg p-1 text-error-text hover:bg-error-border/40"
            title={t("common.closeComparison")}
          >
              <XCircle size={16} />
          </button>
      </div>

      <div 
        className="w-full h-full flex items-center justify-center origin-center will-change-transform"
        style={{
            transform: `translate(${comparePan.x}px, ${comparePan.y}px) scale(${compareZoom})`,
            transition: isDraggingCompare ? "none" : "transform 0.1s ease-out",
            cursor: isDraggingCompare ? 'grabbing' : 'grab'
        }}
      >
          {compareImage.publicUrl || compareImage.storage_path ? (
               <OptimizedImage 
               src={compareImage.publicUrl || ""} 
               storagePath={!compareImage.publicUrl ? compareImage.storage_path : undefined}
               className="max-w-none pointer-events-none select-none" 
               draggable={false}
               alt={`${t("common.comparing")} ${compareImage.section}`}
           />
          ) : (
              <div className="text-ink-muted text-sm">{t("common.loadingImage")}</div>
          )}
      </div>
  </div>
);
