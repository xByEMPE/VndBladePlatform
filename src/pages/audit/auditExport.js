// Exportación de la bitácora de auditoría: funciones puras (construyen texto) + descarga.
// Los textos del archivo siguen el idioma activo (tx).
import { tx, dateLocale } from "@/i18n/tx";

const actorOf = (log, userMap) =>
  log.metadata?.actor_email || userMap[log.user_id] || log.user_id || tx("Sistema");

const stamp = () => new Date().toISOString().slice(0, 10);

/** Campos que difieren entre old_data y new_data (ignora updated_at). */
export const getChangedFields = (oldData, newData) => {
  if (!oldData && newData) return Object.keys(newData);
  if (oldData && !newData) return Object.keys(oldData);
  if (!oldData || !newData) return [];

  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  const changed = [];
  allKeys.forEach((key) => {
    if (key === "updated_at") return;
    if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
      changed.push(key);
    }
  });
  return changed;
};

const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export const buildCsv = (logs, userMap) => {
  const headers = [
    tx("Fecha"),
    tx("Actor"),
    tx("Rol"),
    tx("Operacion"),
    tx("Tabla"),
    tx("Registro_ID"),
    "IP",
    tx("Datos_Anteriores"),
    tx("Datos_Nuevos"),
    tx("Motivo"),
  ];
  const rows = logs.map((l) => [
    new Date(l.created_at).toISOString(),
    actorOf(l, userMap),
    l.user_role || "-",
    l.action,
    l.table_name,
    l.record_id || "-",
    l.metadata?.ip || "-",
    JSON.stringify(l.old_data || {}),
    JSON.stringify(l.new_data || {}),
    l.metadata?.reason || "",
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
};

// Celdas de tabla Markdown: escapa pipes y saltos de línea.
const mdCell = (value) =>
  String(value ?? "-").replaceAll("|", "\\|").replaceAll("\n", " ");

const fmtValue = (v) => (v === undefined ? "∅" : JSON.stringify(v));

/**
 * Markdown: resumen en tabla + detalle de cambios por evento.
 * @param {Array} logs registros ya filtrados
 * @param {Record<string,string>} userMap id -> correo
 * @param {string} scopeText descripción del filtro activo (p. ej. "Hoy")
 */
export const buildMarkdown = (logs, userMap, scopeText) => {
  const lines = [
    `# ${tx("Auditoría y Registros")} · VINDGROUP`,
    "",
    `- **${tx("Generado:")}** ${new Date().toLocaleString(dateLocale())}`,
    `- **${tx("Periodo:")}** ${scopeText}`,
    `- **${tx("Eventos:")}** ${logs.length}`,
    "",
    `## ${tx("Resumen")}`,
    "",
    `| ${tx("Fecha")} | ${tx("Actor")} | ${tx("Rol")} | ${tx("Operación")} | ${tx("Tabla")} | ${tx("Registro")} | ${tx("Campos afectados")} | ${tx("Motivo")} |`,
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];

  logs.forEach((l) => {
    const fields = getChangedFields(l.old_data, l.new_data).join(", ") || "-";
    lines.push(
      `| ${mdCell(new Date(l.created_at).toLocaleString(dateLocale()))} | ${mdCell(actorOf(l, userMap))} | ${mdCell(l.user_role)} | ${l.action} | ${mdCell(l.table_name?.replace("public.", ""))} | ${mdCell(l.record_id)} | ${mdCell(fields)} | ${mdCell(l.metadata?.reason)} |`
    );
  });

  lines.push("", `## ${tx("Detalle de cambios")}`, "");
  logs.forEach((l, i) => {
    lines.push(
      `### ${i + 1}. ${l.action} · ${l.table_name?.replace("public.", "")} · ${new Date(l.created_at).toLocaleString(dateLocale())}`,
      "",
      `- ${tx("Actor")}: ${actorOf(l, userMap)}${l.user_role ? ` (${l.user_role})` : ""}`,
      `- ${tx("Registro")}: \`${l.record_id || "-"}\``
    );
    if (l.metadata?.reason) lines.push(`- ${tx("Motivo")}: ${String(l.metadata.reason).replace(/[\r\n]+/g, " ")}`);
    if (l.metadata?.ip) lines.push(`- IP: \`${l.metadata.ip}\``);

    const oldData = l.old_data || {};
    const newData = l.new_data || {};
    const fields = getChangedFields(l.old_data, l.new_data);
    if (fields.length) {
      lines.push("", `| ${tx("Campo")} | ${tx("Valor anterior")} | ${tx("Valor nuevo")} |`, "| --- | --- | --- |");
      fields.forEach((f) => {
        lines.push(
          `| \`${f}\` | ${mdCell(fmtValue(oldData[f]))} | ${mdCell(fmtValue(newData[f]))} |`
        );
      });
    }
    lines.push("");
  });

  return lines.join("\n");
};

/** Descarga un texto como archivo (Blob, sin límites de longitud de URL). */
export const downloadTextFile = (filename, content, mime) => {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportLogsAsCsv = (logs, userMap) =>
  // BOM para que Excel respete los acentos
  downloadTextFile(`vindgroup_auditoria_${stamp()}.csv`, "\uFEFF" + buildCsv(logs, userMap), "text/csv");

export const exportLogsAsMarkdown = (logs, userMap, scopeText) =>
  downloadTextFile(
    `vindgroup_auditoria_${stamp()}.md`,
    buildMarkdown(logs, userMap, scopeText),
    "text/markdown"
  );

// Tope de filas por exportación: evita saturar el navegador (memoria y tiempo).
export const EXPORT_CAP = 5000;
const EXPORT_PAGE_SIZE = 500; // máximo que permite audit_logs_search por llamada

/**
 * Pide al servidor TODAS las páginas que coinciden con los filtros, hasta el tope.
 * @param {(offset: number, limit: number) => Promise<{ data: any[]|null, error: any }>} fetchPage
 * @returns {Promise<{ rows: any[], total: number, truncated: boolean }>}
 *   `total` = coincidencias reales en la base; `truncated` = hubo más que el tope.
 */
export const fetchAllLogs = async (fetchPage, { cap = EXPORT_CAP, pageSize = EXPORT_PAGE_SIZE } = {}) => {
  const rows = [];
  let total = 0;
  while (rows.length < cap) {
    const limit = Math.min(pageSize, cap - rows.length);
    const { data, error } = await fetchPage(rows.length, limit);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    total = Number(data[0].total ?? rows.length);
    if (rows.length >= total) break;
  }
  return { rows, total: Math.max(total, rows.length), truncated: total > rows.length };
};
