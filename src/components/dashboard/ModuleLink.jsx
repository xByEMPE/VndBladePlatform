import React from 'react';
import { ChevronRight } from 'lucide-react';
import BentoCard from '@/components/ui/BentoCard';
import { cn } from '@/lib/utils';

/**
 * Acceso a módulo: BentoCard clicable con micro-desplazamiento del chevron en hover.
 * @param {{ title: string, description: string, icon: React.ReactNode, onClick: () => void, featured?: boolean }} props
 */
const ModuleLink = ({ title, description, icon, onClick, featured = false }) => (
  <BentoCard
    as="button"
    active={featured}
    onClick={onClick}
    className="group flex h-full w-full flex-col justify-between gap-6 p-5 text-left"
  >
    <div className="flex items-start justify-between">
      <span
        aria-hidden="true"
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-lg border',
          featured ? 'border-brand/30 bg-brand/15 text-brand' : 'border-line-subtle bg-surface-card text-ink',
        )}
      >
        {icon}
      </span>
      <ChevronRight
        aria-hidden="true"
        size={18}
        className="text-ink-muted transition-transform duration-bento ease-elastic group-hover:translate-x-0.5 group-hover:text-brand"
      />
    </div>
    <div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-sm leading-snug text-ink-muted">{description}</p>
    </div>
  </BentoCard>
);

export default ModuleLink;
