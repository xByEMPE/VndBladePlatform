import React from 'react';
import { CalendarDays } from 'lucide-react';

/**
 * Selector de periodo.
 * @param {{ value: string, onChange: (v: string) => void, years: string[], label: string, allLabel: string }} props
 */
const YearFilter = ({ value, onChange, years, label, allLabel }) => (
  <label className="flex items-center gap-2 rounded-md border border-line-subtle bg-surface-card px-2.5 focus-within:ring-2 focus-within:ring-brand">
    <CalendarDays size={14} className="text-ink-muted" aria-hidden="true" />
    <span className="sr-only">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="cursor-pointer bg-transparent py-1.5 text-xs font-medium text-ink outline-none"
    >
      <option className="bg-surface-panel" value="Todos">{allLabel}</option>
      {years.map((year) => (
        <option className="bg-surface-panel" key={year} value={year}>{year}</option>
      ))}
    </select>
  </label>
);

export default YearFilter;
