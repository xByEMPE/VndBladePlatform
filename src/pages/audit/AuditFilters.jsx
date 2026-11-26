import { tx } from "@/i18n/tx";
import React from "react";
import { useTranslation } from "react-i18next";
import { INPUT } from "@/lib/classes";
import SearchField from "@/components/ui/SearchField";

const LABEL = "mb-1 block text-xs text-ink-muted";

/**
 * Barra de filtros de la bitácora: búsqueda, tabla, acción, usuario y fechas.
 * El estado vive en la página; aquí solo se renderiza y se notifican cambios.
 * `userOptions`: [{ id, label }] con el nombre (full_name) de cada usuario; el filtro viaja al servidor.
 */
const AuditFilters = ({
  searchTerm,
  onSearchChange,
  tableFilter,
  onTableChange,
  availableTables,
  actionFilter,
  onActionChange,
  userFilter,
  onUserChange,
  userOptions,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}) => {
  useTranslation(); // re-renderiza al cambiar de idioma
  return (
    <div className="mb-5 grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-12">
      <div className="lg:col-span-3">
        <SearchField
          value={searchTerm}
          onChange={onSearchChange}
          label={tx("Usuario o contenido")}
          placeholder={tx("Buscar por correo, nombre, ID o detalle...")}
        />
      </div>

      <div className="lg:col-span-2">
        <label htmlFor="table-filter" className={LABEL}>
          {tx("Tabla")}
        </label>
        <select
          id="table-filter"
          value={tableFilter}
          onChange={(e) => onTableChange(e.target.value)}
          className={INPUT}
        >
          <option value="ALL">{tx("Todas las tablas")}</option>
          {availableTables.map((tbl) => (
            <option key={tbl} value={tbl}>
              {tbl.replace("public.", "")}
            </option>
          ))}
        </select>
      </div>

      <div className="lg:col-span-2">
        <label htmlFor="action-filter" className={LABEL}>
          {tx("Acción")}
        </label>
        <select
          id="action-filter"
          value={actionFilter}
          onChange={(e) => onActionChange(e.target.value)}
          className={INPUT}
        >
          <option value="ALL">{tx("Todas")}</option>
          <option value="INSERT">INSERT</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
          <option value="LOGIN">{tx("Inicio de sesión")}</option>
          <option value="LOGOUT">{tx("Cierre de sesión")}</option>
          <option value="PASSWORD_CHANGE">{tx("Cambio de contraseña")}</option>
          <option value="EMAIL_CHANGE_REQUESTED">{tx("Cambio de correo: solicitado")}</option>
          <option value="EMAIL_CHANGE">{tx("Cambio de correo")}</option>
          <option value="EMAIL_CHANGE_FAILED">{tx("Cambio de correo: falló")}</option>
        </select>
      </div>

      <div className="lg:col-span-2">
        <label htmlFor="user-filter" className={LABEL}>
          {tx("Usuario")}
        </label>
        <select
          id="user-filter"
          value={userFilter}
          onChange={(e) => onUserChange(e.target.value)}
          className={INPUT}
        >
          <option value="ALL">{tx("Todos los usuarios")}</option>
          {userOptions.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-3">
        <div>
          <label htmlFor="date-from" className={LABEL}>
            {tx("Desde")}
          </label>
          <input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className={`${INPUT} px-2 text-xs`}
          />
        </div>
        <div>
          <label htmlFor="date-to" className={LABEL}>
            {tx("Hasta")}
          </label>
          <input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className={`${INPUT} px-2 text-xs`}
          />
        </div>
      </div>
    </div>
  );
};

export default AuditFilters;
