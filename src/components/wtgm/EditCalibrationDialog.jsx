import { useTranslation } from "react-i18next";
import { tx } from "@/i18n/tx";
import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { FIELDS, GENERIC } from "@/pages/wtgwtgmgenerator/src/wtgGeometry.js";
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, OVERLINE } from "@/components/projects/formKit";
import { updateWtgmCalibration } from "@/lib/wtgmStorage";

const TURBINE_FIELDS = [
  { key: "windpark", label: "Parque eólico", wide: true },
  { key: "manufacturer", label: "Fabricante / Tecnólogo" },
  { key: "type", label: "Modelo WTG" },
  { key: "powerRating", label: "Potencia" },
  { key: "towerHeight", label: "Altura de torre (m)", number: true, step: "0.01" },
  { key: "rotorDiameter", label: "Diámetro de rotor (m)", number: true, step: "0.01" },
  { key: "bladeLength", label: "Longitud de pala (m)", number: true, step: "0.01" },
];

const str = (v) => (v == null ? "" : String(v));

const Field = ({ label, hint, children, wide = false }) => (
  <label className={`flex min-w-0 flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
    <span className={OVERLINE}>{label}</span>
    {children}
    {hint && <span className="text-[11px] text-ink-muted">{hint}</span>}
  </label>
);

/**
 * Edita una calibración guardada, tenga o no fotos: datos de la turbina y los 11 valores del .wtgm.
 */
const EditCalibrationDialog = ({ row, onClose, onSaved }) => {
  useTranslation();
  const ref = useRef(null);
  const hasPhotos = Boolean(row.photo1_path && row.photo2_path);

  const [turbine, setTurbine] = useState(() => ({
    windpark: str(row.wind_farm),
    manufacturer: str(row.manufacturer),
    type: str(row.wtg_model),
    powerRating: str(row.power_rating),
    towerHeight: str(row.tower_height_m),
    rotorDiameter: str(row.rotor_diameter_m),
    bladeLength: str(row.blade_length_m),
    bladeLengthRef: row.blade_length_ref || "flange",
    axisSource: row.axis_source || "nacelle_roof",
  }));
  const [values, setValues] = useState(() =>
    Object.fromEntries(FIELDS.map((f) => [f.id, str(row.geometry?.values?.[f.id] ?? row.wtgm?.geometry?.[f.id])])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const dlg = ref.current;
    if (dlg && !dlg.open) dlg.showModal();
    return () => {
      if (dlg?.open) dlg.close();
    };
  }, []);

  const setT = (k) => (e) => setTurbine((s) => ({ ...s, [k]: e.target.value }));
  const setV = (k) => (e) => setValues((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const nums = {};
    for (const f of FIELDS) {
      const n = Number(values[f.id]);
      if (values[f.id] === "" || !Number.isFinite(n)) {
        setError(tx("\"{{label}}\" debe ser un número.", { label: tx(f.label) }));
        return;
      }
      nums[f.id] = n;
    }
    for (const f of TURBINE_FIELDS.filter((x) => x.number)) {
      if (turbine[f.key] !== "" && (!Number.isFinite(Number(turbine[f.key])) || Number(turbine[f.key]) < 0)) {
        setError(tx("\"{{label}}\" debe ser un número válido.", { label: tx(f.label) }));
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      await updateWtgmCalibration(row, { turbine, values: nums });
      onSaved();
    } catch (err) {
      setError(err.message || tx("No se pudo guardar."));
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby="wtg-edit-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!saving) onClose();
      }}
      className="m-auto w-[min(720px,calc(100vw-1.5rem))] max-h-[calc(100dvh-1.5rem)] overflow-hidden rounded-md border border-line-medium bg-surface-base p-0 text-ink shadow-2xl backdrop:bg-surface-base/70"
    >
      <form onSubmit={submit} noValidate className="flex max-h-[calc(100dvh-1.5rem)] flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-line-subtle px-5 py-4">
          <div className="min-w-0">
            <p className={OVERLINE}>{tx("Editar calibración")}</p>
            <h2 id="wtg-edit-title" className="truncate text-base font-semibold text-ink">
              {row.wtg_model || tx("Sin modelo")}
              {row.wind_farm ? ` · ${row.wind_farm}` : ""}
            </h2>
            {!hasPhotos && (
              <p className="mt-1 text-xs text-ink-muted">
                {tx("Esta calibración no tiene fotos asociadas: se editan los datos y los valores directamente.")}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label={tx("Cerrar")}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line-subtle text-ink hover:text-ink disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto px-5 py-4">
          <section aria-labelledby="wtg-edit-turbine">
            <h3 id="wtg-edit-turbine" className={`${OVERLINE} mb-3`}>{tx("Datos de la turbina")}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {TURBINE_FIELDS.map((f) => (
                <Field key={f.key} label={tx(f.label)} wide={f.wide}>
                  <input
                    className={INPUT}
                    type={f.number ? "number" : "text"}
                    step={f.step}
                    min={f.number ? "0" : undefined}
                    value={turbine[f.key]}
                    onChange={setT(f.key)}
                  />
                </Field>
              ))}
              <Field label={tx("Longitud de pala medida desde")}>
                <select className={INPUT} value={turbine.bladeLengthRef} onChange={setT("bladeLengthRef")}>
                  <option value="flange">{tx("Brida → punta")}</option>
                  <option value="hub">{tx("Centro buje → punta")}</option>
                </select>
              </Field>
              <Field label={tx("Eje del rotor")}>
                <select className={INPUT} value={turbine.axisSource} onChange={setT("axisSource")}>
                  <option value="nacelle_roof">{tx("Techo góndola")}</option>
                  <option value="spinner">{tx("Spinner")}</option>
                </select>
              </Field>
            </div>
          </section>

          <section aria-labelledby="wtg-edit-geometry">
            <h3 id="wtg-edit-geometry" className={`${OVERLINE} mb-1`}>{tx("Valores del archivo .wtgm")}</h3>
            <p className="mb-3 text-xs text-ink-muted">
              {tx("Al guardar se regenera el archivo con su checksum. Los valores que cambies se marcan como editados y se descartan sus avisos de dato genérico.")}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <Field key={f.id} label={`${tx(f.label)} (${f.unit})`} hint={tx("Genérico: {{value}} {{unit}}", { value: GENERIC[f.id], unit: f.unit })}>
                  <input
                    className={INPUT}
                    type="number"
                    step="any"
                    value={values[f.id]}
                    onChange={setV(f.id)}
                    aria-label={tx(f.label)}
                  />
                </Field>
              ))}
            </div>
          </section>
        </div>

        <div className="border-t border-line-subtle px-5 py-3">
          {error && (
            <p role="alert" className="mb-3 rounded-md border border-error-border bg-error-bg px-3 py-2 text-xs text-error-text">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={BTN_SECONDARY} onClick={onClose} disabled={saving}>
              {tx("Cancelar")}
            </button>
            <button type="submit" className={BTN_PRIMARY} disabled={saving}>
              {saving ? "Guardando…" : tx("Guardar cambios")}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
};

export default EditCalibrationDialog;
