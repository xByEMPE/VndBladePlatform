import { supabase } from "@/lib/supabase";

// Envoltorios finos sobre la tabla `turbines`: devuelven el mismo builder/resultado
// ({ data, error }) que Supabase.

export const getTurbineByProjectAndName = (projectId, turbineName) =>
  supabase
    .from("turbines")
    .select("*")
    .eq("project_id", projectId)
    .eq("turbine_name", turbineName)
    .single();

export const getTurbineGeometry = (projectId, turbineName) =>
  supabase
    .from("turbines")
    .select("coordinates, blade_length")
    .eq("project_id", projectId)
    .eq("turbine_name", turbineName) // Try 'turbine_name' col
    .maybeSingle();

// Alternativa cuando el esquema usa la columna 'name'
export const getTurbineGeometryLegacy = (projectId, turbineName) =>
  supabase
    .from("turbines")
    .select("coordinates, blade_length")
    .eq("project_id", projectId)
    .eq("name", turbineName)
    .maybeSingle();

export const listTurbinesByProject = (projectId) =>
  supabase.from("turbines").select("*").eq("project_id", projectId);

export const getTurbineStitched = (id) =>
  supabase.from("turbines").select("stitched").eq("id", id).maybeSingle();

export const getTurbineStitchedStrict = (id) =>
  supabase.from("turbines").select("stitched").eq("id", id).single();

export const updateTurbine = (id, payload) =>
  supabase.from("turbines").update(payload).eq("id", id);

// .select("id") permite detectar escrituras bloqueadas por permisos (0 filas, sin error)
export const updateTurbineReturningId = (id, payload) =>
  supabase.from("turbines").update(payload).eq("id", id).select("id");
