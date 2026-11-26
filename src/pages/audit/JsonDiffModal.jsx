import { tx, dateLocale } from "@/i18n/tx";
import React from "react";
import { useTranslation } from "react-i18next";
import { X, History, GitBranch } from "lucide-react";
import { BTN_SECONDARY } from "@/lib/classes";

// Visor JSON línea por línea: resalta en rojo/verde las propiedades que difieren del otro lado.
export const DiffJson = ({ data, other, variant, emptyText }) => {
  if (!data) {
    return <span className="text-ink-muted">{emptyText}</span>;
  }
  const highlight =
    variant === "old"
      ? "border-l-2 border-red-500 bg-red-500/15 text-red-400"
      : "border-l-2 border-emerald-500 bg-emerald-500/15 text-emerald-400";

  const entries = Object.entries(data);
  return (
    <div>
      <div className="text-ink-muted">{"{"}</div>
      {entries.map(([key, value], i) => {
        const changed =
          !other || JSON.stringify(value) !== JSON.stringify(other[key]);
        const isMeta = key === "updated_at";
        const marked = changed && !isMeta;
        const text = JSON.stringify(value, null, 2) ?? "undefined";
        return (
          <div
            key={key}
            data-diff={marked ? variant : undefined}
            className={`whitespace-pre-wrap break-all pl-3 ${
              marked ? highlight : "border-l-2 border-transparent text-ink-muted"
            }`}
          >
            {`"${key}": ${text}${i < entries.length - 1 ? "," : ""}`}
          </div>
        );
      })}
      <div className="text-ink-muted">{"}"}</div>
    </div>
  );
};

/**
 * Modal de inspección de un evento: valor anterior vs. nuevo (JSON con diferencias en rojo/verde).
 * Desde aquí se pasa al historial del registro o a toda la transacción.
 * @param {{
 *   log: object, actor: string, onClose: () => void,
 *   onViewRecord?: (log: object) => void, onViewTransaction?: (log: object) => void,
 * }} props
 */
const JsonDiffModal = ({ log, actor, onClose, onViewRecord, onViewTransaction }) => {
  useTranslation(); // re-renderiza al cambiar de idioma
  const canViewRecord = Boolean(onViewRecord && log.record_id && log.table_name);
  const canViewTransaction = Boolean(onViewTransaction && log.metadata?.txid);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-line-strong bg-surface-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line-subtle px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-ink">
              {tx("Detalle de Evento")} ·{" "}
              <span className="font-mono text-info">
                {log.table_name.replace("public.", "")}
              </span>{" "}
              ({log.action})
            </h3>
            <p className="mt-0.5 text-xs text-ink-muted">
              {tx("Actor:")} <strong className="text-ink">{actor}</strong> ·{" "}
              {new Date(log.created_at).toLocaleString(dateLocale())}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tx("Cerrar")}
            className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-card hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-4 border-b border-line-subtle bg-surface-card/40 px-5 py-2.5 text-xs text-ink-muted">
          <span>
            <strong className="text-ink">{tx("ID del registro:")}</strong>{" "}
            <code className="font-mono">{log.record_id || "-"}</code>
          </span>
          {log.metadata?.ip && (
            <span>
              <strong className="text-ink">{tx("IP:")}</strong>{" "}
              <code className="font-mono">{log.metadata.ip}</code>
            </span>
          )}
          {log.metadata?.session_id && (
            <span>
              <strong className="text-ink">{tx("Sesión:")}</strong>{" "}
              <code className="font-mono">{String(log.metadata.session_id).slice(0, 8)}…</code>
            </span>
          )}
          {log.metadata?.txid && (
            <span>
              <strong className="text-ink">{tx("Transacción:")}</strong>{" "}
              <code className="font-mono">{log.metadata.txid}</code>
            </span>
          )}
          {log.metadata?.request_id && (
            <span>
              <strong className="text-ink">{tx("ID de solicitud:")}</strong>{" "}
              <code className="font-mono">{String(log.metadata.request_id).slice(0, 8)}…</code>
            </span>
          )}
          {log.metadata?.target_email && (
            <span>
              <strong className="text-ink">{tx("Correo afectado:")}</strong>{" "}
              <code className="font-mono">{log.metadata.target_email}</code>
            </span>
          )}
          {log.metadata?.user_agent && (
            <span className="max-w-md truncate">
              <strong className="text-ink">{tx("Navegador:")}</strong>{" "}
              {log.metadata.user_agent}
            </span>
          )}
        </div>

        {/* Motivo declarado por quien ejecutó la acción (cambio de correo asistido): destacado */}
        {log.metadata?.reason && (
          <div className="border-b border-line-subtle px-5 py-3">
            <div role="note" className="rounded-lg border border-brand/30 bg-brand/10 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand">
                {tx("Motivo del cambio")}
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">{log.metadata.reason}</p>
            </div>
          </div>
        )}

        {/* Saltos al historial (solo si aplican a este evento) */}
        {(canViewRecord || canViewTransaction) && (
          <div className="flex flex-wrap justify-end gap-2 border-b border-line-subtle px-5 py-3">
            {canViewRecord && (
              <button type="button" onClick={() => onViewRecord(log)} className={`${BTN_SECONDARY} h-9 px-3 text-xs sm:h-9`}>
                <History className="h-3.5 w-3.5" />
                {tx("Historial del registro")}
              </button>
            )}
            {canViewTransaction && (
              <button type="button" onClick={() => onViewTransaction(log)} className={`${BTN_SECONDARY} h-9 px-3 text-xs sm:h-9`}>
                <GitBranch className="h-3.5 w-3.5" />
                {tx("Ver transacción")}
              </button>
            )}
          </div>
        )}

        <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 md:grid-cols-2">
          <div className="flex flex-col">
            <span className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-status-alert">
              {tx("Valor Anterior (old_data)")}
            </span>
            <div className="flex-1 overflow-auto rounded-lg border border-line-subtle bg-background p-3 font-mono text-xs">
              <DiffJson
                data={log.old_data}
                other={log.new_data}
                variant="old"
                emptyText={tx("null (Registro recién creado)")}
              />
            </div>
          </div>

          <div className="flex flex-col">
            <span className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-status-done">
              {tx("Valor Nuevo (new_data)")}
            </span>
            <div className="flex-1 overflow-auto rounded-lg border border-line-subtle bg-background p-3 font-mono text-xs">
              <DiffJson
                data={log.new_data}
                other={log.old_data}
                variant="new"
                emptyText={tx("null (Registro eliminado)")}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JsonDiffModal;
