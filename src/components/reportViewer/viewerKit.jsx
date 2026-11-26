import { useTranslation } from "react-i18next";
import { tx } from "@/i18n/tx";
import React from "react";
import { Bot, Pencil, Lightbulb } from "lucide-react";
import BentoCard from "@/components/ui/BentoCard";
import Metric from "@/components/ui/Metric";
import {
  PANEL,
  OVERLINE,
  FOCUS,
  INPUT,
  BTN,
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_DANGER,
  FADE,
} from "@/lib/classes";

// Piezas visuales del visor de reportes (solo presentación, sin lógica de datos).
// Las constantes base viven en @/lib/classes (Design System); aquí se reexportan para
// no cambiar los imports de las páginas que ya las consumen (visor y editor de daños).
export { PANEL, OVERLINE, FOCUS, INPUT, BTN, BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER, FADE };

export const FIELD =
  "w-full rounded-md border border-line-subtle bg-surface-card !px-2.5 !py-1.5 text-xs text-ink outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/30";
export const FIELD_LABEL = "mb-1 block text-xs font-medium text-ink";

export const TAB_CLASS =
  "inline-flex items-center gap-2 rounded-md border border-transparent px-3.5 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink data-[state=active]:border-brand/40 data-[state=active]:bg-brand/10 data-[state=active]:text-brand";

export const ICON_BTN = `inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-line-subtle bg-surface-card px-2.5 text-xs font-medium text-ink transition-colors hover:border-line-medium disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;

// Severidad: categoría 1 (leve) a 5 (crítica). Tokens --sev-1…--sev-5 (index.css)
export const sevNumber = (severity) =>
  parseInt(String(severity ?? "").replace(/[^0-9]/g, ""), 10) || 3;

export const SEV = {
  1: { chip: "border-sev-1/40 bg-sev-1/10 text-sev-1", bar: "bg-sev-1" },
  2: { chip: "border-sev-2/40 bg-sev-2/10 text-sev-2", bar: "bg-sev-2" },
  3: { chip: "border-sev-3/40 bg-sev-3/10 text-sev-3", bar: "bg-sev-3" },
  4: { chip: "border-sev-4/40 bg-sev-4/10 text-sev-4", bar: "bg-sev-4" },
  5: { chip: "border-sev-5/40 bg-sev-5/10 text-sev-5", bar: "bg-sev-5" },
};

export const SeverityBadge = ({ severity }) => {
  const style = SEV[sevNumber(severity)] || SEV[3];
  const label = severity
    ? String(severity).startsWith("Cat")
      ? severity
      : `Cat ${severity}`
    : "—";
  return (
    <span className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-semibold ${style.chip}`}>
      {label}
    </span>
  );
};

export const OriginTag = ({ auto }) =>
  auto ? (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-status-progress/40 bg-status-progress/10 px-2 py-0.5 text-xs font-medium text-status-progress">
      <Bot size={13} aria-hidden="true" />
      {tx("Detectado por IA")}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-line-subtle bg-surface-card px-2 py-0.5 text-xs font-medium text-ink">
      <Pencil size={12} aria-hidden="true" />
      Manual
    </span>
  );

// Metric vive en el Design System (components/ui/Metric); se reexporta para no cambiar imports.
export { Metric };

export const Callout = ({ title, children }) => (
  <div className="flex items-start gap-3 rounded-md border border-line-subtle border-l-2 border-l-brand bg-brand/[0.04] px-3 py-2.5">
    <Lightbulb size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">{title}</p>
      <p className="mt-0.5 text-sm leading-relaxed text-ink">{children}</p>
    </div>
  </div>
);

// Tarjeta resumen de una pala: total de daños, imágenes y distribución por severidad.
export const BladeSummaryCard = ({
  blade,
  active,
  onSelect,
  total,
  images,
  counts,
  damagesLabel,
  imagesLabel,
}) => {
  useTranslation();
  const sum = counts.reduce((a, b) => a + b, 0);
  return (
    <BentoCard
      as="button"
      active={active}
      onClick={onSelect}
      aria-pressed={active}
      className="group flex h-full w-full flex-col gap-4 p-4 text-left"
    >
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-base font-semibold text-ink">{blade}</h4>
        {active && (
          <span className="rounded-sm border border-brand/40 bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
            {tx("En detalle")}
          </span>
        )}
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-3xl font-semibold tabular-nums leading-none text-ink">{total}</p>
          <p className="mt-1 text-xs text-ink-muted">{damagesLabel}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-semibold tabular-nums leading-none text-ink">{images}</p>
          <p className="mt-1 text-xs text-ink-muted">{imagesLabel}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div
          role="img"
          aria-label={counts.map((c, i) => `Cat ${i + 1}: ${c}`).join(", ")}
          className="flex h-1.5 w-full overflow-hidden rounded-full bg-line-subtle"
        >
          {counts.map((c, i) =>
            c > 0 && sum > 0 ? (
              <div key={i} className={SEV[i + 1].bar} style={{ width: `${(c / sum) * 100}%` }} />
            ) : null,
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {counts.map((c, i) =>
            c > 0 ? (
              <span
                key={i}
                className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${SEV[i + 1].chip}`}
              >
                Cat {i + 1}: {c}
              </span>
            ) : null,
          )}
          {sum === 0 && <span className="text-xs text-ink-muted">{tx("Sin daños registrados")}</span>}
        </div>
      </div>
    </BentoCard>
  );
};

// Selector de pala (A, B, C) para las pestañas que dependen de la pala elegida.
export const BladeSegment = ({ blades, value, onChange, label }) => (
  <div
    role="group"
    aria-label={label}
    className="inline-flex rounded-md border border-line-subtle bg-surface-card p-0.5"
  >
    {blades.map((blade) => (
      <button
        key={blade}
        type="button"
        aria-pressed={value === blade}
        onClick={() => onChange(blade)}
        className={`rounded-[5px] px-3 py-1.5 text-sm font-medium transition-colors ${FOCUS} ${
          value === blade ? "bg-brand text-surface-base" : "text-ink-muted hover:text-ink"
        }`}
      >
        {blade}
      </button>
    ))}
  </div>
);

// Color del recuadro sobre la foto: lee los tokens de severidad (--sev-N).
const BBOX_COLORS = {
  1: "hsl(var(--sev-1))",
  2: "hsl(var(--sev-2))",
  3: "hsl(var(--sev-3))",
  4: "hsl(var(--sev-4))",
  5: "hsl(var(--sev-5))",
};

// Recuadro del daño sobre su miniatura (la imagen se muestra completa, con object-contain).
// bbox: [x, y, ancho, alto] normalizados 0-1. naturalSize: { w, h } de la imagen cargada.
// Para quitar esta función basta con eliminar <DamageBBoxOverlay /> de DamageThumbnail.
export const DamageBBoxOverlay = ({ bbox, naturalSize, severity }) => {
  if (!bbox || !naturalSize || !naturalSize.w || !naturalSize.h) return null;
  const [nx, ny, nw, nh] = bbox.map(Number);
  if (![nx, ny, nw, nh].every(Number.isFinite) || nw <= 0 || nh <= 0) return null;

  // El contenedor es cuadrado: la imagen ocupa el 100% por su lado mayor y se centra en el otro.
  const aspect = naturalSize.w / naturalSize.h;
  const renderedW = aspect >= 1 ? 100 : aspect * 100;
  const renderedH = aspect >= 1 ? 100 / aspect : 100;
  const offsetX = (100 - renderedW) / 2;
  const offsetY = (100 - renderedH) / 2;
  const color = BBOX_COLORS[sevNumber(severity)] || BBOX_COLORS[3];

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-10"
      style={{
        left: `${offsetX + nx * renderedW}%`,
        top: `${offsetY + ny * renderedH}%`,
        width: `${nw * renderedW}%`,
        height: `${nh * renderedH}%`,
        border: `2px solid ${color}`,
        boxShadow: "0 0 0 1px rgba(0,0,0,0.55)",
        boxSizing: "border-box",
      }}
    />
  );
};
