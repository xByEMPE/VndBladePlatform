import React, { useEffect, useState } from 'react';
import { tx } from '@/i18n/tx';
import { supabase } from '@/lib/supabase';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { fetchFilteredProjects } from '@/utils/projectFiltering';
import { toStatusKey } from '@/lib/projectStatus';
import LoadingSpinner from '@/components/LoadingSpinner';
import BentoCard from '@/components/ui/BentoCard';
import Overline from '@/components/ui/Overline';
import ProgressBar from '@/components/ui/ProgressBar';
import EmptyState from '@/components/ui/EmptyState';
import Reveal from '@/components/ui/Reveal';

/**
 * Avance estimado de un proyecto según su estado. Hasta que exista un conteo real de
 * turbinas inspeccionadas por proyecto, el avance es una aproximación por estado.
 */
const estimateProgress = (status) => (status === 'Completado' ? 100 : 0);

const ProjectProgressPage = () => {
  const { role } = useRolePermissions();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && role) {
          const list = await fetchFilteredProjects(user, role);
          if (!cancelled) setProjects(list);
        }
      } catch (error) {
        console.error('Avances de proyecto:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [role]);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <LoadingSpinner size="lg" text={tx('Cargando avances...')} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 text-ink sm:p-8">
      <Reveal>
        <BentoCard flat className="p-5 sm:p-6">
          <Overline as="h2">{tx('Centro de Operaciones')}</Overline>
          <h1 className="mt-1 text-2xl font-bold">{tx('Avances de Proyecto')}</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {tx('Seguimiento del progreso de cada proyecto.')}
          </p>
        </BentoCard>
      </Reveal>

      {projects.length === 0 ? (
        <BentoCard flat>
          <EmptyState>{tx('No hay proyectos para mostrar')}</EmptyState>
        </BentoCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const pct = estimateProgress(project.status);
            return (
              <Reveal key={project.id}>
                <BentoCard as="article" className="flex flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold">{project.name}</h2>
                      <p className="truncate text-xs text-ink-muted">
                        {project.wind_farm} · {project.client}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-info">{pct}%</span>
                  </div>
                  <ProgressBar
                    status={toStatusKey(project.status)}
                    value={pct}
                    label={tx('Avance del proyecto')}
                  />
                  <div className="flex justify-between text-xs text-ink-muted">
                    <span>{tx(project.status || 'Planeación')}</span>
                    <span>{project.turbine_count ?? 0} {tx('turbinas')}</span>
                  </div>
                </BentoCard>
              </Reveal>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProjectProgressPage;
