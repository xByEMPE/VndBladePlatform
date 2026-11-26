import React from 'react';
import Pill from '@/components/ui/Pill';
import { cn } from '@/lib/utils';
import { getStatus } from '@/lib/status';

/**
 * Estado como PÍLDORA tenue: texto del color del estado sobre un fondo teñido del mismo color.
 * (Para punto + texto usa StatusBadge.) `label` llega ya traducido.
 * @param {{ status?: 'done'|'progress'|'alert'|'cancelled'|'review'|'planning'|'pending', label: string, className?: string }} props
 */
const StatusPill = ({ status = 'pending', label, className }) => (
  <Pill data-status={status} className={cn(getStatus(status).chip, className)}>
    {label}
  </Pill>
);

export default StatusPill;
