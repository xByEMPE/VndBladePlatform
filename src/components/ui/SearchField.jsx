import React from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Campo de búsqueda con icono. `label` es el texto accesible (sr-only).
 * @param {{ value: string, onChange: (v: string) => void, label: string, placeholder?: string, className?: string }} props
 */
const SearchField = ({ value, onChange, label, placeholder, className }) => (
  <label
    className={cn(
      'flex items-center gap-2 rounded-md border border-line-subtle bg-surface-card px-3 focus-within:ring-2 focus-within:ring-brand/40',
      className,
    )}
  >
    <Search size={16} className="shrink-0 text-ink-muted" aria-hidden="true" />
    <span className="sr-only">{label}</span>
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-11 w-full !p-0 bg-transparent text-base text-ink outline-none placeholder:text-ink-muted sm:h-10 sm:text-sm"
    />
  </label>
);

export default SearchField;
