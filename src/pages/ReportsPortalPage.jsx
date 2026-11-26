import { tx, dateLocale } from "@/i18n/tx";
import React, { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { motion, MotionConfig } from "framer-motion";
import {
  RefreshCw,
  Wind,
  Activity,
  FileText,
  FileDown,
  Eye,
  ChevronRight,
  MousePointerClick,
  FolderKanban,
} from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { isClientRole } from "./shared/roles";
import { fetchFilteredProjects } from "@/utils/projectFiltering";
import PageHeader from "@/components/layout/PageHeader";
import BentoCard from "@/components/ui/BentoCard";
import EmptyState from "@/components/ui/EmptyState";
import Overline from "@/components/ui/Overline";
import Pagination from "@/components/ui/Pagination";
import Reveal from "@/components/ui/Reveal";
import SearchField from "@/components/ui/SearchField";
import TypeTag from "@/components/ui/TypeTag";
import { BTN_BRAND_OUTLINE } from "@/lib/classes";
import {
  OVERLINE,
  INPUT,
  BTN_SECONDARY,
  FADE,
  StatusTag,
} from "@/components/projects/formKit";

const PAGE_SIZES = [10, 25, 50];
const REPORT_COLS = "md:grid-cols-[minmax(0,1fr)_9rem_16rem]";
const PROJECT_TYPES = [
  { value: "all", label: "Todos los tipos" },
  { value: "DRONE", label: "Palas (dron)" },
  { value: "LPS", label: "LPS" },
];

const projectType = (p) => p.project_type || "DRONE";

const ReportsPortalPage = () => {
  const { t } = useTranslation("common");
  const { role } = useRolePermissions();
  const [currentUser, setCurrentUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);

  // Aerogeneradores del proyecto seleccionado
  const [turbines, setTurbines] = useState([]);
  const [loadingTurbines, setLoadingTurbines] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(PAGE_SIZES[0]);
  const [currentPage, setCurrentPage] = useState(1);

  // Filtros del listado de proyectos
  const [projectSearch, setProjectSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const reportsPanelRef = useRef(null);
  const requestRef = useRef(0);

  useEffect(() => {
    getCurrentUser();
  }, []);
  useEffect(() => {
    if (currentUser && role) fetchProjects();
  }, [currentUser, role]);
  useEffect(() => {
    if (selectedProject) fetchTurbinesData();
  }, [selectedProject]);

  const getCurrentUser = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUser(user);
    } catch (error) {
      console.error("Error getting current user:", error);
    }
  };

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const filteredProjects = await fetchFilteredProjects(currentUser, role);
      setProjects(filteredProjects || []);
    } catch (error) {
      toast({
        title: t("messages.errorLoadingProject"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTurbinesData = async () => {
    if (!selectedProject) return;
    const requestId = ++requestRef.current;
    try {
      setLoadingTurbines(true);
      const isLps = selectedProject.project_type === "LPS";

      const { data, error } = await supabase
        .from("turbines")
        .select(
          isLps
            ? "id, turbine_name, status, inspection_date, lps_data"
            : "id, turbine_name, status, inspection_date",
        )
        .eq("project_id", selectedProject.id)
        .order("turbine_name", { ascending: true });
      if (error) throw error;

      let rows = data || [];
      if (isClientRole(role)) {
        rows = rows.filter((row) => row.status === "Aprobado");
      }

      // Ignora respuestas de un proyecto anterior si el usuario ya eligió otro
      if (requestId !== requestRef.current) return;

      setTurbines(
        rows.map((row) => ({
          id: row.id,
          name: row.turbine_name,
          inspectionDate: row.inspection_date
            ? new Date(row.inspection_date).toLocaleDateString(dateLocale(), { day: "2-digit", month: "2-digit", year: "numeric" })
            : "—",
          isLps,
          // En LPS solo hay reporte si ya se guardó la inspección
          hasReport: isLps
            ? !!(row.lps_data && Object.keys(row.lps_data).length > 0)
            : true,
        })),
      );
      setCurrentPage(1);
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      if (requestId === requestRef.current) setLoadingTurbines(false);
    }
  };

  const selectProject = (project) => {
    setSelectedProject(project);
    setTurbines([]);
    setSearchTerm("");
    setCurrentPage(1);
    // En pantallas de una columna, llevar al usuario al listado de reportes
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1279px)").matches) {
      requestAnimationFrame(() =>
        reportsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  };

  const reportUrl = (turbine) =>
    `${window.location.origin}/${turbine.isLps ? "lps-viewer" : "report-viewer"}/${selectedProject.id}/${encodeURIComponent(turbine.name)}`;

  // --- Datos derivados para la vista ---
  const projectQuery = projectSearch.trim().toLowerCase();
  const visibleProjects = projects.filter((p) => {
    const matchesType = typeFilter === "all" || projectType(p) === typeFilter;
    const matchesSearch =
      !projectQuery ||
      [p.name, p.client, p.wind_farm].some((v) => (v || "").toLowerCase().includes(projectQuery));
    return matchesType && matchesSearch;
  });

  const turbineQuery = searchTerm.trim().toLowerCase();
  const filteredTurbines = turbines.filter(
    (tb) => !turbineQuery || (tb.name || "").toLowerCase().includes(turbineQuery),
  );
  const totalPages = Math.max(1, Math.ceil(filteredTurbines.length / itemsPerPage));
  const page = Math.min(currentPage, totalPages);
  const startIndex = (page - 1) * itemsPerPage;
  const pageRows = filteredTurbines.slice(startIndex, startIndex + itemsPerPage);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <Helmet>
        <title>{tx("Portal de Reportes - VINDGROUP")}</title>
      </Helmet>

      <div className="min-h-[calc(100vh-4rem)] w-full bg-background p-4 text-ink sm:p-8">
        <div className="w-full space-y-6">

          {/* Encabezado */}
          <Reveal>
            <PageHeader
              icon={<FileText size={24} />}
              overline={tx("Gestión de activos eólicos")}
              title={tx("Portal de Reportes")}
              description={tx("Visualización de informes técnicos por proyecto y turbina")}
            />
          </Reveal>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(340px,420px)_1fr] xl:items-start">

            {/* Paso 1: proyectos */}
            <BentoCard
              as={motion.section}
              flat
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...FADE, delay: 0.05 }}
              aria-labelledby="projects-title"
              className="flex flex-col xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)]"
            >
              <div className="space-y-3 border-b border-line-subtle px-4 py-4">
                <h2 id="projects-title" className={OVERLINE}>
                  {tx("1. Selecciona un proyecto")}
                  <span className="ml-2 tabular-nums text-ink-muted">
                    ({visibleProjects.length}
                    {visibleProjects.length !== projects.length ? ` / ${projects.length}` : ""})
                  </span>
                </h2>
                <SearchField
                  value={projectSearch}
                  onChange={setProjectSearch}
                  label={tx("Buscar proyecto")}
                  placeholder={tx("Buscar proyecto o cliente")}
                />
                <label className="block">
                  <span className="sr-only">{tx("Filtrar por tipo de proyecto")}</span>
                  <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={INPUT}>
                    {PROJECT_TYPES.map((o) => (
                      <option key={o.value} value={o.value}>{tx(o.label)}</option>
                    ))}
                  </select>
                </label>
              </div>

              {projects.length === 0 ? (
                <EmptyState>{tx("No hay proyectos disponibles")}</EmptyState>
              ) : visibleProjects.length === 0 ? (
                <EmptyState>{tx("Ningún proyecto coincide con los filtros")}</EmptyState>
              ) : (
                <ul className="space-y-2 overflow-y-auto p-3">
                  {visibleProjects.map((project) => {
                    const active = selectedProject?.id === project.id;
                    return (
                      <li key={project.id}>
                        <BentoCard
                          as="button"
                          active={active}
                          aria-pressed={active}
                          onClick={() => selectProject(project)}
                          className="group flex w-full items-start gap-3 p-3.5 text-left"
                        >
                          <span
                            aria-hidden="true"
                            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line-subtle bg-surface-card"
                          >
                            {projectType(project) === "LPS"
                              ? <Activity size={16} className="text-status-alert" />
                              : <Wind size={16} className="text-status-progress" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium text-ink">{project.name}</span>
                              <TypeTag>{projectType(project)}</TypeTag>
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-ink-muted">
                              {project.wind_farm || "N/A"} · {project.client || "N/A"}
                            </span>
                            <span className="mt-1.5 block">
                              <StatusTag status={project.status || "Planeación"} />
                            </span>
                          </span>
                          <ChevronRight
                            size={16}
                            aria-hidden="true"
                            className={`mt-2.5 shrink-0 transition-transform duration-bento ease-elastic group-hover:translate-x-0.5 ${active ? "text-brand" : "text-ink-muted group-hover:text-ink"}`}
                          />
                        </BentoCard>
                      </li>
                    );
                  })}
                </ul>
              )}
            </BentoCard>

            {/* Paso 2: reportes disponibles */}
            <BentoCard
              as={motion.section}
              flat
              ref={reportsPanelRef}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...FADE, delay: 0.1 }}
              aria-labelledby="reports-title"
              className="scroll-mt-4"
            >
              {!selectedProject ? (
                <div className="flex flex-col items-center justify-center px-4 py-20 text-center text-ink-muted">
                  <MousePointerClick size={30} className="mb-3 text-brand/70" aria-hidden="true" />
                  <h2 id="reports-title" className="text-base font-semibold text-ink">{tx("Reportes disponibles")}</h2>
                  <p className="mt-1 max-w-sm text-sm">
                    {tx("Selecciona un proyecto de la lista para ver sus turbinas y abrir los reportes.")}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-subtle px-4 py-4 sm:px-5">
                    <div className="min-w-0">
                      <Overline as="p">{tx("2. Reportes disponibles")}</Overline>
                      <h2 id="reports-title" className="mt-1 flex flex-wrap items-center gap-2 text-lg font-semibold text-ink">
                        <span className="truncate">{selectedProject.name}</span>
                        <TypeTag>{projectType(selectedProject)}</TypeTag>
                      </h2>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <FolderKanban size={14} aria-hidden="true" />
                          {selectedProject.wind_farm || "N/A"}
                        </span>
                        <span>{tx("Cliente:")} {selectedProject.client || "N/A"}</span>
                      </p>
                    </div>
                    <button type="button" onClick={fetchTurbinesData} disabled={loadingTurbines} className={BTN_SECONDARY}>
                      <RefreshCw size={15} className={loadingTurbines ? "animate-spin" : ""} aria-hidden="true" />
                      {tx("Actualizar")}
                    </button>
                  </div>

                  <div className="border-b border-line-subtle px-4 py-3 sm:px-5">
                    <SearchField
                      value={searchTerm}
                      onChange={(v) => {
                        setSearchTerm(v);
                        setCurrentPage(1);
                      }}
                      label={tx("Buscar turbina")}
                      placeholder={tx("Buscar turbina")}
                      className="sm:max-w-sm"
                    />
                  </div>

                  {loadingTurbines ? (
                    <div className="flex items-center justify-center py-16">
                      <LoadingSpinner size="lg" />
                    </div>
                  ) : filteredTurbines.length === 0 ? (
                    <EmptyState className="py-14">
                      {turbines.length === 0 ? tx("No se encontraron turbinas.") : tx("Ninguna turbina coincide con la búsqueda.")}
                    </EmptyState>
                  ) : (
                    <>
                      <div
                        aria-hidden="true"
                        className={`hidden gap-4 border-b border-line-subtle px-7 py-2.5 md:grid ${REPORT_COLS}`}
                      >
                        <span className={OVERLINE}>{tx("Turbina (WTG)")}</span>
                        <span className={OVERLINE}>{tx("Inspección")}</span>
                        <span className={`${OVERLINE} text-center`}>{tx("Acción")}</span>
                      </div>

                      <ul className="space-y-2 p-3">
                        {pageRows.map((turbine) => (
                          <li key={turbine.id}>
                            <BentoCard
                              className={`grid grid-cols-1 items-center gap-3 px-4 py-3 md:gap-4 ${REPORT_COLS}`}
                            >
                              <div className="flex items-center justify-between gap-3 md:block">
                                <span className="truncate text-sm font-semibold text-ink">{turbine.name}</span>
                                <span className="font-mono text-xs tabular-nums text-ink-muted md:hidden">{turbine.inspectionDate}</span>
                              </div>
                              <div className="hidden font-mono text-sm tabular-nums text-ink md:block">{turbine.inspectionDate}</div>
                              <div className="md:text-center">
                                {turbine.hasReport ? (
                                  <a
                                    href={reportUrl(turbine)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`${BTN_BRAND_OUTLINE} w-full`}
                                  >
                                    {turbine.isLps ? (
                                      <Eye size={15} aria-hidden="true" />
                                    ) : (
                                      <FileDown size={15} aria-hidden="true" />
                                    )}
                                    {turbine.isLps ? tx("Ver inspección LPS") : t("reports.downloadReport", "Descargar reporte")}
                                  </a>
                                ) : (
                                  <span className="inline-flex h-10 items-center justify-center whitespace-nowrap text-xs italic text-ink-muted">
                                    {tx("Sin reporte guardado")}
                                  </span>
                                )}
                              </div>
                            </BentoCard>
                          </li>
                        ))}
                      </ul>

                      <Pagination
                        rangeText={`${startIndex + 1}–${Math.min(startIndex + itemsPerPage, filteredTurbines.length)} de ${filteredTurbines.length}`}
                        perPageLabel={tx("Por página")}
                        pageSize={itemsPerPage}
                        pageSizes={PAGE_SIZES}
                        onPageSizeChange={(n) => {
                          setItemsPerPage(n);
                          setCurrentPage(1);
                        }}
                        page={page}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        pageText={tx("Página {{page}} / {{total}}", { page, total: totalPages })}
                        prevLabel={tx("Página anterior")}
                        nextLabel={tx("Página siguiente")}
                      />
                    </>
                  )}
                </>
              )}
            </BentoCard>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
};

export default ReportsPortalPage;
