import { tx, dateLocale } from "@/i18n/tx";
import React from "react";
import { useTranslation } from "react-i18next";
import { User, Mail, CalendarDays, Lock, Info } from "lucide-react";

// Una fila de la ficha: icono, etiqueta y valor (con leyenda "Solo lectura" opcional).
const Row = ({ icon: Icon, label, children, readOnlyNotice = false }) => (
  <div className="flex items-start gap-3 rounded-lg border border-line-subtle bg-surface-card/60 px-4 py-3">
    <span
      aria-hidden="true"
      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line-medium bg-surface-panel text-info"
    >
      <Icon className="h-4 w-4" />
    </span>
    <div className="min-w-0 flex-1">
      <dt className="flex items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-wider text-ink-muted">
        <span>{label}</span>
        {readOnlyNotice && (
          <span className="inline-flex items-center gap-1 normal-case tracking-normal">
            <Lock className="h-3 w-3" aria-hidden="true" /> {tx("Solo lectura")}
          </span>
        )}
      </dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-ink">{children}</dd>
    </div>
  </div>
);

/**
 * Datos personales en modo lectura (todos los roles): una ficha limpia en lugar de campos apagados.
 * - `showNotice` (client): leyendas "Solo lectura" y nota de que el cambio lo gestiona TI.
 * - Sin `showNotice` (admin, technician, dev y Master Dev): ficha limpia, sin leyendas ni avisos.
 *
 * @param {{ fullName: string, email: string, memberSince?: string, showNotice?: boolean }} props
 */
const ProfileDataView = ({ fullName, email, memberSince, showNotice = false }) => {
  useTranslation(); // re-renderiza al cambiar de idioma
  const since = memberSince
    ? new Date(memberSince).toLocaleDateString(dateLocale(), { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="flex flex-1 flex-col gap-3">
      <dl className="flex flex-col gap-3">
        <Row icon={User} label={tx("Nombre del usuario")} readOnlyNotice={showNotice}>
          {fullName.trim() || (
            <span className="font-normal italic text-ink-muted">{tx("Sin nombre registrado")}</span>
          )}
        </Row>
        <Row icon={Mail} label={tx("Correo electrónico")} readOnlyNotice={showNotice}>
          <span className="break-all">{email}</span>
        </Row>
        {since && (
          <Row icon={CalendarDays} label={tx("Miembro desde")}>
            {since}
          </Row>
        )}
      </dl>

      {/* Misma caja informativa que la tarjeta de contraseña, anclada abajo para alinear ambas tarjetas */}
      {showNotice && (
        <p className="mt-auto flex items-start gap-2 rounded-lg border border-line-subtle bg-surface-card/40 p-3 text-xs text-ink-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {tx("Para cambiar tu correo, solicítalo al equipo de TI.")}
        </p>
      )}
    </div>
  );
};

export default ProfileDataView;
