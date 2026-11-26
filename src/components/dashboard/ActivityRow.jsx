import React from 'react';
import StatusBadge from '@/components/ui/StatusBadge';
import { FOCUS_RING } from '@/lib/classes';
import { cn } from '@/lib/utils';

/**
 * Fila de campaña reciente.
 * @param {{
 *   icon: React.ReactNode, name: string, subtitle: string,
 *   status: string, statusLabel: string, count: number|string, unit?: string, onClick: () => void
 * }} props
 */
const ActivityRow = ({ icon, name, subtitle, status, statusLabel, count, unit = 'WTG', onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'group grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4 text-left transition-colors',
      'hover:bg-surface-card focus-visible:ring-inset focus-visible:ring-offset-0',
      FOCUS_RING,
    )}
  >
    <span
      aria-hidden="true"
      className="flex h-10 w-10 items-center justify-center rounded-lg border border-line-subtle bg-surface-card"
    >
      {icon}
    </span>
    <span className="min-w-0">
      <span className="block truncate text-sm font-medium text-ink">{name}</span>
      <span className="mt-0.5 block truncate text-xs text-ink-muted">{subtitle}</span>
    </span>
    <span className="flex flex-col items-end gap-1.5">
      <StatusBadge status={status} label={statusLabel} />
      <span className="font-mono text-xs tabular-nums">
        <span className="font-semibold text-ink">{count}</span> <span className="text-ink-muted">{unit}</span>
      </span>
    </span>
  </button>
);

export default ActivityRow;
