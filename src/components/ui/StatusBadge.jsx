import React from 'react';
import { cn } from '@/lib/utils';
import { getStatus } from '@/lib/status';

/**
 * Punto + texto de estado.
 * @param {{ status?: 'done'|'progress'|'alert'|'cancelled'|'pending', label: string, className?: string }} props
 * `label` llega ya traducido por quien llama.
 */
const StatusBadge = ({ status = 'pending', label, className }) => {
  const s = getStatus(status);
  return (
    <span
      data-status={status}
      className={cn('inline-flex items-center gap-2 text-xs font-medium', s.text, s.pill, className)}
    >
      <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', s.dot)} />
      {label}
    </span>
  );
};

export default StatusBadge;
