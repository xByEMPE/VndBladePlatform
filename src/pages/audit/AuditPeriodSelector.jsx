import { tx } from "@/i18n/tx";
import React from "react";
import { useTranslation } from "react-i18next";

// Fecha local (no UTC) en formato YYYY-MM-DD, compatible con <input type="date">
export const todayLocal = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const DATE_MODES = [
  { id: "today", label: "Hoy" },
  { id: "all", label: "General" },
];

/**
 * Selector segmentado de periodo: Hoy / General.
 * @param {{ mode: string, onChange: (mode: string) => void }} props
 */
const AuditPeriodSelector = ({ mode, onChange }) => {
  useTranslation(); // re-renderiza al cambiar de idioma
  return (
  <div
    role="group"
    aria-label={tx("Periodo")}
    className="inline-flex flex-wrap gap-1 rounded-lg border border-line-subtle bg-surface-card p-1"
  >
    {DATE_MODES.map((m) => (
      <button
        key={m.id}
        type="button"
        aria-pressed={mode === m.id}
        onClick={() => onChange(m.id)}
        className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
          mode === m.id
            ? "border-info/30 bg-info/15 text-info"
            : "border-transparent text-ink-muted hover:bg-surface-hover hover:text-ink"
        }`}
      >
        {tx(m.label)}
      </button>
    ))}
  </div>
  );
};

export default AuditPeriodSelector;
