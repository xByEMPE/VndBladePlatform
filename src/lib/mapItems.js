import { resolveTurbinePosition } from './coordinates';
import { parseSeverity } from './severity';

/**
 * Convierte las turbinas del proyecto + las filas de la RPC `get_project_map_data` en los `items`
 * que consume TurbineMap. Solo incluye las turbinas recibidas (la pantalla ya filtró las que un
 * cliente no puede ver) y conserva su orden.
 *
 * @param {{
 *   turbines: Array<{ id: string, turbine_name: string, model?: string, coordinates?: any }>,
 *   mapRows: Array<{ turbine_id: string, max_severity: number|null, damage_count: number,
 *                    est_lat: number|null, est_lon: number|null }> | null,
 *   resolveStatus: (turbine) => { key: 'done'|'progress'|'pending'|string, label: string },
 *   canOpenReport: (turbine) => boolean,
 * }} args
 */
export const buildMapItems = ({ turbines, mapRows, resolveStatus, canOpenReport }) => {
  const rowById = new Map((mapRows || []).map((r) => [r.turbine_id, r]));
  return (turbines || []).map((turbine) => {
    const row = rowById.get(turbine.id);
    const estimated = row && row.est_lat != null && row.est_lon != null ? { lat: row.est_lat, lon: row.est_lon } : null;
    const { key, label } = resolveStatus(turbine);
    return {
      id: turbine.id,
      name: turbine.turbine_name,
      model: turbine.model || undefined,
      statusKey: key,
      statusLabel: label,
      severity: parseSeverity(row?.max_severity),
      damageCount: Number(row?.damage_count) || 0,
      position: resolveTurbinePosition(turbine.coordinates, estimated),
      canOpenReport: Boolean(canOpenReport(turbine)),
      photoPath: turbine.id_image_path || null, // foto de identificación (ruta en el bucket "images")
    };
  });
};
