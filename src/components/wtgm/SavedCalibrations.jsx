import { useTranslation } from "react-i18next";
import { tx, dateLocale } from "@/i18n/tx";
import React, { useMemo, useState } from "react";
import { AlertTriangle, Download, Inbox, Pencil, Plus, RefreshCw } from "lucide-react";
import { downloadJson, wtgmFileName, WTGM_MIME } from "@/pages/wtgwtgmgenerator/src/wtgmFormat.js";
import BentoCard from "@/components/ui/BentoCard";
import EmptyState from "@/components/ui/EmptyState";
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, FOCUS, OVERLINE } from "@/lib/classes";

// Botones compactos de esta lista (misma apariencia del sistema, altura de 36px)
const COMPACT = "h-9 sm:h-9 gap-1.5 px-3 text-xs font-medium";
const BTN_SM = `${BTN_SECONDARY} ${COMPACT}`;
const BTN_SM_PRIMARY = `${BTN_PRIMARY} ${COMPACT}`;
const BTN_SM_DANGER = `${BTN_DANGER} ${COMPACT}`;

const METHOD_LABELS = { "ai+review": "IA + revisión", manual: "Manual", catalog: "Catálogo", edited: "Editado" };
const modelOf = (row) => row.wtg_model || tx("Sin modelo");
const fmtM = (v) => (v == null ? "—" : `${Number(v).toLocaleString(dateLocale(), { maximumFractionDigits: 2 })} m`);
const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString(dateLocale(), { day: "2-digit", month: "short", year: "numeric" });

const Spec = ({ label, value }) => (
  <div className="min-w-0">
    <dt className={OVERLINE}>{label}</dt>
    <dd className="mt-0.5 truncate text-sm text-ink">{value}</dd>
  </div>
);

/**
 * Lista de calibraciones guardadas. Cada fila lleva el modelo de WTG como indicador y
 * un único botón: generar el archivo .wtgm de esa turbina.
 */
const SavedCalibrations = ({ rows, loading, error, onRefresh, onCreate, onEdit }) => {
  useTranslation();
  const [model, setModel] = useState("all");

  const models = useMemo(() => {
    const counts = new Map();
    rows.forEach((r) => counts.set(modelOf(r), (counts.get(modelOf(r)) || 0) + 1));
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const visible = model === "all" ? rows : rows.filter((r) => modelOf(r) === model);

  const generate = (row) => {
    const turbine = { windpark: row.wind_farm, type: row.wtg_model };
    downloadJson(row.wtgm, wtgmFileName(turbine), WTGM_MIME);
  };

  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-error-border bg-error-bg p-4 text-sm text-error-text">
        <p className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          {tx("No se pudieron cargar las calibraciones")}
        </p>
        <p className="mt-1 text-xs text-error-text/80">
          {error}. Si es la primera vez, verifica que la migración de la tabla wtgmFile esté aplicada en Supabase.
        </p>
        <button type="button" onClick={onRefresh} className={`${BTN_SM_DANGER} mt-3`}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Reintentar
        </button>
      </div>
    );
  }

  if (loading && rows.length === 0) {
    return (
      <ul className="space-y-3" aria-busy="true" aria-label={tx("Cargando calibraciones")}>
        {[0, 1, 2].map((i) => (
          <li key={i} className="h-24 animate-pulse rounded-xl border border-line-subtle bg-surface-panel" />
        ))}
      </ul>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line-medium py-6">
        <EmptyState icon={Inbox} className="py-6">{tx("Aún no hay calibraciones guardadas.")}</EmptyState>
        <div className="flex justify-center">
          <button type="button" onClick={onCreate} className={BTN_SM_PRIMARY}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Crear nueva calibración
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label={tx("Filtrar por modelo de WTG")} className="flex flex-wrap gap-1.5">
          {[["all", rows.length], ...models].map(([key, count]) => (
            <button
              key={key}
              type="button"
              aria-pressed={model === key}
              onClick={() => setModel(key)}
              className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold tabular-nums transition-colors ${FOCUS} ${
                model === key
                  ? "border-brand/50 bg-brand/10 text-brand"
                  : "border-line-subtle text-ink hover:border-line-medium"
              }`}
            >
              {key === "all" ? "Todos" : key} <span className="opacity-70">{count}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={onRefresh} disabled={loading} className={BTN_SM}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />{" "}{tx("Actualizar")}
        </button>
      </div>

      <ul className="space-y-3">
        {visible.map((row) => (
          <li key={row.id}>
            <BentoCard className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
              <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
                <div className="shrink-0 sm:w-40">
                  <p className={OVERLINE}>{tx("Modelo WTG")}</p>
                  <span className="mt-1 inline-flex max-w-full items-center truncate rounded-md border border-brand/40 bg-brand/10 px-2.5 py-1 text-sm font-semibold text-brand">
                    {modelOf(row)}
                  </span>
                </div>
                <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
                  <Spec label={tx("Parque")} value={row.wind_farm || "—"} />
                  <Spec label={tx("Fabricante")} value={row.manufacturer || "—"} />
                  <Spec label={tx("Guardada")} value={fmtDate(row.created_at)} />
                  <Spec label={tx("Torre")} value={fmtM(row.tower_height_m)} />
                  <Spec label={tx("Rotor")} value={fmtM(row.rotor_diameter_m)} />
                  <Spec label={tx("Pala")} value={fmtM(row.blade_length_m)} />
                  <Spec label={tx("Origen")} value={tx(METHOD_LABELS[row.method] || "Manual")} />
                </dl>
              </div>
              <div className="flex shrink-0 flex-col items-stretch gap-2 lg:items-end">
                {row.missing_fields?.length > 0 && (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] text-status-alert"
                    title={tx("Campos sin información: {{n}}", { n: row.missing_fields.length })}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                    {tx("{{n}} dato(s) sin completar", { n: row.missing_fields.length })}
                  </span>
                )}
                {!(row.photo1_path && row.photo2_path) && (
                  <span className="text-[11px] text-ink-muted">{tx("Sin fotos de calibración")}</span>
                )}
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <button type="button" onClick={() => onEdit(row)} className={BTN_SM}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    {tx("Editar")}
                  </button>
                  <button type="button" onClick={() => generate(row)} className={BTN_SM_PRIMARY}>
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {tx("Generar .wtgm")}
                  </button>
                </div>
              </div>
            </BentoCard>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SavedCalibrations;
