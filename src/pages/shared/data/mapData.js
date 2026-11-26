import { supabase } from "@/lib/supabase";

// Envoltorio fino sobre la RPC `get_project_map_data` (SECURITY INVOKER: respeta el RLS del usuario).
// Devuelve { data, error } como Supabase. Una fila por turbina del proyecto:
// { turbine_id, max_severity, damage_count, gps_samples, est_lat, est_lon }.
export const getProjectMapData = (projectId) =>
  supabase.rpc("get_project_map_data", { p_project_id: projectId });
