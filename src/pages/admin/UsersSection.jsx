import { tx, dateLocale } from "@/i18n/tx";
import React from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Users, CheckCircle, XCircle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { BTN_DANGER, BTN_INFO, BTN_SUCCESS, INPUT } from "@/lib/classes";
import BentoCard from "@/components/ui/BentoCard";
import EmptyState from "@/components/ui/EmptyState";
import Overline from "@/components/ui/Overline";
import SearchField from "@/components/ui/SearchField";
import RoleChip from "@/components/ui/RoleChip";
import { isMasterDevEmail } from "@/lib/masterDev";
import RoleMenu from "./RoleMenu";
import { TH, ICON_GREEN, ICON_RED } from "./adminStyles";

// Etiquetas en español de cada rol (la vista no muestra los slugs técnicos dev/admin/…).
const ROLE_ES = { dev: "Desarrollador", admin: "Administrador", technician: "Técnico", client: "Cliente" };

/**
 * Gestión de usuarios: filtros + tabla con cambio de rol y activación.
 * Presentacional: la carga de datos y las mutaciones viven en AdminPage.
 */
const UsersSection = ({
  users,
  searchTerm,
  onSearchChange,
  filterRole,
  onFilterRoleChange,
  currentUserId,
  isMaster,
  onRoleChange,
  onToggleStatus,
  onChangeEmail,
  callerIsDev = true, // false = admin: gestiona igual que un dev no Master, pero no toca cuentas dev
}) => {
  const { t } = useTranslation("common");
  const roleName = (role) => t(`roles.${role}`, { defaultValue: ROLE_ES[role] ?? role });
  // Filtro: todos + los 4 roles (incluye "Desarrollador": filtrar no es asignar)
  const filterOptions = [
    { value: "all", label: t("admin.userManagement.allRoles") },
    { value: "dev", label: roleName("dev") },
    { value: "admin", label: roleName("admin") },
    { value: "technician", label: roleName("technician") },
    { value: "client", label: roleName("client") },
  ];
  const roleOptions = [
    ...(isMaster ? [{ value: "dev", label: roleName("dev") }] : []),
    { value: "admin", label: roleName("admin") },
    { value: "technician", label: roleName("technician") },
    { value: "client", label: roleName("client") },
  ];
  return (
    <BentoCard as="section" flat aria-labelledby="users-title">
      <div className="border-b border-line-subtle px-5 py-4">
        <Overline as="h2" id="users-title" className="flex items-center gap-2 text-ink">
          <Users size={14} className="text-info" aria-hidden="true" />
          {t("admin.userManagement.title")}
        </Overline>
        <p className="mt-1 text-xs text-ink-muted">{t("admin.userManagement.subtitle")}</p>
      </div>

      <div className="p-4 sm:p-5">
        {/* Filtros */}
        <div className="mb-5 grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_220px]">
          <SearchField
            value={searchTerm}
            onChange={onSearchChange}
            label={t("admin.userManagement.searchPlaceholder")}
            placeholder={t("admin.userManagement.searchPlaceholder")}
          />
          <div>
            <Label htmlFor="role-filter" className="mb-1 block text-xs text-ink-muted">
              {t("admin.userManagement.filterByRole")}
            </Label>
            <RoleMenu
              id="role-filter"
              value={filterRole}
              currentLabel={filterRole === "all" ? t("admin.userManagement.allRoles") : roleName(filterRole)}
              ariaLabel={t("admin.userManagement.filterByRole")}
              options={filterOptions}
              onChange={onFilterRoleChange}
              className="h-10 w-full justify-between rounded-md px-3 text-sm"
            />
          </div>
        </div>

        {/* Tabla de usuarios */}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-line-subtle">
                <th className={TH}>{t("admin.userManagement.table.user")}</th>
                <th className={TH}>{t("admin.userManagement.table.role")}</th>
                <th className={TH}>{t("admin.userManagement.table.status")}</th>
                <th className={TH}>{t("admin.userManagement.table.created")}</th>
                <th className={`${TH} text-right`}>{t("admin.userManagement.table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                // Fila del Master Dev: solo él puede modificarla. Los demás no cambian su propio rol.
                const protectedRow = isMasterDevEmail(user.email) && !isMaster;
                const isDevRow = user.role === "dev";
                // Un admin (no dev) tampoco cambia el rol de cuentas dev.
                const devLocked = isDevRow && !callerIsDev;
                const roleLocked = protectedRow || (user.id === currentUserId && !isMaster) || devLocked;
                const lockReason = protectedRow
                  ? tx("Usuario protegido: solo el Master Dev puede modificarlo")
                  : devLocked
                    ? tx("Solo un dev puede modificar cuentas dev")
                    : tx("No puedes cambiar tu propio rol");
                // Activar/desactivar: la fila del Master solo la toca él; en cuentas dev, solo el Master Dev
                // (y nadie sobre su propia cuenta). La base lo exige también (guard_user_profile_update).
                const toggleBlockedReason = protectedRow
                  ? lockReason
                  : user.id === currentUserId && (isDevRow || !callerIsDev)
                    ? isDevRow
                      ? tx("Nadie puede desactivar su propia cuenta dev")
                      : tx("Nadie puede desactivar su propia cuenta") // un admin no se desactiva a sí mismo
                    : isDevRow && !isMaster
                      ? tx("Solo el Master Dev puede activar o desactivar cuentas dev")
                      : null;
                return (
                <tr key={user.id} className="border-b border-line-subtle transition-colors last:border-0 hover:bg-surface-card">
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-ink">{user.email}</div>
                      {user.full_name && <div className="text-sm text-ink-muted">{user.full_name}</div>}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5">
                    {roleLocked ? (
                      // Solo lectura: chip en español + candado (tooltip con el motivo)
                      <span className="inline-flex items-center gap-1.5" title={lockReason}>
                        <RoleChip role={user.role} label={roleName(user.role)} />
                        <Lock className="h-3 w-3 text-ink-muted" aria-hidden="true" />
                      </span>
                    ) : (
                      // Editable: chip con menú propio (tema oscuro). 'dev' solo se ofrece al Master Dev.
                      <RoleMenu
                        value={user.role}
                        currentLabel={roleName(user.role)}
                        ariaLabel={`${t("admin.userManagement.table.role")}: ${user.email}`}
                        options={roleOptions}
                        onChange={(next) => onRoleChange(user.id, next)}
                      />
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5">
                    {/* Estado: icono y color de la letra como estaban (check verde / equis roja + texto claro) */}
                    <div className="flex items-center gap-2">
                      {user.is_active ? (
                        <CheckCircle className={`h-4 w-4 ${ICON_GREEN}`} aria-hidden="true" />
                      ) : (
                        <XCircle className={`h-4 w-4 ${ICON_RED}`} aria-hidden="true" />
                      )}
                      <span className="text-sm text-ink">
                        {user.is_active ? t("admin.userManagement.status.active") : t("admin.userManagement.status.inactive")}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-sm tabular-nums text-ink-muted">
                    {new Date(user.created_at).toLocaleDateString(dateLocale(), { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Cambiar correo (asistido por dev): SOLO cuentas client. technician, admin y dev
                          gestionan su correo desde /profile (y la base también lo exige). */}
                      {user.role === "client" && (
                        <button
                          type="button"
                          onClick={() => onChangeEmail(user)}
                          className={cn(BTN_INFO, "h-9 px-3 text-xs sm:h-9")}
                        >
                          {tx("Cambiar correo")}
                        </button>
                      )}

                      {/* Activar / desactivar: desactivar en vino sobrio, reactivar en verde salvia */}
                      <button
                        type="button"
                        onClick={() => onToggleStatus(user.id, user.is_active)}
                        disabled={toggleBlockedReason !== null}
                        title={toggleBlockedReason ?? undefined}
                        className={cn(user.is_active ? BTN_DANGER : BTN_SUCCESS, "h-9 px-3 text-xs sm:h-9", toggleBlockedReason !== null && "cursor-not-allowed opacity-50")}
                      >
                        {user.is_active ? t("admin.userManagement.actions.deactivate") : t("admin.userManagement.actions.activate")}
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>

          {users.length === 0 && <EmptyState>{t("admin.userManagement.noUsersFound")}</EmptyState>}
        </div>
      </div>
    </BentoCard>
  );
};

export default UsersSection;
