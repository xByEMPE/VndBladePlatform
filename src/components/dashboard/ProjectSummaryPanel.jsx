import React from "react";
import { tx } from "@/i18n/tx";
import { FolderKanban, Wind, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { toPercent, percentOf, formatPercent } from "@/lib/gauge";
import BentoCard from "@/components/ui/BentoCard";
import KpiGrid from "@/components/ui/KpiGrid";
import KpiMetric from "@/components/ui/KpiMetric";
import Overline from "@/components/ui/Overline";
import ProgressBar from "@/components/ui/ProgressBar";
import Reveal from "@/components/ui/Reveal";
import YearFilter from "@/components/dashboard/YearFilter";

/**
 * Bloque "Resumen de proyectos": métricas de proyectos y turbinas con filtro de año.
 * @param {{
 *   isUserAdmin: boolean, selectedYear: string, onYearChange: (y: string) => void,
 *   availableYears: string[],
 *   projectStats: { total: number, active: number, completed: number },
 *   turbineStats: { total: number, completed: number, inProgress: number }
 * }} props
 */
const ProjectSummaryPanel = ({
  isUserAdmin,
  selectedYear,
  onYearChange,
  availableYears,
  projectStats,
  turbineStats,
}) => {
  const pendingTurbines = Math.max(0, turbineStats.total - turbineStats.completed - turbineStats.inProgress);
  const pctInspected = percentOf(turbineStats.completed, turbineStats.total);
  const pctInProgress = percentOf(turbineStats.inProgress, turbineStats.total);
  const pctPending = percentOf(pendingTurbines, turbineStats.total);

  return (
    <Reveal delay={0.05}>
      <BentoCard as="section" flat aria-labelledby="kpi-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-5 py-3">
          <Overline as="h2" id="kpi-title" className="flex items-center gap-2 text-ink">
            <FolderKanban size={14} className="text-info" aria-hidden="true" />
            {isUserAdmin ? tx("Resumen de proyectos") : tx("Mis proyectos")}
          </Overline>
          <YearFilter
            value={selectedYear}
            onChange={onYearChange}
            years={availableYears}
            label={tx("Filtrar por año")}
            allLabel={tx("Histórico (Todos)")}
          />
        </div>

        <KpiGrid>
          <KpiMetric
            className="col-span-2 p-5 lg:col-span-1"
            label={tx("Proyectos")}
            value={projectStats.total}
            caption={
              <>
                <span className="font-semibold text-info">{projectStats.active}</span> {tx("activos")} ·{" "}
                <span className="font-semibold text-status-done">{projectStats.completed}</span> {tx("concluidos")}
              </>
            }
          >
            <ProgressBar
              status="done"
              value={toPercent(projectStats.completed, projectStats.total)}
              label={tx("Proyectos concluidos")}
            />
          </KpiMetric>

          <KpiMetric
            className="p-5"
            label={tx("Total turbinas")}
            value={turbineStats.total}
            caption={tx("Asignadas en {{year}}", { year: selectedYear })}
            icon={<Wind size={18} />}
          >
            <ProgressBar status="pending" value={turbineStats.total > 0 ? 100 : 0} label={tx("Total turbinas")} />
          </KpiMetric>
          <KpiMetric
            className="p-5"
            label={tx("Inspeccionadas")}
            value={turbineStats.completed}
            caption={tx("Reportes listos")}
            trailing={formatPercent(pctInspected)}
            trailingClassName="text-status-done"
            icon={<CheckCircle2 size={18} />}
            iconClassName="text-status-done"
          >
            <ProgressBar status="done" value={pctInspected} label={tx("Turbinas inspeccionadas")} />
          </KpiMetric>
          <KpiMetric
            className="p-5"
            label={tx("En progreso")}
            value={turbineStats.inProgress}
            caption={tx("Captura en campo")}
            trailing={formatPercent(pctInProgress)}
            trailingClassName="text-status-progress"
            icon={<Clock size={18} />}
            iconClassName="text-status-progress"
          >
            <ProgressBar status="progress" value={pctInProgress} label={tx("Turbinas en progreso")} />
          </KpiMetric>
          <KpiMetric
            className="p-5"
            label={tx("Pendientes")}
            value={pendingTurbines}
            caption={tx("Sin iniciar")}
            trailing={formatPercent(pctPending)}
            trailingClassName="text-status-alert"
            icon={<AlertTriangle size={18} />}
            iconClassName="text-status-alert"
          >
            <ProgressBar status="alert" value={pctPending} label={tx("Turbinas pendientes")} />
          </KpiMetric>
        </KpiGrid>
      </BentoCard>
    </Reveal>
  );
};

export default ProjectSummaryPanel;
