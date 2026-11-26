import React from "react";
import { tx } from "@/i18n/tx";
import { OVERLINE, BladeSummaryCard } from "@/components/reportViewer/viewerKit";

export const BladeStatusSection = ({ t, selectedBlade, setSelectedBlade, bladeStats }) => (
  <section aria-labelledby="rv-blades-title">
    <h3 id="rv-blades-title" className={`${OVERLINE} mb-3`}>
      {tx("Estado por pala")}
    </h3>
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {bladeStats.map((b) => (
        <BladeSummaryCard
          key={b.blade}
          blade={b.blade}
          active={selectedBlade === b.blade}
          onSelect={() => setSelectedBlade(b.blade)}
          total={b.total}
          images={b.images}
          counts={b.counts}
          damagesLabel={t("reportViewer.damagesDetected")}
          imagesLabel={t("reportViewer.capturedImages")}
        />
      ))}
    </div>
  </section>
);
