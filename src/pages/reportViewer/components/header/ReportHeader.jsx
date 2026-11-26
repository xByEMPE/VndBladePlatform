import React from "react";
import { FileText, RefreshCw } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Reveal from "@/components/ui/Reveal";
import StatusBadge from "@/components/ui/StatusBadge";
import { BTN_SECONDARY } from "@/components/reportViewer/viewerKit";

// Cabecera del visor: solo estado del documento y acciones (el rol vive en el Header superior).
export const ReportHeader = ({ t, isClient, project, turbine, isRefreshing, handleManualRefresh, isApproved }) => (
  <Reveal>
    <PageHeader
      icon={<FileText size={24} />}
      overline={t("reportViewer.title")}
      title={turbine.turbine_name}
      subtitle={`${project.name} · ${project.wind_farm}`}
      actions={
        <>
          {!isClient && (
            <StatusBadge
              status={isApproved ? "done" : "alert"}
              label={isApproved ? t("reportViewer.statusApproved") : t("reportViewer.statusToApprove")}
              className="rounded-md border border-line-subtle bg-surface-card px-3 py-1.5 font-semibold uppercase tracking-wider"
            />
          )}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className={BTN_SECONDARY}
          >
            <RefreshCw
              size={15}
              className={isRefreshing ? "animate-spin" : ""}
              aria-hidden="true"
            />
            {isRefreshing ? t("reportViewer.updating") : t("reportViewer.update")}
          </button>
        </>
      }
    />
  </Reveal>
);
