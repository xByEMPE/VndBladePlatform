import { tx } from "@/i18n/tx";
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import {
  FolderKanban,
  BarChart3,
  Wind,
  Shield,
  Sliders,
  BookOpen,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { fetchFilteredProjects } from "@/utils/projectFiltering";
import { toPercent, percentOf, formatPercent } from "@/lib/gauge";
import LoadingSpinner from "@/components/LoadingSpinner";
import PageHeader from "@/components/layout/PageHeader";
import BentoCard from "@/components/ui/BentoCard";
import KpiGrid from "@/components/ui/KpiGrid";
import KpiMetric from "@/components/ui/KpiMetric";
import Overline from "@/components/ui/Overline";
import ProgressBar from "@/components/ui/ProgressBar";
import Reveal from "@/components/ui/Reveal";
import ModuleLink from "@/components/dashboard/ModuleLink";
import RecentActivityCard from "@/components/dashboard/RecentActivityCard";
import YearFilter from "@/components/dashboard/YearFilter";

const DashboardPage = ({ role: propRole }) => {
  const navigate = useNavigate();
  const { role: hookRole, isAdmin } = useRolePermissions();

  const effectiveRole = propRole || hookRole;
  const isUserAdmin = effectiveRole === "admin" || (typeof isAdmin === "function" ? isAdmin() : false);

  const [loading, setLoading] = useState(true);
  const [allProjects, setAllProjects] = useState([]);
  const [recentProjects, setRecentProjects] = useState([]);

  // Filtro de años
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [availableYears, setAvailableYears] = useState([]);

  useEffect(() => {
    const initDashboard = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();

        if (user && effectiveRole) {
          const filteredProjects = await fetchFilteredProjects(user, effectiveRole);
          setAllProjects(filteredProjects);

          // Extraer años únicos para el filtro
          const years = new Set();
          filteredProjects.forEach(p => {
            const dateStr = p.start_date || p.created_at;
            if (dateStr) {
              years.add(new Date(dateStr).getFullYear().toString());
            }
          });

          const sortedYears = Array.from(years).sort((a, b) => b - a);
          setAvailableYears(sortedYears);

          // Si el año actual no está en los datos, por defecto mostrar "Todos" o el más reciente
          if (!sortedYears.includes(new Date().getFullYear().toString()) && sortedYears.length > 0) {
            setSelectedYear(sortedYears[0]);
          }

          setRecentProjects(
            [...filteredProjects]
              .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
              .slice(0, 4)
          );
        }
      } catch (error) {
        console.error("Dashboard init error:", error);
      } finally {
        setLoading(false);
      }
    };

    initDashboard();
  }, [effectiveRole]);

  // Cálculos reactivos basados en el filtro de año
  const dashboardData = useMemo(() => {
    const filtered = selectedYear === "Todos"
      ? allProjects
      : allProjects.filter(p => {
          const dateStr = p.start_date || p.created_at;
          return dateStr && new Date(dateStr).getFullYear().toString() === selectedYear;
        });

    const active = filtered.filter(p => p.status !== 'Completado' && p.status !== 'Cancelado');
    const completed = filtered.filter(p => p.status === 'Completado');
    const totalWTG = filtered.reduce((sum, p) => sum + (p.turbine_count || 0), 0);

    return {
      projectStats: {
        total: filtered.length,
        active: active.length,
        completed: completed.length
      },
      turbineStats: {
        total: totalWTG,
        completed: Math.floor(totalWTG * 0.4), // Placeholder para tu RPC
        inProgress: Math.floor(totalWTG * 0.2) // Placeholder
      }
    };
  }, [allProjects, selectedYear]);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background">
        <LoadingSpinner size="lg" text={tx("Iniciando centro de operaciones...")} />
      </div>
    );
  }

  const { projectStats, turbineStats } = dashboardData;
  const pendingTurbines = Math.max(0, turbineStats.total - turbineStats.completed - turbineStats.inProgress);
  const pctInspected = percentOf(turbineStats.completed, turbineStats.total);
  const pctInProgress = percentOf(turbineStats.inProgress, turbineStats.total);
  const pctPending = percentOf(pendingTurbines, turbineStats.total);

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-[calc(100vh-4rem)] w-full bg-background p-4 text-ink sm:p-8">
        <div className="mx-auto max-w-7xl space-y-6">

          {/* Encabezado */}
          <Reveal>
            {/* El encabezado va dentro de un recuadro (tarjeta bento plana), como en el diseño de referencia */}
            <BentoCard flat className="p-5 sm:p-6">
              <PageHeader
                className="border-b-0 pb-0"
                icon={<Activity size={24} />}
                overline={tx("Gestión de activos eólicos")}
                title={isUserAdmin ? tx("Centro de Operaciones") : tx("Panel de Cliente")}
                description={isUserAdmin
                  ? tx("Monitorea el progreso de las inspecciones, gestiona equipos y visualiza reportes globales.")
                  : tx("Monitorea el progreso en tiempo real y descarga los reportes de inspección de tus activos.")}
              />
            </BentoCard>
          </Reveal>

          {/* Indicadores clave */}
          <Reveal delay={0.05}>
            <BentoCard as="section" flat aria-labelledby="kpi-title">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-5 py-3">
                <Overline as="h2" id="kpi-title" className="flex items-center gap-2 text-ink">
                  <FolderKanban size={14} className="text-info" aria-hidden="true" />
                  {isUserAdmin ? tx("Resumen de proyectos") : tx("Mis proyectos")}
                </Overline>
                <YearFilter
                  value={selectedYear}
                  onChange={setSelectedYear}
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

          {/* Módulos */}
          <Reveal delay={0.1}>
            <section aria-labelledby="modules-title">
              <Overline as="h2" id="modules-title" className="mb-3 block">{tx("Módulos")}</Overline>
              <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${isUserAdmin ? "lg:grid-cols-3 xl:grid-cols-5" : ""}`}>
                <ModuleLink
                  featured
                  title={tx("Progreso General")}
                  description={tx("Supervisa el avance por turbina, revisa estados y estatus operativos.")}
                  icon={<BarChart3 size={20} />}
                  onClick={() => navigate("/progress")}
                />
                <ModuleLink
                  title={tx("Portal de Reportes")}
                  description={tx("Accede a la descarga directa de reportes.")}
                  icon={<BookOpen size={20} />}
                  onClick={() => navigate("/reports-portal")}
                />
                {isUserAdmin && (
                  <>
                    <ModuleLink
                      title={tx("Inspecciones de Palas")}
                      description={tx("Crea nuevas campañas, asigna personal y configura parques.")}
                      icon={<FolderKanban size={20} />}
                      onClick={() => navigate("/projects")}
                    />
                    <ModuleLink
                      title={tx("Inspecciones LPS")}
                      description={tx("Crea nuevas campañas, asigna personal y configura parques.")}
                      icon={<Shield size={20} />}
                      onClick={() => navigate("/capture")}
                    />
                    <ModuleLink
                      title={tx("Generador WTG")}
                      description={tx("Calibra la geometría de la turbina con 2 fotos y genera el archivo .wtgm.")}
                      icon={<Sliders size={20} />}
                      onClick={() => navigate("/wtg-generator")}
                    />
                  </>
                )}
              </div>
            </section>
          </Reveal>

          {/* Actividad reciente */}
          <Reveal delay={0.15}>
            <RecentActivityCard
              projects={recentProjects}
              onOpenProject={(project) => navigate("/progress", { state: { selectedProject: project } })}
              onManageAll={isUserAdmin ? () => navigate("/projects") : undefined}
            />
          </Reveal>

        </div>
      </div>
    </MotionConfig>
  );
};

export default DashboardPage;
