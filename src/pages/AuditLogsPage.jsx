import { tx, dateLocale } from "@/i18n/tx";
import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet";
import { MotionConfig } from "framer-motion";
import {
  FileCheck2,
  PlusCircle,
  Pencil,
  Trash2,
  RefreshCw,
  Eye,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { BTN_PRIMARY, BTN_SECONDARY } from "@/lib/classes";
import RoleChip from "@/components/ui/RoleChip";
import { getRoleName } from "@/lib/roleLabel";
import LoadingSpinner from "@/components/LoadingSpinner";
import PageHeader from "@/components/layout/PageHeader";
import BentoCard from "@/components/ui/BentoCard";
import EmptyState from "@/components/ui/EmptyState";
import KpiGrid from "@/components/ui/KpiGrid";
import KpiMetric from "@/components/ui/KpiMetric";
import Overline from "@/components/ui/Overline";
import Reveal from "@/components/ui/Reveal";
import JsonDiffModal from "@/pages/audit/JsonDiffModal";
import AuditFilters from "@/pages/audit/AuditFilters";
import ExportMenu from "@/pages/audit/ExportMenu";
import { getChangedFields, exportLogsAsCsv, exportLogsAsMarkdown, fetchAllLogs, EXPORT_CAP } from "@/pages/audit/auditExport";
import AuditPeriodSelector, { todayLocal } from "@/pages/audit/AuditPeriodSelector";

// Registros por página: se cargan de 100 en 100 con .range() y "Cargar más".
const PAGE_SIZE = 100;

const TH =
  "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-ink-muted";

const OP_BADGES = {
  INSERT: {
    label: "INSERT",
    className: "border-status-done/40 bg-status-done/15 text-status-done",
  },
  UPDATE: {
    label: "UPDATE",
    className: "border-info/40 bg-info/15 text-info",
  },
  DELETE: {
    label: "DELETE",
    className: "border-status-alert/40 bg-status-alert/15 text-status-alert",
  },
  // Eventos de autenticación
  LOGIN: {
    label: "INICIO DE SESIÓN",
    tr: true,
    className: "border-status-done/40 bg-status-done/15 text-status-done",
  },
  LOGOUT: {
    label: "CIERRE DE SESIÓN",
    tr: true,
    className: "border-line-subtle bg-surface-card text-ink-muted",
  },
  PASSWORD_CHANGE: {
    label: "CAMBIO DE CONTRASEÑA",
    tr: true,
    className: "border-brand/40 bg-brand/15 text-brand",
  },
  // Cambio de correo asistido por un dev (Edge Function admin-change-user-email)
  EMAIL_CHANGE_REQUESTED: {
    label: "CORREO: SOLICITADO",
    tr: true,
    className: "border-line-subtle bg-surface-card text-ink-muted",
  },
  EMAIL_CHANGE: {
    label: "CAMBIO DE CORREO",
    tr: true,
    className: "border-info/40 bg-info/15 text-info",
  },
  EMAIL_CHANGE_FAILED: {
    label: "CORREO: FALLÓ",
    tr: true,
    className: "border-error-border bg-error-bg text-error-text",
  },
};

// Quién hizo la acción: correo del momento del evento (metadata.actor_email) > correo actual > id.
const actorOf = (log, userMap) =>
  log.metadata?.actor_email ||
  userMap[log.user_id] ||
  (log.user_id
    ? `${log.user_id.slice(0, 8)}...`
    : log.metadata?.db_user
      ? `SQL (${log.metadata.db_user})`
      : tx("Sistema / SQL"));

const AuditLogsPage = () => {
  useTranslation(); // re-renderiza al cambiar de idioma (tx lee el idioma activo)
  const [logs, setLogs] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [userList, setUserList] = useState([]); // usuarios (id, full_name, email) para el filtro
  const [loading, setLoading] = useState(true); // solo la primera carga muestra el spinner de página
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [total, setTotal] = useState(0); // coincidencias en BD con los filtros activos
  const [stats, setStats] = useState({ total: 0, inserts: 0, updates: 0, deletes: 0 });
  const [availableTables, setAvailableTables] = useState([]);
  const requestId = useRef(0); // descarta respuestas viejas si el filtro cambia rápido

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [tableFilter, setTableFilter] = useState("ALL");
  const [userFilter, setUserFilter] = useState("ALL"); // id del usuario o "ALL"
  // "today" | "all" | "custom" (custom = el usuario editó Desde/Hasta; ningún botón de periodo queda activo)
  const [dateMode, setDateMode] = useState("today");
  const [dateFrom, setDateFrom] = useState(todayLocal);
  const [dateTo, setDateTo] = useState(todayLocal);
  const [selectedLog, setSelectedLog] = useState(null);
  // Alcance especial: historial de un registro o de una transacción completa.
  // Mientras está activo, los demás filtros (texto, acción, fechas) quedan en pausa.
  const [scope, setScope] = useState(null); // null | { type: "record", table, recordId } | { type: "tx", txid }

  const viewRecordHistory = (log) => {
    setSelectedLog(null);
    setScope({ type: "record", table: log.table_name, recordId: log.record_id });
  };
  const viewTransaction = (log) => {
    setSelectedLog(null);
    setScope({ type: "tx", txid: String(log.metadata.txid) });
  };

  // La búsqueda de texto va al servidor: se espera a que el usuario deje de escribir.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const selectDateMode = (mode) => {
    setDateMode(mode);
    if (mode === "today") {
      const today = todayLocal();
      setDateFrom(today);
      setDateTo(today);
    } else if (mode === "all") {
      setDateFrom("");
      setDateTo("");
    }
  };

  const changeDate = (setter) => (value) => {
    setter(value);
    setDateMode("custom");
  };

  // Todos los filtros viajan al servidor: búsqueda, tabla, acción y fechas.
  const buildParams = () => {
    if (scope?.type === "record") {
      return { p_table: scope.table, p_record: scope.recordId };
    }
    if (scope?.type === "tx") {
      return { p_txid: scope.txid };
    }
    return buildFilterParams();
  };

  const buildFilterParams = () => ({
    p_query: debouncedSearch.trim() || null,
    p_table: tableFilter === "ALL" ? null : tableFilter,
    p_action: actionFilter === "ALL" ? null : actionFilter,
    p_user: userFilter === "ALL" ? null : userFilter,
    p_from: dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : null,
    p_to: dateTo ? new Date(`${dateTo}T23:59:59.999`).toISOString() : null,
  });

  const fetchPage = (offset) =>
    supabase.rpc("audit_logs_search", { ...buildParams(), p_limit: PAGE_SIZE, p_offset: offset });

  const showLoadError = (error, context) => {
    console.error(`Error ${context} bitácora de auditoría:`, error);
    toast({
      title: tx("Error de acceso"),
      description: tx(
        "No se pudieron cargar los registros. Verifica que tu usuario tenga rol DEV activo.",
      ),
      variant: "destructive",
    });
  };

  // Opciones de los filtros (usuarios y tablas): NO dependen de los filtros activos ni de la carrera de
  // peticiones de loadLogs. Antes viajaban dentro de loadLogs y, bajo React.StrictMode (la app arranca así),
  // la 2.ª ejecución del efecto descartaba la respuesta de la 1.ª y los selectores quedaban vacíos.
  const loadLookups = async () => {
    try {
      const [tablesRes, usersRes] = await Promise.all([
        supabase.rpc("audit_logs_tables"),
        supabase.from("user_profiles").select("id, email, full_name"),
      ]);
      if (tablesRes.error) console.error("Error cargando tablas de la bitácora:", tablesRes.error);
      else setAvailableTables((tablesRes.data || []).map((r) => (typeof r === "string" ? r : Object.values(r)[0])));

      if (usersRes.error) console.error("Error cargando usuarios de la bitácora:", usersRes.error);
      else {
        const users = usersRes.data || [];
        setUserList(users);
        const map = {};
        users.forEach((u) => {
          map[u.id] = u.email || u.full_name || u.id;
        });
        setUserMap(map);
      }
    } catch (error) {
      console.error("Error cargando las opciones de los filtros:", error);
    }
  };

  // Primera página (reinicia la lista) + KPIs exactos.
  const loadLogs = async () => {
    const id = ++requestId.current;
    try {
      setRefreshing(true);
      const [pageRes, statsRes] = await Promise.all([
        fetchPage(0),
        supabase.rpc("audit_logs_stats", buildParams()),
      ]);
      if (id !== requestId.current) return; // llegó una respuesta más nueva
      if (pageRes.error) throw pageRes.error;
      if (statsRes.error) throw statsRes.error;

      const rows = pageRes.data || [];
      const s = (statsRes.data || [])[0] || {};
      setLogs(rows);
      setTotal(Number(rows[0]?.total ?? 0));
      setStats({
        total: Number(s.total ?? 0),
        inserts: Number(s.inserts ?? 0),
        updates: Number(s.updates ?? 0),
        deletes: Number(s.deletes ?? 0),
      });
    } catch (error) {
      if (id === requestId.current) showLoadError(error, "cargando");
    } finally {
      if (id === requestId.current) {
        setRefreshing(false);
        setLoading(false);
      }
    }
  };

  // Siguiente página: se agrega al final de lo ya cargado.
  const loadMore = async () => {
    const id = requestId.current;
    try {
      setLoadingMore(true);
      const res = await fetchPage(logs.length);
      if (id !== requestId.current) return;
      if (res.error) throw res.error;
      const rows = res.data || [];
      setLogs((prev) => [...prev, ...rows]);
      if (rows[0]) setTotal(Number(rows[0].total));
    } catch (error) {
      showLoadError(error, "cargando más de la");
    } finally {
      setLoadingMore(false);
    }
  };

  // Opciones de los filtros: una vez al abrir la página (y con "Actualizar").
  useEffect(() => {
    loadLookups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Registros y KPIs: al abrir y al cambiar cualquier filtro.
  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, tableFilter, actionFilter, userFilter, dateFrom, dateTo, scope]);

  const hasMore = logs.length < total;
  const userOptions = userList
    .map((u) => ({ id: u.id, label: u.full_name?.trim() || u.email || u.id }))
    .sort((a, b) => a.label.localeCompare(b.label, dateLocale()));
  const selectedUserLabel = userOptions.find((u) => u.id === userFilter)?.label;
  const filteredLogs = logs; // ya vienen filtradas desde el servidor

  const eventsLabel =
    dateMode === "today"
      ? tx("Eventos de Hoy")
      : dateMode === "all"
        ? tx("Eventos (Histórico)")
        : tx("Eventos (Rango)");

  const periodText = scope
    ? scope.type === "record"
      ? tx("Historial de {{table}} · {{record}}", { table: scope.table, record: scope.recordId })
      : tx("Transacción {{txid}}", { txid: scope.txid })
    : dateMode === "today"
      ? tx("Hoy ({{date}})", { date: dateFrom })
      : dateMode === "all"
        ? tx("General (todo el histórico)")
        : tx("{{from}} a {{to}}", { from: dateFrom || "…", to: dateTo || "…" });
  const exportScopeText =
    !scope && selectedUserLabel
      ? tx("{{period}} · Usuario: {{user}}", { period: periodText, user: selectedUserLabel })
      : periodText;

  // Exporta TODO lo que coincide con los filtros activos (pidiéndolo al servidor), hasta EXPORT_CAP.
  const runExport = async (format) => {
    try {
      setExporting(true);
      const params = buildParams();
      const { rows, total, truncated } = await fetchAllLogs((offset, limit) =>
        supabase.rpc("audit_logs_search", { ...params, p_limit: limit, p_offset: offset }),
      );
      if (format === "csv") exportLogsAsCsv(rows, userMap);
      else exportLogsAsMarkdown(rows, userMap, exportScopeText);

      if (truncated) {
        toast({
          title: tx("Exportación parcial"),
          description: tx(
            "Se exportaron los primeros {{shown}} de {{total}} registros (tope {{cap}}). Acota los filtros para exportar el resto.",
            {
              shown: rows.length.toLocaleString(dateLocale()),
              total: total.toLocaleString(dateLocale()),
              cap: EXPORT_CAP.toLocaleString(dateLocale()),
            },
          ),
        });
      }
    } catch (error) {
      console.error("Error exportando bitácora de auditoría:", error);
      toast({
        title: tx("No se pudo exportar"),
        description: tx("Ocurrió un error al pedir los registros al servidor. Inténtalo de nuevo."),
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };
  const handleExportCsv = () => runExport("csv");
  const handleExportMarkdown = () => runExport("md");

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background">
        <LoadingSpinner size="lg" text={tx("Cargando registros de auditoría...")} />
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <Helmet>
        <title>{tx("Auditoría y Registros - VINDGROUP")}</title>
      </Helmet>

      <div className="min-h-[calc(100vh-4rem)] w-full bg-background p-4 text-ink sm:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <Reveal>
            <PageHeader
              icon={<FileCheck2 size={24} />}
              overline={tx("Trazabilidad Append-Only · Solo DEV")}
              title={tx("Auditoría y Registros")}
              description={tx(
                "Historial inmutable de inserciones, modificaciones y eliminaciones capturadas en la base de datos.",
              )}
            />
          </Reveal>

          {/* KPIs */}
          <Reveal delay={0.05}>
            <BentoCard as="section" flat aria-label={tx("Resumen de auditoría")}>
              {/* Selector de periodo: arriba a la derecha, sobre las métricas */}
              <div className="flex justify-end border-b border-line-subtle px-5 py-3">
                <AuditPeriodSelector mode={dateMode} onChange={selectDateMode} />
              </div>
              <KpiGrid className="lg:grid-cols-4">
                <KpiMetric
                  className="p-5"
                  label={eventsLabel}
                  value={stats.total}
                  icon={<FileCheck2 size={18} />}
                  iconClassName="text-info"
                />
                <KpiMetric
                  className="p-5"
                  label={tx("Creaciones (INSERT)")}
                  value={stats.inserts}
                  icon={<PlusCircle size={18} />}
                  iconClassName="text-status-done"
                />
                <KpiMetric
                  className="p-5"
                  label={tx("Ediciones (UPDATE)")}
                  value={stats.updates}
                  icon={<Pencil size={18} />}
                  iconClassName="text-brand"
                />
                <KpiMetric
                  className="p-5"
                  label={tx("Eliminaciones (DELETE)")}
                  value={stats.deletes}
                  icon={<Trash2 size={18} />}
                  iconClassName="text-status-alert"
                />
              </KpiGrid>
            </BentoCard>
          </Reveal>

          {/* Tabla */}
          <Reveal delay={0.1}>
            <BentoCard as="section" flat aria-labelledby="audit-table-title">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-5 py-4">
                <div>
                  <Overline
                    as="h2"
                    id="audit-table-title"
                    className="flex items-center gap-2 text-ink"
                  >
                    <FileCheck2 size={14} className="text-info" />
                    {tx("Bitácora de Base de Datos")}
                  </Overline>
                  <p className="mt-1 text-xs text-ink-muted">
                    {tx(
                      "Mostrando {{shown}} de {{total}} registros. Haz clic en cualquier fila para ver el detalle y comparar los valores.",
                      { shown: logs.length, total },
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { loadLogs(); loadLookups(); }}
                    disabled={refreshing}
                    className={BTN_PRIMARY}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                    {tx("Actualizar")}
                  </button>
                  <ExportMenu
                    disabled={filteredLogs.length === 0}
                    busy={exporting}
                    onExportCsv={handleExportCsv}
                    onExportMarkdown={handleExportMarkdown}
                  />
                </div>
              </div>

              <div className="p-4 sm:p-5">
                {/* Alcance activo: historial de un registro / transacción */}
                {scope && (
                  <div
                    role="status"
                    className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-info/30 bg-info/15 px-4 py-3 text-sm text-info"
                  >
                    <span>
                      {scope.type === "record" ? (
                        <>
                          {tx("Historial del registro")} <code className="font-mono">{scope.recordId}</code> {tx("en la tabla")}{" "}
                          <code className="font-mono">{scope.table.replace("public.", "")}</code>
                        </>
                      ) : (
                        <>
                          {tx("Todos los eventos de la transacción")} <code className="font-mono">{scope.txid}</code>
                        </>
                      )}
                      <span className="ml-2 text-xs text-ink-muted">
                        {tx("(los demás filtros están en pausa)")}
                      </span>
                    </span>
                    <button type="button" onClick={() => setScope(null)} className={`${BTN_SECONDARY} h-9 px-3 text-xs sm:h-9`}>
                      {tx("Quitar filtro")}
                    </button>
                  </div>
                )}

                {/* Filtros */}
                <AuditFilters
                  searchTerm={searchTerm}
                  onSearchChange={setSearchTerm}
                  tableFilter={tableFilter}
                  onTableChange={setTableFilter}
                  availableTables={availableTables}
                  actionFilter={actionFilter}
                  onActionChange={setActionFilter}
                  userFilter={userFilter}
                  onUserChange={setUserFilter}
                  userOptions={userOptions}
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  onDateFromChange={changeDate(setDateFrom)}
                  onDateToChange={changeDate(setDateTo)}
                />

                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-line-subtle">
                        <th className={TH}>{tx("Fecha y Hora")}</th>
                        <th className={TH}>{tx("Usuario / Rol")}</th>
                        <th className={TH}>{tx("Acción")}</th>
                        <th className={TH}>{tx("Tabla")}</th>
                        <th className={TH}>{tx("Campos Afectados")}</th>
                        <th className={`${TH} text-right`}>JSON</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((log) => {
                        const badge = OP_BADGES[log.action] || {
                          label: log.action,
                          className:
                            "border-line-subtle bg-surface-card text-ink",
                        };
                        const actorDisplay = actorOf(log, userMap);
                        const changedFields = getChangedFields(
                          log.old_data,
                          log.new_data
                        );

                        return (
                          <tr
                            key={log.id}
                            onClick={() => setSelectedLog(log)}
                            className="cursor-pointer border-b border-line-subtle transition-colors last:border-0 hover:bg-surface-card"
                          >
                            <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs tabular-nums text-ink-muted">
                              {new Date(log.created_at).toLocaleString(dateLocale(), {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </td>

                            <td className="whitespace-nowrap px-4 py-3.5">
                              <div className="text-sm font-medium text-ink">
                                {actorDisplay}
                              </div>
                              {log.user_role && (
                                <RoleChip
                                  role={log.user_role}
                                  label={getRoleName(log.user_role)}
                                  className="mt-1"
                                />
                              )}
                            </td>

                            <td className="whitespace-nowrap px-4 py-3.5">
                              <span
                                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${badge.className}`}
                              >
                                {badge.tr ? tx(badge.label) : badge.label}
                              </span>
                            </td>

                            <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs text-ink">
                              {log.table_name.replace("public.", "")}
                            </td>

                            <td className="px-4 py-3.5">
                              <div className="flex max-w-xs flex-wrap gap-1">
                                {changedFields.slice(0, 4).map((field) => (
                                  <span
                                    key={field}
                                    className="rounded border border-line-subtle bg-surface-panel px-1.5 py-0.5 font-mono text-[11px] text-ink-muted"
                                  >
                                    {field}
                                  </span>
                                ))}
                                {changedFields.length > 4 && (
                                  <span className="text-[11px] text-ink-muted">
                                    {tx("+{{n}} más", { n: changedFields.length - 4 })}
                                  </span>
                                )}
                              </div>
                              {/* Motivo (p. ej. cambio de correo asistido por un dev): visible sin abrir el detalle */}
                              {log.metadata?.reason && (
                                <p className="mt-1.5 line-clamp-3 max-w-xs break-words text-xs text-ink" title={log.metadata.reason}>
                                  <span className="font-semibold text-brand">{tx("Motivo:")}</span> {log.metadata.reason}
                                </p>
                              )}
                            </td>

                            <td className="whitespace-nowrap px-4 py-3.5 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedLog(log);
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-line-subtle bg-surface-panel px-2.5 py-1 text-xs text-ink transition-colors hover:border-info/50 hover:text-info"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                {tx("Ver diff")}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {filteredLogs.length === 0 && (
                    <EmptyState>
                      {tx("No hay registros de auditoría que coincidan con los filtros.")}
                    </EmptyState>
                  )}
                </div>

                {/* Paginación: de 100 en 100 */}
                {total > 0 && (
                  <div className="mt-4 flex flex-col items-center gap-2 border-t border-line-subtle pt-4">
                    {hasMore ? (
                      <button
                        type="button"
                        onClick={loadMore}
                        disabled={loadingMore}
                        className={BTN_SECONDARY}
                      >
                        {loadingMore ? tx("Cargando...") : tx("Cargar más ({{n}})", { n: Math.min(PAGE_SIZE, total - logs.length) })}
                      </button>
                    ) : (
                      <p className="text-xs text-ink-muted">{tx("Se cargaron todos los registros del periodo.")}</p>
                    )}
                    <p className="text-xs text-ink-muted">
                      {tx("{{shown}} de {{total}} registros cargados", { shown: logs.length, total })}
                    </p>
                  </div>
                )}
              </div>
            </BentoCard>
          </Reveal>
        </div>
      </div>

      {selectedLog && (
        <JsonDiffModal
          log={selectedLog}
          actor={actorOf(selectedLog, userMap)}
          onClose={() => setSelectedLog(null)}
          onViewRecord={viewRecordHistory}
          onViewTransaction={viewTransaction}
        />
      )}
    </MotionConfig>
  );
};

export default AuditLogsPage;
