import { tx } from "@/i18n/tx";
import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { X, Mail, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { BTN_PRIMARY, BTN_SECONDARY, INPUT } from "@/lib/classes";

const FUNCTION_NAME = "admin-change-user-email";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_REASON = 5;

// supabase-js entrega los errores HTTP de una Edge Function como FunctionsHttpError: el cuerpo (con el
// mensaje que escribió la función/la base) viene en error.context. Si no se puede leer, mensaje genérico.
const readFunctionError = async (error) => {
  // La petición ni siquiera llegó (red caída, función no desplegada o bloqueo de CORS): no hay cuerpo que leer
  if (error?.name === "FunctionsFetchError") {
    return tx("No se pudo contactar el servicio. Revisa tu conexión o que el origen esté permitido (CORS) en la función.");
  }
  try {
    const body = await error?.context?.json?.();
    if (body?.error) return String(body.error);
  } catch {
    /* sin cuerpo legible */
  }
  return tx("No se pudo completar la operación.");
};

/**
 * Diálogo para que un `dev` cambie el correo de OTRA cuenta (Edge Function admin-change-user-email).
 * Dos pasos: 1) Verificar (la función valida sin cambiar nada y avisa), 2) Confirmar el cambio.
 * El motivo es obligatorio y queda en la bitácora junto con quién lo ejecutó.
 *
 * @param {{ user: { id: string, email: string, full_name?: string }, onClose: () => void, onDone: () => void }} props
 */
const ChangeEmailDialog = ({ user, onClose, onDone }) => {
  useTranslation(); // re-renderiza al cambiar de idioma
  const [newEmail, setNewEmail] = useState("");
  const [reason, setReason] = useState("");
  const [step, setStep] = useState("form"); // "form" | "confirm"
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState(null); // respuesta de la verificación (correo normalizado, proyectos afectados)
  const firstField = useRef(null);

  useEffect(() => {
    firstField.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const call = (dryRun) =>
    supabase.functions.invoke(FUNCTION_NAME, {
      body: { target_user_id: user.id, new_email: newEmail.trim(), reason: reason.trim(), dry_run: dryRun },
    });

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    if (!EMAIL_RE.test(newEmail.trim())) return setError(tx("Escribe un correo válido."));
    if (reason.trim().length < MIN_REASON) {
      return setError(tx("El motivo debe tener al menos {{n}} caracteres.", { n: MIN_REASON }));
    }
    try {
      setBusy(true);
      const { data, error: fnError } = await call(true);
      if (fnError) return setError(await readFunctionError(fnError));
      setInfo(data);
      setStep("confirm");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    setError("");
    try {
      setBusy(true);
      const { data, error: fnError } = await call(false);
      if (fnError) return setError(await readFunctionError(fnError));
      toast({
        title: tx("Correo actualizado"),
        description: tx("El correo de {{user}} ahora es {{email}}.", {
          user: user.full_name?.trim() || user.email,
          email: data?.new_email || info?.new_email || newEmail.trim(),
        }),
      });
      onDone();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-email-title"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-xl border border-line-strong bg-surface-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line-subtle px-5 py-4">
          <div>
            <h3 id="change-email-title" className="flex items-center gap-2 text-base font-semibold text-ink">
              <Mail className="h-4 w-4 text-info" aria-hidden="true" />
              {tx("Cambiar correo de usuario")}
            </h3>
            <p className="mt-0.5 text-xs text-ink-muted">{user.full_name?.trim() || user.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={tx("Cerrar")}
            className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-card hover:text-ink disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === "form" ? (
          <form onSubmit={handleVerify} noValidate className="flex flex-col gap-4 p-5">
            <div>
              <label htmlFor="ce-current" className="mb-1 block text-xs text-ink-muted">
                {tx("Correo actual")}
              </label>
              <input id="ce-current" type="email" value={user.email} readOnly className={`${INPUT} cursor-not-allowed text-ink-muted`} />
            </div>
            <div>
              <label htmlFor="ce-new" className="mb-1 block text-xs text-ink-muted">
                {tx("Correo nuevo")}
              </label>
              <input
                id="ce-new"
                ref={firstField}
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className={INPUT}
                autoComplete="off"
                required
              />
            </div>
            <div>
              <label htmlFor="ce-reason" className="mb-1 block text-xs text-ink-muted">
                {tx("Motivo")}
              </label>
              <textarea
                id="ce-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={tx("Ej. El usuario ya no tiene acceso a su correo anterior")}
                maxLength={300}
                rows={2}
                className={`${INPUT} h-auto py-2`}
                required
              />
              <p className="mt-1 text-xs text-ink-muted">{tx("Queda registrado en la bitácora junto con tu usuario.")}</p>
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-error-border bg-error-bg px-3 py-2 text-xs text-error-text">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} disabled={busy} className={BTN_SECONDARY}>
                {tx("Cancelar")}
              </button>
              <button type="submit" disabled={busy} className={BTN_PRIMARY}>
                {busy ? tx("Verificando...") : tx("Verificar")}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-4 p-5">
            <dl className="space-y-3 rounded-lg border border-line-subtle bg-surface-card/40 p-4 text-sm">
              <div>
                <dt className="text-xs text-ink-muted">{tx("Correo actual")}</dt>
                <dd className="break-all font-mono text-xs text-ink">{info?.old_email ?? user.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">{tx("Correo nuevo")}</dt>
                <dd className="break-all font-mono text-xs text-status-done">{info?.new_email ?? newEmail.trim()}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">{tx("Motivo")}</dt>
                <dd className="text-xs text-ink">{reason.trim()}</dd>
              </div>
            </dl>

            {info?.projects_with_old_email > 0 && (
              <p role="status" className="flex items-start gap-2 rounded-lg border border-brand/30 bg-brand/10 px-3 py-2 text-xs text-brand">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {tx(
                  "{{n}} proyecto(s) mencionan el correo anterior como texto y no se actualizan solos. Corrígelos a mano en cada proyecto.",
                  { n: info.projects_with_old_email },
                )}
              </p>
            )}

            <p className="text-xs text-ink-muted">
              {tx(
                "El cambio se aplica sin enviar correos de confirmación (lo autorizas tú como dev). La persona deberá iniciar sesión con el correo nuevo.",
              )}
            </p>

            {error && (
              <p role="alert" className="rounded-lg border border-error-border bg-error-bg px-3 py-2 text-xs text-error-text">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setError(""); setStep("form"); }} disabled={busy} className={BTN_SECONDARY}>
                {tx("Volver")}
              </button>
              <button type="button" onClick={handleConfirm} disabled={busy} className={BTN_PRIMARY}>
                {busy ? tx("Cambiando...") : tx("Confirmar cambio")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChangeEmailDialog;
