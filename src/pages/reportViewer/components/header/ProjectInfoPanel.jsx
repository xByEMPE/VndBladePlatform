import React from "react";
import { PANEL, OVERLINE } from "@/components/reportViewer/viewerKit";

export const ProjectInfoPanel = ({ t, infoItems }) => (
  <section aria-labelledby="rv-info-title" className={PANEL}>
    <div className="border-b border-line-subtle px-4 py-3 sm:px-5">
      <h2 id="rv-info-title" className={OVERLINE}>
        {t("reportViewer.projectInfo")}
      </h2>
    </div>
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
      {infoItems.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className={OVERLINE}>{item.label}</dt>
          <dd className="mt-1 break-words text-sm font-medium text-ink">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  </section>
);
