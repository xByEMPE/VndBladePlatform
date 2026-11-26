import { dateLocale } from "@/i18n/tx";
import React from "react";
import { useTranslation } from "react-i18next";
import { Database } from "lucide-react";
import BentoCard from "@/components/ui/BentoCard";
import EmptyState from "@/components/ui/EmptyState";
import Overline from "@/components/ui/Overline";
import StatusPill from "@/components/ui/StatusPill";
import { toChipStatusKey } from "@/lib/projectStatus";
import { TH } from "./adminStyles";

/** Resumen de proyectos (solo lectura). */
const ProjectsSummary = ({ projects }) => {
  const { t } = useTranslation("common");

  return (
    <BentoCard as="section" flat aria-labelledby="projects-title">
      <div className="border-b border-line-subtle px-5 py-4">
        <Overline as="h2" id="projects-title" className="flex items-center gap-2 text-ink">
          <Database size={14} className="text-info" aria-hidden="true" />
          {t("admin.projectSummary.title")}
        </Overline>
        <p className="mt-1 text-xs text-ink-muted">{t("admin.projectSummary.subtitle")}</p>
      </div>

      <div className="p-4 sm:p-5">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-line-subtle">
                <th className={TH}>{t("admin.projectSummary.table.project")}</th>
                <th className={TH}>{t("admin.projectSummary.table.client")}</th>
                <th className={TH}>{t("admin.projectSummary.table.status")}</th>
                <th className={TH}>{t("admin.projectSummary.table.turbines")}</th>
                <th className={TH}>{t("admin.projectSummary.table.created")}</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="border-b border-line-subtle transition-colors last:border-0 hover:bg-surface-card">
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-ink">{project.name}</div>
                      <div className="text-sm text-ink-muted">{project.wind_farm}</div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-sm text-ink">{project.client}</td>
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <StatusPill status={toChipStatusKey(project.status)} label={project.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 font-mono text-sm tabular-nums text-ink">
                    {project.turbine_count || 0}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-sm tabular-nums text-ink-muted">
                    {new Date(project.created_at).toLocaleDateString(dateLocale(), { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {projects.length === 0 && <EmptyState>{t("admin.projectSummary.noProjectsFound")}</EmptyState>}
        </div>
      </div>
    </BentoCard>
  );
};

export default ProjectsSummary;
