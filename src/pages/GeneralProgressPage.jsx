// src/pages/GeneralProgressPage.jsx
import { tx, dateLocale } from "@/i18n/tx";
import React, { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { useLocation } from "react-router-dom";
import {
  Trash2,
  CheckCircle2,
  Loader,
  AlertCircle,
  Wind,
  X,
  Eye,
  ChevronRight,
  Activity,
  BarChart3,
  Users,
  Calendar,
  Check,
  Clock,
  RefreshCw,
  FolderKanban,
  Camera,
} from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { supabase } from "@/lib/supabase";
import { getProjectById } from "./shared/data";
import { toast } from "@/components/ui/use-toast";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { useProjectMapData } from "@/hooks/useProjectMapData";
import { buildMapItems } from "@/lib/mapItems";
import { signImageUrl } from "@/lib/storageUrls";
import TurbineMapSection from "@/components/maps/TurbineMapSection";
import { isClientRole } from "./shared/roles";
import { fetchFilteredProjects } from "@/utils/projectFiltering";
import PageHeader from "@/components/layout/PageHeader";
import BentoCard from "@/components/ui/BentoCard";
import EmptyState from "@/components/ui/EmptyState";
import KpiGrid from "@/components/ui/KpiGrid";
import KpiMetric from "@/components/ui/KpiMetric";
import Metric from "@/components/ui/Metric";
import Overline from "@/components/ui/Overline";
import ProgressBar from "@/components/ui/ProgressBar";
import RadialGauge from "@/components/ui/RadialGauge";
import Reveal from "@/components/ui/Reveal";
import SearchField from "@/components/ui/SearchField";
import StatusBadge from "@/components/ui/StatusBadge";
import TypeTag from "@/components/ui/TypeTag";
import { BTN_BRAND_OUTLINE, BTN_SECONDARY, FADE, FOCUS } from "@/lib/classes";
import { formatPercent, percentOf, toPercent } from "@/lib/gauge";
import { getStatus } from "@/lib/status";

const GeneralProgressPage = () => {
  const { t } = useTranslation("common");
  const { role } = useRolePermissions();
  const isAdminRole = role === "admin" || role === "dev";
  const [currentUser, setCurrentUser] = useState(null);
  
  const location = useLocation(); // <-- AGREGADO: Instancia de useLocation

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingTurbines, setLoadingTurbines] = useState(false);

  const [masterTurbinesCount, setMasterTurbinesCount] = useState(0);
  const isLpsProject = selectedProject?.project_type === "LPS";

  const [stats, setStats] = useState({
    totalProjects: 0,
    totalTurbines: 0,
    completedProjects: 0,
    inProgressProjects: 0,
  });

  const [projectTurbines, setProjectTurbines] = useState([]);
  const [turbineStatusMap, setTurbineStatusMap] = useState({});
  const [turbineApprovalMap, setTurbineApprovalMap] = useState({});
  const [turbineSort, setTurbineSort] = useState({ field: "name", dir: "asc" });

  const sortedTurbines = [...projectTurbines].sort((a, b) => {
    if (turbineSort.field === "name") {
      const cmp = (a.turbine_name || "").localeCompare(
        b.turbine_name || "",
        undefined,
        { numeric: true, sensitivity: "base" },
      );
      return turbineSort.dir === "asc" ? cmp : -cmp;
    } else {
      const da = a.inspection_date ? new Date(a.inspection_date).getTime() : 0;
      const db = b.inspection_date ? new Date(b.inspection_date).getTime() : 0;
      return turbineSort.dir === "asc" ? da - db : db - da;
    }
  });

  const [projectCompleteData, setProjectCompleteData] = useState(null);
  const [projectStats, setProjectStats] = useState({
    totalTurbines: 0,
    completedTurbines: 0,
    inProgressTurbines: 0,
    pendingTurbines: 0,
    totalBlades: 0,
    inspectedBlades: 0,
    totalDamages: 0,
    criticalDamages: 0,
    turbineBladeSectionMap: {},
  });

  // NAVEGACIÓN A NIVEL DE DOM
  const handleLpsClick = (turbine, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const tName = encodeURIComponent(turbine.turbine_name || turbine.name);
    const url = `${window.location.origin}/lps-viewer/${selectedProject.id}/${tName}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const translateStatus = (status) => {
    const s = (status || "").toString().trim().toLowerCase();
    if (["completado", "completed"].includes(s)) return t("status.completed");
    if (["en progreso", "in progress"].includes(s)) return t("status.inProgress");
    if (["revisión", "review"].includes(s)) return t("status.review");
    if (["pausado", "paused"].includes(s)) return t("status.paused");
    if (["cancelado", "cancelled", "canceled"].includes(s)) return t("status.cancelled");
    if (["planeación", "planning", "planned"].includes(s)) return t("status.planning");
    if (["pendiente", "pending"].includes(s)) return t("status.pending");
    return status;
  };


  // Estado visual (clave de lib/status.js) a partir del texto de estado ya traducido
  const getStatusKey = (status) => {
    const s = translateStatus(status);
    if (s === t("status.completed")) return "done";
    if (s === t("status.inProgress")) return "progress";
    if (s === t("status.paused")) return "alert";
    if (s === t("status.cancelled")) return "cancelled";
    if (s === t("status.review")) return "review";
    return "pending";
  };

  // Estado local de la capa visual (búsqueda y filtro)
  const [projectSearch, setProjectSearch] = useState("");
  const [turbineFilter, setTurbineFilter] = useState("all");
  const closeButtonRef = useRef(null);

  const calculateProjectProgress = () => {
    const totalTurbines = projectStats.totalTurbines || projectCompleteData?.turbine_count || 1;
    if (totalTurbines === 0) return 0;
    return Math.round((projectStats.completedTurbines / totalTurbines) * 100);
  };

  const calculateTurbineProgress = (turbine) => {
    if (isLpsProject) {
      const hasReport = turbine.lps_data && Object.keys(turbine.lps_data).length > 0;
      return hasReport || turbine.status === "Completado" || turbine.status === "Aprobado" ? 100 : 0;
    }
    
    // Un reporte aprobado por el admin cuenta como completado
    if (turbineApprovalMap[turbine.id] === true) return 100;

    // 1. Usar el porcentaje real calculado por nuestra base de datos (RPC)
    if (projectStats.turbineProgressMap && projectStats.turbineProgressMap[turbine.id] !== undefined) {
      return projectStats.turbineProgressMap[turbine.id];
    }
    
    // 2. Fallback de seguridad por si el mapa aún no carga
    const s = translateStatus(turbineStatusMap[turbine.id]);
    if (s === t("status.completed")) return 100;
    if (s === t("status.inProgress")) return 60;
    if (s === t("status.pending")) return 0;
    return 0; 
  };

  const closeProjectDetails = () => {
    detailsRequestRef.current++; // invalida cualquier carga en curso
    setLoadingTurbines(false);
    setSelectedProject(null);
    setProjectCompleteData(null);
    setProjectTurbines([]);
    setMasterTurbinesCount(0);
    setProjectStats({
      totalTurbines: 0, completedTurbines: 0, inProgressTurbines: 0, pendingTurbines: 0, totalBlades: 0, inspectedBlades: 0, totalDamages: 0, criticalDamages: 0, turbineBladeSectionMap: {},
    });
  };

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    } catch (error) { }
  };

  // Solo la primera carga muestra el spinner a pantalla completa: las recargas posteriores (cambio de rol,
  // eventos de sincronización) no deben desmontar el diálogo de turbinas que el usuario tiene abierto.
  const projectsLoadedRef = useRef(false);
  // Identifica la última carga de detalles: una respuesta tardía de otra carga no debe pisar la lista actual.
  const detailsRequestRef = useRef(0);

  const fetchProjectsData = async () => {
    try {
      if (!projectsLoadedRef.current) setLoading(true);
      const filteredProjects = await fetchFilteredProjects(currentUser, role);
      projectsLoadedRef.current = true;
      setProjects(filteredProjects);

      if (filteredProjects?.length) {
        const totalProjects = filteredProjects.length;
        const totalTurbines = filteredProjects.reduce((a, p) => a + (p.turbine_count || 0), 0);
        const completedProjects = filteredProjects.filter((p) => translateStatus(p.status) === t("status.completed")).length;
        const inProgressProjects = filteredProjects.filter((p) => translateStatus(p.status) === t("status.inProgress")).length;
        setStats({ totalProjects, totalTurbines, completedProjects, inProgressProjects });
      }
    } catch (err) {
      toast({ title: t("messages.errorLoadingProjects"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectDetails = async () => {
    if (!selectedProject) return;
    const requestId = ++detailsRequestRef.current;
    const isStale = () => requestId !== detailsRequestRef.current;
    setLoadingTurbines(true);
    try {
      const { data: projectData, error: projectError } = await getProjectById(selectedProject.id);
      if (projectError) throw projectError;
      if (isStale()) return;
      setProjectCompleteData(projectData);

      const isLPS = projectData.project_type === "LPS";

      if (isLPS) {
        const { data: lpsTurbines, error: lpsErr } = await supabase.from("turbines").select("id, turbine_name, status, inspection_date, lps_data").eq("project_id", selectedProject.id).order("turbine_name", { ascending: true });
        if (lpsErr) throw lpsErr;
        if (isStale()) return;

        let totalMasterCount = projectData.turbine_count || 1;
        if (projectData.wind_farm) {
          const { data: farmData } = await supabase.from("wind_farms").select("id").ilike("name", projectData.wind_farm.trim()).single();
          if (farmData) {
            const { count } = await supabase.from("wind_turbines").select("id", { count: "exact", head: true }).eq("farm_id", farmData.id);
            totalMasterCount = count || totalMasterCount;
          }
        }
        setMasterTurbinesCount(totalMasterCount);

        let allTurbines = lpsTurbines || [];
        if (isClientRole(role)) {
          allTurbines = allTurbines.filter((turb) => turb.status === "Aprobado");
        }
        setProjectTurbines(allTurbines);

        const completed = allTurbines.filter((turb) => turb.status === "Completado" || turb.status === "Aprobado" || (turb.lps_data && Object.keys(turb.lps_data).length > 0)).length;
        const inProgress = allTurbines.filter((turb) => turb.status === "En progreso").length;
        const pending = Math.max(0, totalMasterCount - completed - inProgress);

        let turbineStatus = {};
        let approvalStatus = {};
        allTurbines.forEach((turb) => {
          const hasData = turb.lps_data && Object.keys(turb.lps_data).length > 0;
          if (turb.status === "Completado" || turb.status === "Aprobado" || hasData) turbineStatus[turb.id] = t("status.completed");
          else if (turb.status === "En progreso") turbineStatus[turb.id] = t("status.inProgress");
          else turbineStatus[turb.id] = t("status.pending");

          approvalStatus[turb.id] = turb.status === "Aprobado";
        });
        setTurbineStatusMap(turbineStatus);
        setTurbineApprovalMap(approvalStatus);

        setProjectStats({ totalTurbines: totalMasterCount, completedTurbines: completed, inProgressTurbines: inProgress, pendingTurbines: pending, totalBlades: 0, inspectedBlades: 0, totalDamages: 0, criticalDamages: 0, turbineBladeSectionMap: {} });
      
      } else { 
      
        // --- 1. Obtener lista de turbinas ---
        const { data: existingTurbinesData, error: turbinesError } = await supabase
          .from("turbines")
          .select("id, turbine_name, status, model, coordinates, inspection_date, id_image_path")
          .eq("project_id", selectedProject.id)
          .order("turbine_name", { ascending: true });
        
        if (turbinesError) throw turbinesError;
        if (isStale()) return;

        let allTurbines = [...(existingTurbinesData || [])];
        if (isClientRole(role)) {
          allTurbines = allTurbines.filter((turb) => turb.status === "Aprobado");
        }
        setProjectTurbines(allTurbines);

        // --- 2. LLAMADA AL RPC EN SQL (Reemplaza los loops While) ---
        const { data: statsData, error: statsError } = await supabase
          .rpc('get_project_progress', { p_project_id: selectedProject.id });
          
        if (statsError) throw statsError;
        if (isStale()) return;

        // --- 3. Procesar las estadísticas ---
        let completedTurbines = 0, inProgressTurbines = 0, pendingTurbines = 0;
        let inspectedBlades = 0;
        let turbineStatus = {};
        let approvalStatus = {};
        let turbineBladeSectionMap = {};
        let turbineProgressMap = {};

        // Convertir array de SQL a mapa para búsqueda rápida
        const statsMap = {};
        (statsData || []).forEach(row => { statsMap[row.turbine_id] = row; });

        allTurbines.forEach((turbine) => {
          const stat = statsMap[turbine.id] || { completed_sections: 0, blade_sections: {} };
          
          turbineBladeSectionMap[turbine.id] = stat.blade_sections;
          
          // Contar palas que tienen al menos 1 sección
          inspectedBlades += Object.keys(stat.blade_sections).length;

          // REGLA DEL 100%: 12 secciones requeridas
          const REQUIRED_SECTIONS = 12;
          const progressPercent = Math.min(100, Math.round((stat.completed_sections / REQUIRED_SECTIONS) * 100));
          turbineProgressMap[turbine.id] = progressPercent;

          if (stat.completed_sections >= REQUIRED_SECTIONS || turbine.status === "Aprobado") { 
            turbineStatus[turbine.id] = t("status.completed"); 
            completedTurbines++; 
          }
          else if (stat.completed_sections > 0) { 
            turbineStatus[turbine.id] = t("status.inProgress"); 
            inProgressTurbines++; 
          }
          else { 
            turbineStatus[turbine.id] = t("status.pending"); 
            pendingTurbines++; 
          }
          approvalStatus[turbine.id] = turbine.status === "Aprobado";
        });

        const totalTurbinesCount = Math.max(projectData?.turbine_count || 0, allTurbines.length || 0);
        pendingTurbines = Math.max(0, totalTurbinesCount - (completedTurbines + inProgressTurbines));

        setTurbineStatusMap(turbineStatus);
        setTurbineApprovalMap(approvalStatus);

        setProjectStats({ 
          totalTurbines: totalTurbinesCount, 
          completedTurbines, 
          inProgressTurbines, 
          pendingTurbines, 
          totalBlades: totalTurbinesCount * 3, 
          inspectedBlades, 
          turbineBladeSectionMap,
          turbineProgressMap
        }); 
      } 
    } catch (error) {
      if (!isStale()) toast({ title: t("messages.errorLoadingDetails"), description: error.message, variant: "destructive" });
    } finally {
      if (!isStale()) setLoadingTurbines(false);
    }
  };

  const handleDeleteTurbine = async (turbine, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!window.confirm(tx("¿Estás seguro de eliminar el reporte de {{name}}? Los datos se perderán y la máquina volverá a estado Pendiente.", { name: turbine.turbine_name || turbine.name }))) return;

    try {
      setLoadingTurbines(true);
      if (isLpsProject) {
        await supabase.from("turbines").delete().eq("id", turbine.id);
      } else {
        const turbineIdStr = String(turbine.id);
        const { data: blades } = await supabase.from("blades").select("id").eq("turbine_id", turbine.id);
        const bladeIds = (blades || []).map((b) => b.id);

        if (bladeIds.length > 0) {
          const { data: captures } = await supabase.from("captures").select("id").in("blade_id", bladeIds);
          const captureIds = (captures || []).map((c) => c.id);

          if (captureIds.length > 0) {
            await supabase.from("findings").delete().in("capture_id", captureIds);
            await supabase.from("captures").delete().in("id", captureIds);
          }
          await supabase.from("blades").delete().in("id", bladeIds);
        }

        const { data: files } = await supabase.storage.from("images").list(turbineIdStr);
        if (files && files.length > 0) {
          const pathsToRemove = files.map((f) => `${turbineIdStr}/${f.name}`);
          await supabase.storage.from("images").remove(pathsToRemove);
        }

        await supabase.from("turbines").delete().eq("id", turbine.id);
      }

      toast({ title: tx("Reporte Eliminado"), description: tx("El reporte de {{name}} ha sido eliminado con éxito.", { name: turbine.turbine_name || turbine.name }) });

      fetchProjectDetails();
      fetchProjectsData();
    } catch (error) {
      toast({ title: tx("Error al eliminar"), description: error.message, variant: "destructive" });
    } finally {
      setLoadingTurbines(false);
    }
  };

  // Acciones del mapa de turbinas (proyectos de dron): abrir el reporte en otra pestaña y eliminarlo (admin/dev).
  const handleOpenTurbineReport = (item) => {
    const url = `${window.location.origin}/report-viewer/${selectedProject?.id}/${encodeURIComponent(item.name)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };
  const handleDeleteFromMap = (item) => {
    const turbine = projectTurbines.find((x) => x.id === item.id);
    if (turbine) handleDeleteTurbine(turbine);
  };

  // Datos del mapa (RPC): independientes de fetchProjectDetails, para que un fallo no rompa el resto de la pantalla.
  // Se vuelven a pedir cuando cambia el número de turbinas (p. ej. tras eliminar un reporte).
  // `mapTick` sube con los eventos de sincronización/tiempo real: sin él, la severidad del mapa quedaría desactualizada
  // al crear o editar hallazgos hasta recargar la página.
  const [mapTick, setMapTick] = useState(0);
  const mapData = useProjectMapData(
    selectedProject?.id,
    Boolean(selectedProject) && !isLpsProject,
    `${projectTurbines.length}:${mapTick}`,
  );

  useEffect(() => { getCurrentUser(); }, []);
  useEffect(() => { if (currentUser && role) fetchProjectsData(); }, [currentUser, role]);
  useEffect(() => { if (selectedProject) fetchProjectDetails(); }, [selectedProject, role]);

  // --- AGREGADO: INTERCEPTAR PROYECTO DESDE EL DASHBOARD ---
  useEffect(() => {
    if (location.state?.selectedProject) {
      // Abre el modal asignando el proyecto
      setSelectedProject(location.state.selectedProject);
      
      // Limpia el estado para que al recargar la página no vuelva a abrirse
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const realtimeDebounceRef = useRef(null);

  useEffect(() => {
    const handleDataSync = () => {
      fetchProjectsData();
      if (selectedProject) {
        fetchProjectDetails();
        setMapTick((n) => n + 1);
      }
    };

    const debouncedFetchProjectDetails = () => {
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
      realtimeDebounceRef.current = setTimeout(() => {
        realtimeDebounceRef.current = null;
        if (selectedProject) {
          fetchProjectDetails();
          setMapTick((n) => n + 1);
        }
      }, 5000);
    };

    window.addEventListener("vind:data-synced", handleDataSync);
    window.addEventListener("vind:project-updated", handleDataSync);

    let channel;
    if (selectedProject) {
      channel = supabase
        .channel(`progress-realtime-${selectedProject.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "captures" }, debouncedFetchProjectDetails)
        .on("postgres_changes", { event: "*", schema: "public", table: "findings" }, debouncedFetchProjectDetails)
        .on("postgres_changes", { event: "*", schema: "public", table: "blades" }, debouncedFetchProjectDetails)
        .on("postgres_changes", { event: "*", schema: "public", table: "damages" }, debouncedFetchProjectDetails)
        .on("postgres_changes", { event: "*", schema: "public", table: "turbines", filter: `project_id=eq.${selectedProject.id}` }, debouncedFetchProjectDetails)
        .subscribe();
    }

    return () => {
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
      window.removeEventListener("vind:data-synced", handleDataSync);
      window.removeEventListener("vind:project-updated", handleDataSync);
      if (channel) supabase.removeChannel(channel);
    };
  }, [selectedProject]);


  // Accesibilidad del diálogo: cerrar con Escape y enfocar el botón de cierre
  useEffect(() => {
    if (!selectedProject) return undefined;
    setTurbineFilter("all");
    closeButtonRef.current?.focus();
    const onKeyDown = (e) => { if (e.key === "Escape") closeProjectDetails(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedProject]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" text={t("progress.loadingProgress")} />
      </div>
    );
  }


  // --- Datos derivados para la vista ---
  const query = projectSearch.trim().toLowerCase();
  const visibleProjects = query
    ? projects.filter((p) => [p.name, p.client, p.wind_farm].some((v) => (v || "").toLowerCase().includes(query)))
    : projects;

  const overallProgress = calculateProjectProgress();
  const turbineBucket = (turbine) => {
    const p = calculateTurbineProgress(turbine);
    return p >= 100 ? "completed" : p > 0 ? "inProgress" : "pending";
  };
  const filteredTurbines = sortedTurbines.filter((turb) => turbineFilter === "all" || turbineBucket(turb) === turbineFilter);
  const filterOptions = [
    { key: "all", label: t("progress.all"), count: sortedTurbines.length },
    { key: "completed", label: t("progress.completed"), count: sortedTurbines.filter((x) => turbineBucket(x) === "completed").length },
    { key: "inProgress", label: t("progress.inProgress"), count: sortedTurbines.filter((x) => turbineBucket(x) === "inProgress").length },
    { key: "pending", label: t("progress.pending"), count: sortedTurbines.filter((x) => turbineBucket(x) === "pending").length },
  ];
  // Items del mapa (dron). `projectTurbines` ya excluye lo que un cliente no puede ver (solo "Aprobado").
  const mapItems = isLpsProject
    ? []
    : buildMapItems({
        turbines: sortedTurbines,
        mapRows: mapData.rows,
        resolveStatus: (turbine) => {
          const label = turbineApprovalMap[turbine.id] === true
            ? t("status.completed")
            : translateStatus(turbineStatusMap[turbine.id] || turbine.status);
          return { key: getStatusKey(label), label };
        },
        canOpenReport: (turbine) => calculateTurbineProgress(turbine) === 100,
      });
  const detailName = projectCompleteData?.name || selectedProject?.name;
  const detailFarm = projectCompleteData?.wind_farm || selectedProject?.wind_farm || "N/A";
  const detailClient = projectCompleteData?.client || selectedProject?.client || "N/A";
  const detailStatus = projectCompleteData?.status || selectedProject?.status;

  // Porcentajes de la capa visual (a partir de los datos ya calculados arriba)
  const pctProjectsDone = percentOf(stats.completedProjects, stats.totalProjects);
  const pctProjectsRunning = percentOf(stats.inProgressProjects, stats.totalProjects);
  const segPct = (value) => percentOf(value, projectStats.totalTurbines);
  const turbineSegments = [
    { status: "done", value: segPct(projectStats.completedTurbines) },
    { status: "progress", value: segPct(projectStats.inProgressTurbines) },
    { status: "pending", value: segPct(projectStats.pendingTurbines) },
  ];
  const turbineSegmentsLabel = [
    `${t("progress.completed")}: ${projectStats.completedTurbines}`,
    `${t("progress.inProgress")}: ${projectStats.inProgressTurbines}`,
    `${t("progress.pending")}: ${projectStats.pendingTurbines}`,
  ].join(", ");
  const turbineTiles = [
    { label: t("projects.turbineCount"), value: projectStats.totalTurbines, dot: "bg-brand" },
    { label: t("progress.completed"), value: projectStats.completedTurbines, dot: getStatus("done").dot },
    { label: t("progress.inProgress"), value: projectStats.inProgressTurbines, dot: getStatus("progress").dot },
    { label: t("progress.pending"), value: projectStats.pendingTurbines, dot: getStatus("pending").dot },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <Helmet><title>{t("progress.title")} - VINDGROUP</title></Helmet>

      <div className="min-h-[calc(100vh-4rem)] w-full bg-background p-4 text-ink sm:p-8">
        <div className="mx-auto max-w-7xl space-y-6">

          {/* Encabezado */}
          <Reveal>
            <PageHeader
              icon={<BarChart3 size={24} />}
              overline={tx("Gestión de activos eólicos")}
              title={t("progress.titleFull")}
              description={t("progress.subtitle")}
              actions={
                <button type="button" onClick={fetchProjectsData} className={BTN_SECONDARY}>
                  <RefreshCw size={15} aria-hidden="true" />
                  {t("progress.refreshData")}
                </button>
              }
            />
          </Reveal>

          {/* Indicadores */}
          <Reveal delay={0.05}>
            <BentoCard as="section" flat aria-label={t("progress.overview")}>
              <KpiGrid className="lg:grid-cols-4">
                <KpiMetric className="p-5" label={t("progress.totalProjects")} value={stats.totalProjects} icon={<FolderKanban size={18} />}>
                  <ProgressBar status="pending" value={stats.totalProjects > 0 ? 100 : 0} label={t("progress.totalProjects")} />
                </KpiMetric>
                <KpiMetric className="p-5" label={t("progress.totalTurbines")} value={stats.totalTurbines} icon={<Wind size={18} />}>
                  <ProgressBar status="pending" value={stats.totalTurbines > 0 ? 100 : 0} label={t("progress.totalTurbines")} />
                </KpiMetric>
                <KpiMetric
                  className="p-5"
                  label={t("progress.completedProjects")}
                  value={stats.completedProjects}
                  trailing={formatPercent(pctProjectsDone)}
                  trailingClassName="text-status-done"
                  icon={<CheckCircle2 size={18} />}
                  iconClassName="text-status-done"
                >
                  <ProgressBar status="done" value={pctProjectsDone} label={t("progress.completedProjects")} />
                </KpiMetric>
                <KpiMetric
                  className="p-5"
                  label={t("progress.inProgress")}
                  value={stats.inProgressProjects}
                  trailing={formatPercent(pctProjectsRunning)}
                  trailingClassName="text-status-progress"
                  icon={<Loader size={18} />}
                  iconClassName="text-status-progress"
                >
                  <ProgressBar status="progress" value={pctProjectsRunning} label={t("progress.inProgress")} />
                </KpiMetric>
              </KpiGrid>
            </BentoCard>
          </Reveal>

          {/* Lista de proyectos */}
          <Reveal delay={0.1}>
            <BentoCard as="section" flat aria-labelledby="projects-title">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-5 py-3">
                <Overline as="h2" id="projects-title">
                  {t("progress.projectsList")} <span className="ml-1 tabular-nums">({visibleProjects.length})</span>
                </Overline>
                <SearchField
                  value={projectSearch}
                  onChange={setProjectSearch}
                  label={tx("Buscar proyecto")}
                  placeholder={tx("Buscar por proyecto, cliente o parque")}
                  className="w-full sm:w-72"
                />
              </div>

              {projects.length === 0 ? (
                <EmptyState icon={AlertCircle} className="py-16">{t("progress.noProjectsFound")}</EmptyState>
              ) : visibleProjects.length === 0 ? (
                <EmptyState>{tx("Ningún proyecto coincide con la búsqueda")}</EmptyState>
              ) : (
                <ul className="space-y-2 p-3">
                  {visibleProjects.map((project) => (
                    <li key={project.id}>
                      <BentoCard
                        as="button"
                        onClick={() => setSelectedProject(project)}
                        className="group grid w-full grid-cols-[1fr_auto] items-center gap-4 px-4 py-3 text-left sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto]"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line-subtle bg-surface-card">
                            {project.project_type === "LPS" ? <Activity size={18} className="text-status-alert" /> : <Wind size={18} className="text-status-progress" />}
                          </span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium text-ink">{project.name}</span>
                              <TypeTag>{project.project_type || "DRONE"}</TypeTag>
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-ink-muted sm:hidden">{project.wind_farm || "N/A"} · {project.client || "N/A"}</span>
                          </span>
                        </span>
                        <span className="hidden min-w-0 sm:block">
                          <Overline className="block">{t("progress.client")}</Overline>
                          <span className="block truncate text-sm text-ink">{project.client || "N/A"}</span>
                        </span>
                        <span className="hidden min-w-0 sm:block">
                          <Overline className="block">{t("progress.windFarm")}</Overline>
                          <span className="block truncate text-sm text-ink">{project.wind_farm || "N/A"}</span>
                        </span>
                        <StatusBadge status={getStatusKey(project.status)} label={translateStatus(project.status)} className="whitespace-nowrap" />
                        <ChevronRight size={18} aria-hidden="true" className="hidden text-ink-muted transition-transform duration-bento ease-elastic group-hover:translate-x-0.5 group-hover:text-brand sm:block" />
                      </BentoCard>
                    </li>
                  ))}
                </ul>
              )}
            </BentoCard>
          </Reveal>
        </div>
      </div>

      {/* Ventana emergente de proyecto */}
      <AnimatePresence>
        {selectedProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={FADE}
            className="fixed inset-0 z-50 flex items-center justify-center bg-surface-base/80 p-2 sm:p-4"
            onClick={closeProjectDetails}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="project-dialog-title"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={FADE}
              className="flex h-[95vh] w-[98vw] max-w-7xl flex-col overflow-hidden rounded-xl border border-line-subtle bg-surface-panel"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Cabecera */}
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line-subtle px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  <Overline as="p" className="flex items-center gap-2 text-info">
                    <span aria-hidden="true" className="inline-flex shrink-0">
                      {isLpsProject ? <Activity size={14} /> : <Wind size={14} />}
                    </span>
                    {t("progress.projectDetails")}
                  </Overline>
                  <h2 id="project-dialog-title" className="mt-1 truncate text-xl font-semibold text-ink sm:text-2xl">{detailName}</h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
                    <span>{detailFarm}</span>
                    <span>{tx("Cliente:")} {detailClient}</span>
                    <TypeTag>{selectedProject.project_type || "DRONE"}</TypeTag>
                    <StatusBadge status={getStatusKey(detailStatus)} label={translateStatus(detailStatus)} className="whitespace-nowrap" />
                  </div>
                </div>
                <button
                  type="button"
                  ref={closeButtonRef}
                  onClick={closeProjectDetails}
                  aria-label={tx("Cerrar")}
                  className={`rounded-md border border-line-subtle p-2 text-ink-muted transition-colors hover:border-line-medium hover:text-ink ${FOCUS}`}
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              {/* Cuerpo */}
              <div className="relative flex-1 overflow-y-auto p-5 sm:p-6">
                {loadingTurbines ? (
                  <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" text={t("progress.loadingTurbines")} /></div>
                ) : (
                  <div className="space-y-6">

                    {/* Estado general */}
                    <BentoCard as="section" flat aria-labelledby="overall-title">
                      <div className="border-b border-line-subtle px-5 py-3">
                        <Overline as="h3" id="overall-title">{tx("Estado general del avance")}</Overline>
                      </div>
                      <div className="grid gap-6 p-5 lg:grid-cols-[auto_1fr] lg:items-center">
                        <div className="flex items-center gap-5">
                          <RadialGauge value={overallProgress} size={128} strokeWidth={10} status="done" label={t("progress.projectProgress")} showLabel={false} />
                          <div>
                            <Overline as="p">{t("progress.projectProgress")}</Overline>
                            <p className="mt-1 text-sm tabular-nums text-ink">
                              <span className="font-semibold">{projectStats.completedTurbines}</span> de{" "}
                              <span className="font-semibold">{projectStats.totalTurbines}</span> turbinas completadas
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <ProgressBar segments={turbineSegments} label={turbineSegmentsLabel} />
                          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {turbineTiles.map((item) => (
                              <div key={item.label} className="rounded-md border border-line-subtle bg-surface-card/40 px-3 py-2.5">
                                <dt className="flex items-center gap-2 text-xs text-ink-muted">
                                  <span aria-hidden="true" className={`h-2 w-2 rounded-full ${item.dot}`} />
                                  {item.label}
                                </dt>
                                <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums text-ink">{item.value}</dd>
                              </div>
                            ))}
                          </dl>

                          {!isLpsProject && (
                            <div>
                              <div className="mb-1.5 flex items-center justify-between text-xs">
                                <span className="text-ink-muted">{t("progress.inspectedBlades")}</span>
                                <span className="font-mono font-semibold tabular-nums text-ink">{projectStats.inspectedBlades}/{projectStats.totalBlades}</span>
                              </div>
                              <ProgressBar status="progress" value={toPercent(projectStats.inspectedBlades, projectStats.totalBlades)} label={t("progress.inspectedBlades")} />
                            </div>
                          )}
                        </div>
                      </div>
                    </BentoCard>

                    {/* Información y equipo */}
                    <BentoCard as="section" flat aria-labelledby="info-title" className="grid lg:grid-cols-2 lg:divide-x lg:divide-line-subtle">
                      <div className="p-5">
                        <Overline as="h3" id="info-title" className="mb-3 block">{t("projects.projectInfo")}</Overline>
                        <dl className="grid gap-3 sm:grid-cols-2">
                          <Metric label={t("projects.projectName")} value={detailName} />
                          <Metric label={t("projects.windFarm")} value={detailFarm} />
                          <Metric label={t("projects.client")} value={detailClient} />
                          <Metric label={t("projects.turbineCount")} value={projectStats.totalTurbines} />
                        </dl>
                      </div>
                      <div className="border-t border-line-subtle p-5 lg:border-t-0">
                        <Overline as="h3" className="mb-3 block">{t("progress.technicalTeam")}</Overline>
                        {projectCompleteData?.staff_list && projectCompleteData.staff_list.length > 0 ? (
                          <ul className="grid gap-2 sm:grid-cols-2">
                            {projectCompleteData.staff_list.map((member) => (
                              <li key={member.id} className="flex items-center gap-3 rounded-md border border-line-subtle bg-surface-card/40 px-3 py-2.5">
                                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line-subtle bg-surface-card text-ink-muted"><Users size={16} /></span>
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-medium text-ink">{member.full_name || member.fullName}</span>
                                  <span className="block truncate text-xs text-ink-muted">{member.email}</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="rounded-md border border-dashed border-line-subtle px-3 py-6 text-center text-sm text-ink-muted">{t("progress.noTeamAssigned")}</p>
                        )}
                      </div>
                    </BentoCard>

                    {/* Turbinas: proyectos de dron → mapa interactivo (sin lista); LPS conserva la lista */}
                    {!isLpsProject && (
                      <BentoCard as="section" flat aria-labelledby="turbines-title">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-5 py-3">
                          <Overline as="h3" id="turbines-title">
                            {tx("Mapa de turbinas")} <span className="ml-1 tabular-nums">({projectStats.totalTurbines})</span>
                          </Overline>
                        </div>
                        {projectTurbines.length === 0 ? (
                          <EmptyState icon={Wind}>{t("progress.noTurbinesFound")}</EmptyState>
                        ) : (
                          <TurbineMapSection
                            items={mapItems}
                            loading={mapData.loading && mapData.rows === null}
                            error={mapData.error}
                            onRetry={mapData.reload}
                            onOpenReport={handleOpenTurbineReport}
                            onDeleteReport={isAdminRole ? handleDeleteFromMap : undefined}
                            getPhotoUrl={signImageUrl}
                          />
                        )}
                      </BentoCard>
                    )}
                    {isLpsProject && (
                    <BentoCard as="section" flat aria-labelledby="turbines-title">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-5 py-3">
                        <Overline as="h3" id="turbines-title">
                          {t("progress.turbinesList")} <span className="ml-1 tabular-nums">({projectStats.totalTurbines})</span>
                        </Overline>
                        <div role="group" aria-label={tx("Filtrar turbinas por estado")} className="flex flex-wrap gap-1.5">
                          {filterOptions.map((opt) => (
                            <button
                              key={opt.key}
                              type="button"
                              aria-pressed={turbineFilter === opt.key}
                              onClick={() => setTurbineFilter(opt.key)}
                              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${FOCUS} ${
                                turbineFilter === opt.key
                                  ? "border-brand/50 bg-brand/10 text-brand"
                                  : "border-line-subtle text-ink hover:border-line-medium"
                              }`}
                            >
                              {opt.label} <span className="tabular-nums opacity-70">{opt.count}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {projectTurbines.length === 0 ? (
                        <EmptyState icon={Wind}>{t("progress.noTurbinesFound")}</EmptyState>
                      ) : filteredTurbines.length === 0 ? (
                        <p className="py-10 text-center text-sm text-ink-muted">{t("progress.noTurbinesInStatus")}</p>
                      ) : (
                        <ul className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                          {filteredTurbines.map((turbine) => {
                            const isApproved = turbineApprovalMap[turbine.id] === true;
                            const status = isApproved
                              ? t("status.completed")
                              : isLpsProject
                                ? turbine.lps_data && Object.keys(turbine.lps_data).length > 0 ? t("status.completed") : t("status.pending")
                                : translateStatus(turbineStatusMap[turbine.id] || turbine.status);
                            const progress = calculateTurbineProgress(turbine);
                            const isCompleted = progress === 100;
                            const tNameEncoded = encodeURIComponent(turbine.turbine_name || turbine.name);
                            const reportUrl = `${window.location.origin}/${isLpsProject ? "lps-viewer" : "report-viewer"}/${selectedProject?.id}/${tNameEncoded}`;
                            const statusKey = getStatusKey(status);

                            return (
                              <li key={turbine.id} className="flex">
                                <BentoCard className="flex w-full flex-col">
                                  <div className="flex items-start justify-between gap-2 border-b border-line-subtle px-4 py-3">
                                    <div className="min-w-0">
                                      <h4 className="truncate text-sm font-semibold text-ink">{turbine.turbine_name}</h4>
                                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <StatusBadge status={statusKey} label={status} className="whitespace-nowrap" />
                                        {isAdminRole && isCompleted && (
                                          isApproved ? (
                                            <span className="inline-flex items-center gap-1 text-xs font-medium text-status-done" title={t("progress.reportApprovedTitle")}>
                                              <Check size={12} strokeWidth={3} aria-hidden="true" /> {t("progress.reportApproved")}
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 text-xs font-medium text-status-alert" title={t("progress.reportPendingTitle")}>
                                              <Clock size={12} strokeWidth={3} aria-hidden="true" /> {t("progress.reportToApprove")}
                                            </span>
                                          )
                                        )}
                                      </div>
                                    </div>
                                    {isAdminRole && (
                                      <button
                                        type="button"
                                        onClick={(e) => handleDeleteTurbine(turbine, e)}
                                        aria-label={t("progress.deleteReportAria", { name: turbine.turbine_name })}
                                        title={tx("Eliminar reporte")}
                                        className={`rounded-md p-1.5 text-ink-muted transition-colors hover:bg-error-bg hover:text-error-text ${FOCUS}`}
                                      >
                                        <Trash2 size={16} aria-hidden="true" />
                                      </button>
                                    )}
                                  </div>

                                  <div className="flex flex-1 flex-col gap-4 px-4 py-3">
                                    <div className="flex items-center gap-3">
                                      <ProgressBar status={isCompleted ? "done" : "alert"} value={progress} label={tx("Avance {{name}}", { name: turbine.turbine_name })} />
                                      <span className="w-10 text-right font-mono text-xs font-semibold tabular-nums text-ink">{progress}%</span>
                                    </div>

                                    {isLpsProject ? (
                                      progress > 0 ? (
                                        <dl className="space-y-1.5 text-xs">
                                          <div className="flex items-center justify-between">
                                            <dt className="flex items-center gap-1.5 text-ink-muted"><Calendar size={13} aria-hidden="true" />{" "}{tx("Fecha")}</dt>
                                            <dd className="font-medium text-ink">{turbine.inspection_date ? new Date(turbine.inspection_date).toLocaleDateString(dateLocale(), { day: "2-digit", month: "2-digit", year: "numeric" }) : "N/A"}</dd>
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <dt className="flex items-center gap-1.5 text-ink-muted"><Camera size={13} aria-hidden="true" />{" "}{tx("Fotos")}</dt>
                                            <dd className="font-medium tabular-nums text-ink">{tx("{{n}} capturas", { n: turbine.lps_data?.fotos?.length || 0 })}</dd>
                                          </div>
                                        </dl>
                                      ) : (
                                        <p className="text-xs italic text-ink-muted">{tx("Sin reporte guardado")}</p>
                                      )
                                    ) : (
                                      <div>
                                        <Overline as="p" className="mb-2 block">{t("progress.bladesAndSections")}</Overline>
                                        <div className="space-y-1.5">
                                          {["A", "B", "C"].map((blade) => {
                                            const turbineMap = projectStats?.turbineBladeSectionMap?.[turbine.id] || {};
                                            const bladeKey = Object.keys(turbineMap).find((k) => (k || "").toString().trim().toLowerCase().endsWith(blade.toLowerCase()));
                                            const sectionsSet = bladeKey ? turbineMap[bladeKey] : null;
                                            const hasSection = (sec) => sectionsSet ? typeof sectionsSet.has === "function" ? sectionsSet.has(sec) : sectionsSet.includes(sec) : false;

                                            return (
                                              <div key={blade} className="flex items-center justify-between rounded-md bg-surface-card/60 px-2.5 py-1.5">
                                                <span className="text-xs font-semibold text-ink">{t("progress.bladeLabel", { letter: blade })}</span>
                                                <span className="flex gap-1.5">
                                                  {["TE", "PS", "LE", "SS"].map((sec) => (
                                                    <span
                                                      key={sec}
                                                      title={hasSection(sec) ? tx("Sección capturada") : tx("Sección pendiente")}
                                                      className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold ${
                                                        hasSection(sec) ? "border-status-done/30 bg-status-done/10 text-status-done" : "border-line-subtle bg-transparent text-ink-muted"
                                                      }`}
                                                    >
                                                      {hasSection(sec) ? <Check size={10} strokeWidth={3} aria-label={t("progress.sectionCaptured")} /> : <span aria-label={t("progress.sectionPending")} className="h-1 w-1 rounded-full bg-ink-muted" />}
                                                      {sec}
                                                    </span>
                                                  ))}
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {isCompleted && (
                                      <a
                                        href={reportUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`${BTN_BRAND_OUTLINE} mt-auto w-full`}
                                      >
                                        <Eye size={15} aria-hidden="true" />
                                        {isLpsProject ? tx("Ver inspección LPS") : t("progress.clickToViewReport")}
                                      </a>
                                    )}
                                  </div>
                                </BentoCard>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </BentoCard>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
};

export default GeneralProgressPage;
