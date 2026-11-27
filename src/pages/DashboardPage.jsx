import { tx } from "@/i18n/tx";
import React, { useState, useEffect, useMemo } from "react";
import { MotionConfig } from "framer-motion";
import { Activity } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { fetchFilteredProjects } from "@/utils/projectFiltering";
import LoadingSpinner from "@/components/LoadingSpinner";
import PageHeader from "@/components/layout/PageHeader";
import BentoCard from "@/components/ui/BentoCard";
import Reveal from "@/components/ui/Reveal";
import ActiveProjectsMap from "@/components/dashboard/ActiveProjectsMap";
import { parseCoordinates } from "@/lib/coordinates";
import ProjectSummaryPanel from "@/components/dashboard/ProjectSummaryPanel";

/**
 * Posición de cada proyecto: centro (promedio) de las coordenadas válidas de sus turbinas.
 * Los proyectos sin ninguna coordenada quedan con `position: null` (no se dibujan).
 */
const buildProjectPositions = (projects, turbines) => {
  const byProject = new Map();
  turbines.forEach(t => {
    const pos = parseCoordinates(t.coordinates);
    if (!pos) return;
    const list = byProject.get(t.project_id) || [];
    list.push(pos);
    byProject.set(t.project_id, list);
  });
  return projects.map(p => {
    const pts = byProject.get(p.id) || [];
    const position = pts.length
      ? {
          lat: pts.reduce((s, q) => s + q.lat, 0) / pts.length,
          lon: pts.reduce((s, q) => s + q.lon, 0) / pts.length,
        }
      : null;
    return { id: p.id, name: p.name, statusLabel: tx(p.status || 'Planeación'), position };
  });
};

const DashboardPage = ({ role: propRole }) => {
  const { role: hookRole, isAdmin } = useRolePermissions();

  const effectiveRole = propRole || hookRole;
  const isUserAdmin = effectiveRole === "admin" || (typeof isAdmin === "function" ? isAdmin() : false);

  const [loading, setLoading] = useState(true);
  const [allProjects, setAllProjects] = useState([]);
  const [mapItems, setMapItems] = useState([]);

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

          // Mapa: cada proyecto activo se ubica en el centro de sus turbinas con coordenadas válidas.
          const active = filteredProjects.filter(p => p.status !== 'Completado' && p.status !== 'Cancelado');
          let turbines = [];
          if (active.length > 0) {
            const { data } = await supabase
              .from("turbines")
              .select("project_id, coordinates")
              .in("project_id", active.map(p => p.id));
            turbines = data || [];
          }
          setMapItems(buildProjectPositions(active, turbines));
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
                title={isUserAdmin ? tx("Panel principal") : tx("Panel de Cliente")}
                description={isUserAdmin
                  ? tx("Monitorea el progreso de las inspecciones, gestiona equipos y visualiza reportes globales.")
                  : tx("Monitorea el progreso en tiempo real y descarga los reportes de inspección de tus activos.")}
              />
            </BentoCard>
          </Reveal>

          {/* Resumen de proyectos (Panel principal) */}
          <ProjectSummaryPanel
            isUserAdmin={isUserAdmin}
            selectedYear={selectedYear}
            onYearChange={setSelectedYear}
            availableYears={availableYears}
            projectStats={projectStats}
            turbineStats={turbineStats}
          />

          {/* Mapa de parques eólicos activos */}
          <Reveal delay={0.15}>
            <ActiveProjectsMap items={mapItems} />
          </Reveal>

        </div>
      </div>
    </MotionConfig>
  );
};

export default DashboardPage;
