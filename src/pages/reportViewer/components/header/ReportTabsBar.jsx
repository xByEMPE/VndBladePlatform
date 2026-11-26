import React from "react";
import { TAB_CLASS, BTN_PRIMARY, BTN_DANGER } from "@/components/reportViewer/viewerKit";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Image as ImageIcon, Wind, Wand2, X, Check } from "lucide-react";

export const ReportTabsBar = ({ role, t, isClient, turbine, totalImages, handleApprove }) => (
  <div className="flex flex-col gap-3 border-b border-line-subtle p-3 sm:p-4 xl:flex-row xl:items-center xl:justify-between">
    <div className="-mx-1 overflow-x-auto px-1">
      <TabsList className="h-auto w-max gap-1 rounded-md bg-transparent p-0">
        <TabsTrigger value="overview" className={TAB_CLASS}>
          <Eye size={16} aria-hidden="true" />
          {t("reportViewer.summary")}
        </TabsTrigger>
        <TabsTrigger value="images" className={TAB_CLASS}>
          <ImageIcon size={16} aria-hidden="true" />
          {t("reportViewer.images")} ({totalImages})
        </TabsTrigger>
        <TabsTrigger value="stitched" className={TAB_CLASS}>
          <Wind size={16} aria-hidden="true" />
          {t("reportViewer.stitched", { defaultValue: "Stitched" })}
        </TabsTrigger>
        {!isClient && (
          <TabsTrigger value="reconstruction" className={TAB_CLASS}>
            <Wand2 size={16} aria-hidden="true" />
            {t("reportViewer.reconstruction")}
          </TabsTrigger>
        )}
      </TabsList>
    </div>

    <div className="flex flex-wrap items-center gap-3">
      {(role === "admin" || role === "dev") && (
        <button
          type="button"
          onClick={handleApprove}
          className={
            turbine?.status === "Aprobado" ? BTN_DANGER : BTN_PRIMARY
          }
        >
          {turbine?.status === "Aprobado" ? (
            <X size={16} aria-hidden="true" />
          ) : (
            <Check size={16} aria-hidden="true" />
          )}
          {turbine?.status === "Aprobado"
            ? t("reportViewer.revokeApproval", { defaultValue: "Revocar Aprobación" })
            : t("reportViewer.approveReport", { defaultValue: "Aprobar Reporte" })}
        </button>
      )}
    </div>
  </div>
);
