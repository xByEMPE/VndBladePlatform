import React from "react";
import { PANEL, OVERLINE, FOCUS } from "@/components/reportViewer/viewerKit";
import { ChevronDown } from "lucide-react";
import TurbineIdImageViewer from "@/components/TurbineIdImageViewer";

export const TurbineIdPanel = ({ t, turbineIdImage }) => (
  <details open className={`${PANEL} group`}>
    <summary
      className={`flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5 ${FOCUS} rounded-md`}
    >
      <span>
        <span className={`${OVERLINE} block`}>
          {t("reportViewer.turbineIdentification")}
        </span>
        <span className="mt-0.5 block text-xs text-ink-muted">
          {t("reportViewer.turbineIdentificationDescription")}
        </span>
      </span>
      <ChevronDown
        size={18}
        aria-hidden="true"
        className="shrink-0 text-ink-muted transition-transform group-open:rotate-180"
      />
    </summary>
    <div className="border-t border-line-subtle p-4 sm:p-5">
      <div className="mx-auto w-full max-w-4xl">
        <TurbineIdImageViewer
          imageSrc={turbineIdImage.url}
          imageAlt={t("reportViewer.turbineIdentification")}
        />
      </div>
    </div>
  </details>
);
