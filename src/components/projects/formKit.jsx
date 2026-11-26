import { tx } from "@/i18n/tx";
import React from "react";
import { useSelectableStaff, personLabel } from "@/hooks/useSelectableStaff";
import { useTranslation } from "react-i18next";
import { UserPlus, Trash2, Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import StatusBadge from "@/components/ui/StatusBadge";
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

// Piezas visuales compartidas por las páginas de gestión de proyectos
// (Inspecciones de Palas, Inspección LPS, Captura, Portal de Reportes).
// Los tokens de clases viven en @/lib/classes (Design System); aquí se reexportan.
export { PANEL, OVERLINE, FOCUS, INPUT, BTN, BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER, FADE };

// Estado de proyecto (texto guardado en BD) → clave i18n + estado del Design System (lib/status.js).
export const STATUS_META = {
  Completado: { key: "status.completed", status: "done" },
  "En progreso": { key: "status.inProgress", status: "progress" },
  Pendiente: { key: "status.pending", status: "pending" },
  Revisión: { key: "status.review", status: "review" },
  Pausado: { key: "status.paused", status: "alert" },
  Cancelado: { key: "status.cancelled", status: "cancelled" },
  Planeación: { key: "status.planning", status: "pending" },
};

export const STATUS_OPTIONS = [
  { value: "Planeación", key: "projects.planning" },
  { value: "En progreso", key: "projects.inProgress" },
  { value: "Completado", key: "projects.completed" },
  { value: "Pausado", key: "projects.paused" },
  { value: "Cancelado", key: "status.cancelled" },
];

export const getInitials = (name) =>
  (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("") || "?";

export const staffName = (s) => s.full_name || s.fullName || "";

// --- PRESENTATIONAL COMPONENTS ---

export const StatusTag = ({ status }) => {
  const { t } = useTranslation("common");
  const meta = STATUS_META[status];
  return (
    <StatusBadge
      status={meta?.status ?? "pending"}
      label={meta ? t(meta.key) : status}
      className="whitespace-nowrap"
    />
  );
};

export const Field = ({ id, label, required, hint, children, className = "" }) => (
  <div className={`min-w-0 ${className}`}>
    <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-ink">
      {label}
      {required && <span aria-hidden="true" className="ml-0.5 text-brand">*</span>}
    </label>
    {children}
    {hint && <p className="mt-1 text-[11px] text-ink-muted">{hint}</p>}
  </div>
);

export const TextField = ({ id, label, value, onChange, type = "text", required, placeholder, min, hint, className, readOnly }) => (
  <Field id={id} label={label} required={required} hint={hint} className={className}>
    <input
      id={id}
      type={type}
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      required={required}
      placeholder={placeholder}
      min={min}
      readOnly={readOnly}
      className={cn(INPUT, readOnly && "cursor-default text-ink-muted")}
    />
  </Field>
);

export const SelectField = ({ id, label, value, onChange, disabled, children, className, required }) => (
  <Field id={id} label={label} className={className} required={required}>
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} required={required} className={INPUT}>
      {children}
    </select>
  </Field>
);

export const DateField = ({ id, label, value, onChange }) => {
  const { t } = useTranslation("common");
  return (
    <Field id={id} label={label}>
      <Popover>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            className={cn(INPUT, "flex items-center gap-2 text-left", !value && "text-ink-muted")}
          >
            <CalendarIcon size={16} className="shrink-0 text-ink-muted" aria-hidden="true" />
            <span className="truncate">{value ? format(value, "PPP") : t("forms.selectDate")}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto border-line-medium bg-surface-panel p-0">
          <Calendar mode="single" selected={value || undefined} onSelect={onChange} initialFocus />
        </PopoverContent>
      </Popover>
    </Field>
  );
};

export const FormSection = ({ step, title, description, children }) => (
  <section aria-labelledby={`section-${step}`} className="rounded-md border border-line-subtle bg-surface-card/40">
    <header className="flex items-start gap-3 border-b border-line-subtle px-4 py-3 sm:px-5">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-brand/40 bg-brand/10 text-xs font-semibold text-brand"
      >
        {step}
      </span>
      <div className="min-w-0">
        <h3 id={`section-${step}`} className="text-sm font-semibold text-ink">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
      </div>
    </header>
    <div className="p-4 sm:p-5">{children}</div>
  </section>
);

// Sección 4: equipo técnico (compartida entre creación y edición)
export const StaffEditor = ({ idPrefix, newStaff, setNewStaff, onAdd, list, onRemove, companies, windFarms, emptyHint }) => {
  const { t } = useTranslation("common");
  const id = (name) => `${idPrefix}-${name}`;
  const set = (patch) => setNewStaff((prev) => ({ ...prev, ...patch }));
  const { people, loading: peopleLoading, error: peopleError } = useSelectableStaff();
  // Quien ya está en el equipo no se ofrece de nuevo
  const takenIds = new Set(list.map((s) => s.user_id).filter(Boolean));
  const takenEmails = new Set(list.map((s) => (s.email || "").toLowerCase()).filter(Boolean));
  const available = people.filter((p) => !takenIds.has(p.id) && !takenEmails.has((p.email || "").toLowerCase()));
  const selected = people.find((p) => p.id === newStaff.user_id);
  const nameCount = available.reduce((acc, p) => {
    const k = personLabel(p).toLowerCase();
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  const pickPerson = (userId) => {
    const p = people.find((x) => x.id === userId);
    if (!p) {
      set({ user_id: "", fullName: "", email: "", role: "" });
      return;
    }
    // El rol arranca con el puesto del perfil; se puede ajustar para este proyecto
    set({ user_id: p.id, fullName: personLabel(p), email: p.email || "", role: newStaff.role || p.job_title || "" });
  };

  return (
    <FormSection step={4} title={t("projects.technicalTeamLabel")} description={tx("Al menos una persona es obligatoria.")}>
      <div className="space-y-4">
        <div className="space-y-4 rounded-md border border-line-subtle bg-surface-panel p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SelectField id={id("person")} label={tx("Persona del equipo")} value={newStaff.user_id || ""} onChange={pickPerson} disabled={peopleLoading || !!peopleError}>
              <option value="">
                {peopleLoading ? tx("Cargando personal…") : tx("Selecciona a una persona registrada")}
              </option>
              {available.map((p) => (
                // Solo el nombre; el correo se muestra aparte. Si dos personas comparten nombre, se distingue con el correo.
                <option key={p.id} value={p.id}>
                  {nameCount[personLabel(p).toLowerCase()] > 1 ? `${personLabel(p)} (${p.email})` : personLabel(p)}
                </option>
              ))}
            </SelectField>
            <TextField id={id("email")} label={t("projects.email")} type="email" value={newStaff.email} readOnly placeholder={tx("Se completa al elegir a la persona")} />
            <TextField id={id("role")} label={t("projects.role")} value={newStaff.role} onChange={(v) => set({ role: v })} className="sm:col-span-2 lg:col-span-1" hint={selected?.job_title ? tx("Puesto en su perfil: {{title}}", { title: selected.job_title }) : undefined} />
          </div>
          {peopleError && (
            <p role="alert" className="text-xs text-error-text">{tx("No se pudo cargar la lista de personal.")}</p>
          )}
          {!peopleLoading && !peopleError && available.length === 0 && (
            <p className="text-xs text-ink-muted">{tx("No hay más personal disponible para agregar.")}</p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField id={id("client")} label={tx("Cliente")} value={newStaff.client_id} onChange={(v) => set({ client_id: v, wind_farm_id: "" })}>
              <option value="">{t("common.selectClient", { defaultValue: "Seleccione un cliente" })}</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </SelectField>
            <SelectField id={id("farm")} label={tx("Parque eólico")} value={newStaff.wind_farm_id} onChange={(v) => set({ wind_farm_id: v })} disabled={!newStaff.client_id}>
              <option value="">{t("common.selectWindFarm", { defaultValue: "Seleccione un parque eólico" })}</option>
              {windFarms.filter((wf) => wf.company_id === newStaff.client_id).map((wf) => (
                <option key={wf.id} value={wf.id}>{wf.name}</option>
              ))}
            </SelectField>
          </div>
          <button type="button" onClick={onAdd} className={`${BTN_SECONDARY} w-full sm:w-auto`}>
            <UserPlus size={16} aria-hidden="true" />
            {t("projects.addToTeam")}
          </button>
        </div>

        {list.length > 0 ? (
          <div>
            <p className={`${OVERLINE} mb-2`}>
              {t("projects.projectTeam")} <span className="ml-1 tabular-nums text-ink-muted">({list.length})</span>
            </p>
            <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {list.map((staff) => (
                <li key={staff.id} className="flex items-center gap-3 rounded-md border border-line-subtle bg-surface-card/40 px-3 py-2.5">
                  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-brand/30 bg-brand/10 text-xs font-semibold text-brand">
                    {getInitials(staffName(staff))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{staffName(staff)}</span>
                    <span className="block truncate text-xs text-ink-muted">{staff.role} · {staff.email}</span>
                    {(staff.client_id || staff.wind_farm_id) && (
                      <span className="block truncate text-[11px] text-ink-muted">
                        {companies.find((c) => c.id === staff.client_id)?.name || "N/A"} · {windFarms.find((wf) => wf.id === staff.wind_farm_id)?.name || "N/A"}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(staff)}
                    aria-label={tx("Quitar a {{name}} del equipo", { name: staffName(staff) })}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-error-bg hover:text-error-text ${FOCUS}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-line-subtle px-3 py-4 text-center text-sm text-ink-muted">{emptyHint}</p>
        )}
      </div>
    </FormSection>
  );
};

export const InfoItem = ({ label, children }) => (
  <div className="min-w-0">
    <dt className={OVERLINE}>{label}</dt>
    <dd className="mt-0.5 truncate text-sm text-ink">{children}</dd>
  </div>
);
