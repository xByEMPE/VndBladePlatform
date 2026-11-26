import React from 'react';
import { AlertTriangle, ChevronRight, Wind } from 'lucide-react';
import { tx } from '@/i18n/tx';
import BentoCard from '@/components/ui/BentoCard';
import EmptyState from '@/components/ui/EmptyState';
import Overline from '@/components/ui/Overline';
import ActivityRow from './ActivityRow';
import { toStatusKey } from '@/lib/projectStatus';
import { FOCUS_RING } from '@/lib/classes';
import { cn } from '@/lib/utils';

/**
 * Panel de actividad reciente.
 * @param {{ projects: object[], onOpenProject: (p: object) => void, onManageAll?: () => void }} props
 * `onManageAll` solo se pasa para administradores; sin él no se muestra el enlace.
 */
const RecentActivityCard = ({ projects, onOpenProject, onManageAll }) => (
  <BentoCard as="section" flat aria-labelledby="recent-activity-title" className="flex h-full flex-col">
    <div className="flex items-center justify-between border-b border-line-subtle px-5 py-4">
      <Overline as="h2" id="recent-activity-title">{tx('Actividad reciente')}</Overline>
      {onManageAll && (
        <button
          type="button"
          onClick={onManageAll}
          className={cn(
            'inline-flex items-center gap-1 rounded-sm text-xs font-semibold text-info transition-colors hover:text-ink',
            FOCUS_RING,
          )}
        >
          {tx('Gestionar todos')}
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      )}
    </div>

    {projects.length > 0 ? (
      <ul className="flex-1 divide-y divide-line-subtle">
        {projects.map((project) => (
          <li key={project.id}>
            <ActivityRow
              icon={
                project.project_type === 'LPS'
                  ? <AlertTriangle size={18} className="text-status-alert" />
                  : <Wind size={18} className="text-status-progress" />
              }
              name={project.name}
              subtitle={`${project.wind_farm} · ${project.client}`}
              status={toStatusKey(project.status)}
              statusLabel={tx(project.status || 'Planeación')}
              count={project.turbine_count}
              onClick={() => onOpenProject(project)}
            />
          </li>
        ))}
      </ul>
    ) : (
      <EmptyState className="flex-1">{tx('No hay proyectos para mostrar')}</EmptyState>
    )}
  </BentoCard>
);

export default RecentActivityCard;
