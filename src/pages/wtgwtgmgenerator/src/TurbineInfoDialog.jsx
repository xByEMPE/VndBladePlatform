import { useTranslation } from "react-i18next";
import { tx } from "@/i18n/tx";
import { useEffect, useRef, useState } from 'react';

// Datos requeridos antes de anotar. `key` coincide con los campos de `turbine` en WtgCalibrator.
export const REQUIRED_INFO = [
  { key: 'windpark', label: 'Parque eólico', placeholder: 'Windy Heights', wide: true },
  { key: 'manufacturer', label: 'Fabricante / Tecnólogo', placeholder: 'Vestas, Siemens Gamesa…' },
  { key: 'type', label: 'Modelo WTG', placeholder: 'V112' },
  { key: 'towerHeight', label: 'Altura de torre (m)', placeholder: '94', number: true, step: '0.1' },
  { key: 'rotorDiameter', label: 'Diámetro de rotor (m)', placeholder: '112', number: true, step: '0.1' },
  { key: 'bladeLength', label: 'Longitud de pala (m)', placeholder: '54.65', number: true, step: '0.01' },
];

const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

export function missingInfo(turbine) {
  return REQUIRED_INFO.filter((f) => isBlank(turbine[f.key]));
}

/**
 * Diálogo modal que se muestra al cargar las dos fotos, antes de anotar.
 * Permite continuar con campos vacíos, previa confirmación explícita.
 */
export default function TurbineInfoDialog({ initial, onConfirm }) {
  useTranslation();
  const ref = useRef(null);
  const [draft, setDraft] = useState(() => Object.fromEntries(REQUIRED_INFO.map((f) => [f.key, initial[f.key] ?? ''])));
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const dlg = ref.current;
    if (dlg && !dlg.open) dlg.showModal();
    return () => { if (dlg?.open) dlg.close(); };
  }, []);

  const missing = missingInfo(draft);
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (missing.length && !confirming) {
      setConfirming(true);
      return;
    }
    onConfirm(draft, missing.map((f) => f.key));
  };

  return (
    // Esc no cierra: la información se debe confirmar (aunque sea incompleta)
    <dialog ref={ref} className="wc-dialog" aria-labelledby="wc-info-title" onCancel={(e) => e.preventDefault()}>
      <form onSubmit={submit} noValidate>
        <div className="wc-dialog-head">
          <span className="wc-overline">{tx("Antes de anotar")}</span>
          <h2 id="wc-info-title">{tx("Datos de la turbina")}</h2>
          <p>{tx("Se guardan junto con las dos fotos y las marcaciones de esta calibración.")}</p>
        </div>

        {confirming ? (
          <div className="wc-dialog-warn" role="alertdialog" aria-live="assertive">
            <strong>{tx("Hay campos sin información")}</strong>
            <ul>{missing.map((f) => <li key={f.key}>{tx(f.label)}</li>)}</ul>
            {missing.some((f) => f.key === 'bladeLength') && (
              <small>{tx("Sin la longitud de pala no se podrán calcular los valores ni guardar la calibración hasta capturarla.")}</small>
            )}
            <span>{tx("¿Deseas continuar de todos modos?")}</span>
          </div>
        ) : (
          <div className="wc-dialog-body">
            {REQUIRED_INFO.map((f, i) => (
              <label key={f.key} className={`wc-field${f.wide ? ' is-wide' : ''}`}>
                <span>{tx(f.label)}</span>
                <input
                  autoFocus={i === 0}
                  type={f.number ? 'number' : 'text'}
                  step={f.step}
                  min={f.number ? '0' : undefined}
                  value={draft[f.key]}
                  onChange={set(f.key)}
                  placeholder={f.placeholder}
                />
              </label>
            ))}
          </div>
        )}

        <div className="wc-dialog-foot">
          {confirming ? (
            <>
              <button type="button" className="wc-btn wc-btn--ghost" onClick={() => setConfirming(false)}>{tx("Completar datos")}</button>
              <button type="submit" className="wc-btn wc-btn--primary" autoFocus>{tx("Continuar sin ellos")}</button>
            </>
          ) : (
            <button type="submit" className="wc-btn wc-btn--primary">
              {missing.length ? tx("Continuar ({{length}} sin completar)", { length: missing.length }) : tx("Continuar")}
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
