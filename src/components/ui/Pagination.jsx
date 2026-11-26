import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BTN_SECONDARY, INPUT } from '@/lib/classes';

/**
 * Paginación con selector de tamaño. Todos los textos llegan ya traducidos.
 * @param {{
 *   rangeText: string, perPageLabel: string, pageSize: number, pageSizes: number[],
 *   onPageSizeChange: (n: number) => void, page: number, totalPages: number,
 *   onPageChange: (p: number) => void, pageText: string, prevLabel: string, nextLabel: string
 * }} props
 */
const Pagination = ({
  rangeText, perPageLabel, pageSize, pageSizes, onPageSizeChange,
  page, totalPages, onPageChange, pageText, prevLabel, nextLabel,
}) => (
  <div className="flex flex-col gap-3 border-t border-line-subtle px-4 py-3 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-5">
    <div className="flex items-center gap-3">
      <span className="tabular-nums">{rangeText}</span>
      <label className="flex items-center gap-2">
        <span>{perPageLabel}</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className={`${INPUT} !h-9 !w-20 sm:!h-9`}
        >
          {pageSizes.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
    </div>
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label={prevLabel}
        className={`${BTN_SECONDARY} !h-9 !px-3`}
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      <span className="min-w-[5rem] text-center tabular-nums">{pageText}</span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label={nextLabel}
        className={`${BTN_SECONDARY} !h-9 !px-3`}
      >
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  </div>
);

export default Pagination;
