import { useTranslation } from "react-i18next";
import { tx } from "@/i18n/tx";
import React, { useEffect, useRef } from "react";
import OptimizedImage from "@/components/OptimizedImage";
import { SEV, sevNumber, OVERLINE, FOCUS } from "@/components/reportViewer/viewerKit";

// Piezas de presentación del Damage Editor (sin lógica de datos).

/**
 * Las cuatro secciones de la pala (TE, PS, LE, SS). La sección actual va resaltada;
 * al pulsar otra se abre en vista dividida (comparación).
 */
export const SectionTiles = ({ sections, onSelect, labels = {} }) => (
  <div role="group" aria-label={labels.group || tx("Secciones de la pala")} className="grid grid-cols-4 gap-2">
    {sections.map((s) => (
      <button
        key={s.key}
        type="button"
        onClick={() => onSelect(s.key)}
        disabled={s.isCurrent || !s.thumb}
        aria-pressed={s.isCurrent || s.isComparing}
        title={s.isCurrent ? labels.current || tx("Sección actual") : labels.compare || tx("Comparar en vista dividida")}
        className={`group flex flex-col items-stretch gap-1.5 rounded-md border p-1.5 text-left transition-colors ${FOCUS} ${
          s.isCurrent
            ? "border-brand/60 bg-brand/[0.08]"
            : s.isComparing
              ? "border-status-progress/60 bg-status-progress/10"
              : "border-line-subtle bg-surface-card/40 hover:border-line-medium disabled:cursor-default disabled:opacity-60"
        }`}
      >
        <span className="flex items-center justify-between gap-1">
          <span
            className={`text-xs font-bold uppercase tracking-wider ${
              s.isCurrent ? "text-brand" : s.isComparing ? "text-status-progress" : "text-ink"
            }`}
          >
            {s.label}
          </span>
          <span
            className="rounded-sm bg-line-subtle px-1 text-[10px] font-semibold tabular-nums text-ink"
            title={labels.damages || tx("Daños")}
          >
            {s.count}
          </span>
        </span>
        <span className="relative block aspect-square w-full overflow-hidden rounded bg-surface-base">
          {s.thumb ? (
            <OptimizedImage
              src={s.thumb.src}
              thumbnailSrc={s.thumb.thumbnailSrc || undefined}
              alt={s.label}
              lazyLoad
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[10px] text-ink-muted">N/A</span>
          )}
        </span>
      </button>
    ))}
  </div>
);

/**
 * Lista de daños de la pala con filtro por sección. Al pulsar uno, el editor navega a ese
 * daño (misma imagen o la que le corresponda).
 */
export const DetectionList = ({ items, filterOptions, filter, onFilterChange, onSelect, labels = {} }) => {
  useTranslation();
  const selectedRef = useRef(null);
  const selectedId = items.find((i) => i.selected)?.id;

  // Mantener visible el daño seleccionado dentro de la lista (sin mover la página)
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedId, filter]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label={labels.filter || tx("Filtrar por sección")}>
        {filterOptions.map((opt) => (
          <button
            key={opt.key}
            type="button"
            aria-pressed={filter === opt.key}
            onClick={() => onFilterChange(opt.key)}
            className={`rounded-md border px-2 py-1 text-[11px] font-semibold tabular-nums transition-colors ${FOCUS} ${
              filter === opt.key
                ? "border-brand/50 bg-brand/10 text-brand"
                : "border-line-subtle text-ink hover:border-line-medium hover:text-ink"
            }`}
          >
            {opt.label} <span className="opacity-70">{opt.count}</span>
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-line-subtle px-3 py-6 text-center text-xs text-ink-muted">
          {labels.empty || tx("No hay daños para mostrar.")}
        </p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
          {items.map((item) => {
            const sev = SEV[sevNumber(item.severity)] || SEV[3];
            return (
              <li key={item.id} ref={item.selected ? selectedRef : undefined}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  aria-current={item.selected ? "true" : undefined}
                  className={`flex w-full items-start gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors ${FOCUS} ${
                    item.selected
                      ? "border-brand/60 bg-brand/10"
                      : item.onCurrentImage
                        ? "border-line-medium bg-surface-card/40 hover:border-line-medium"
                        : "border-line-subtle bg-surface-card/40 hover:border-line-medium"
                  }`}
                >
                  <span
                    className={`mt-0.5 inline-flex shrink-0 items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold ${sev.chip}`}
                  >
                    {item.severityLabel}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-xs font-medium leading-snug text-ink">{item.typeLabel}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-ink-muted">
                      {item.sectionLabel}
                      {item.radiusLabel ? ` · ${item.radiusLabel}` : ""}
                      {item.onCurrentImage ? ` · ${labels.thisImage || tx("esta imagen")}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export const PanelTitle = ({ children, aside = null }) => (
  <div className="mb-2 flex items-center justify-between gap-2">
    <h4 className={OVERLINE}>{children}</h4>
    {aside}
  </div>
);

// ---------------------------------------------------------------------------
// Barra de herramientas del editor
// ---------------------------------------------------------------------------

// Tonos de los botones de la barra de herramientas del editor: conservan su aspecto ORIGINAL por
// decisión de diseño (no siguen la receta dorada unificada del resto de la app). Cada línea lleva la
// marca `guard-allow-raw` para que el guardián de colores las acepte de forma explícita.
const TOOL_TONES = {
  default: "border-white/10 bg-slate-800/80 text-slate-200 hover:border-white/25 hover:text-white", // guard-allow-raw
  active: "border-amber-500/50 bg-amber-500/10 text-amber-400", // guard-allow-raw
  info: "border-blue-400/50 bg-blue-500/15 text-blue-300", // guard-allow-raw
  purple: "border-purple-400/50 bg-purple-500/15 text-purple-300", // guard-allow-raw
  primary: "border-amber-400 bg-amber-500 text-slate-900 hover:bg-amber-400", // guard-allow-raw
  // Verde: misma receta que los rojos y los amarillos (fondo tenue + texto y borde del mismo color; el fondo sube al hover)
  success: "border-status-done/40 bg-status-done/10 text-status-done hover:bg-status-done/25",
  danger: "border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20", // guard-allow-raw
};

export const ToolBtn = ({ tone = "default", icon = null, children, className = "", ...props }) => (
  <button
    type="button"
    className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS} ${TOOL_TONES[tone] || TOOL_TONES.default} ${className}`}
    {...props}
  >
    {icon}
    {children}
  </button>
);

export const ToolGroup = ({ label, children }) => (
  <div className="flex shrink-0 items-center gap-1.5 rounded-md border border-line-subtle bg-surface-card/40 px-2 py-1">
    {label && (
      <span className="hidden pr-1 text-[10px] font-semibold uppercase tracking-widest text-ink-muted xl:inline">
        {label}
      </span>
    )}
    {children}
  </div>
);

export const ToolSlider = ({ label, value, onChange, min = 0, max = 200 }) => (
  <label className="flex shrink-0 items-center gap-2 text-xs text-ink">
    <span className="hidden sm:inline">{label}</span>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={onChange}
      aria-label={label}
      className="h-1 w-20 cursor-pointer accent-brand"
    />
    <span className="w-9 text-right tabular-nums text-ink-muted">{value}%</span>
  </label>
);
