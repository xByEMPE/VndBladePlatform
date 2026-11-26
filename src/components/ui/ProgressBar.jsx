import React from 'react';
import { cn } from '@/lib/utils';
import { getStatus } from '@/lib/status';
import { clampPercent } from '@/lib/gauge';

/**
 * Barra de progreso compacta (h-1.5) de uno o varios estados.
 * @param {{
 *   segments?: Array<{ status: string, value: number }>,
 *   value?: number, status?: string,
 *   label?: string, className?: string
 * }} props
 * Atajo: `value` + `status` equivale a un solo segmento. Los valores son % (0–100);
 * la suma de segmentos se limita a 100.
 */
const ProgressBar = ({ segments, value = 0, status = 'done', label, className }) => {
  const list = segments ?? [{ status, value }];

  let remaining = 100;
  const bars = list.map((seg) => {
    const width = Math.min(clampPercent(seg.value), remaining);
    remaining -= width;
    return { status: seg.status, width };
  });
  const total = Math.round(100 - remaining);

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={total}
      aria-label={label}
      className={cn('flex h-1.5 w-full overflow-hidden rounded-full bg-line-subtle', className)}
    >
      {bars.map((bar, i) => (
        <div
          key={`${bar.status}-${i}`}
          data-segment={bar.status}
          className={cn('h-full transition-[width] duration-bento ease-elastic', getStatus(bar.status).bar)}
          style={{ width: `${bar.width}%` }}
        />
      ))}
    </div>
  );
};

export default ProgressBar;
