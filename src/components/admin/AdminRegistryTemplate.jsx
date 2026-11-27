import React, { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { tx } from '@/i18n/tx';
import BentoCard from '@/components/ui/BentoCard';
import Overline from '@/components/ui/Overline';
import EmptyState from '@/components/ui/EmptyState';
import { FOCUS_RING } from '@/lib/classes';
import { cn } from '@/lib/utils';

const ACTIVE = 'Activo';
const PENDING = 'Pendiente';

/**
 * Plantilla reutilizable de registro administrativo: encabezado con contador,
 * búsqueda, botón de alta y tabla.
 * @param {{
 *   title: string, columns: Array<{ key: string, label: string }>,
 *   rows: Array<Record<string, unknown>>, newLabel?: string, onNew?: () => void
 * }} props
 */
const AdminRegistryTemplate = ({ title, columns, rows, newLabel, onNew }) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
  }, [rows, query]);

  const activeCount = rows.filter((r) => r.status === ACTIVE).length;
  const pendingCount = rows.filter((r) => r.status === PENDING).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 text-ink sm:p-8">
      <BentoCard as="section" flat className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Overline as="h2">{tx('Centro Administrativo')}</Overline>
            <h1 className="mt-1 text-2xl font-bold">{tx(title)}</h1>
            <p className="mt-2 text-sm text-ink-muted">
              <span className="font-semibold text-info">{activeCount}</span> {tx('Activos')} ·{' '}
              <span className="font-semibold text-status-alert">{pendingCount}</span> {tx('Pendientes')}
            </p>
          </div>
          <button
            type="button"
            onClick={onNew}
            disabled={!onNew}
            className={cn(
              'inline-flex items-center gap-2 rounded-md bg-info px-4 py-2 text-sm font-semibold text-surface-panel transition-opacity hover:opacity-90 disabled:opacity-50',
              FOCUS_RING,
            )}
          >
            <Plus size={16} aria-hidden="true" />
            {newLabel ?? tx('+ Nuevo registro')}
          </button>
        </div>

        <label className="mt-5 flex items-center gap-2 rounded-md border border-line-subtle bg-surface-base px-3 py-2">
          <Search size={16} aria-hidden="true" className="text-ink-muted" />
          <span className="sr-only">{tx('Buscar')}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tx('Buscar...')}
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
          />
        </label>
      </BentoCard>

      <BentoCard as="section" flat className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState>{tx('No hay registros para mostrar')}</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line-subtle text-xs uppercase tracking-wider text-ink-muted">
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} scope="col" className="px-5 py-3 font-semibold">
                      {tx(col.label)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {filtered.map((row, i) => (
                  <tr key={row.id ?? i} className="hover:bg-line-subtle/40">
                    {columns.map((col) => (
                      <td key={col.key} className="px-5 py-3">
                        {String(row[col.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </BentoCard>
    </div>
  );
};

export default AdminRegistryTemplate;
