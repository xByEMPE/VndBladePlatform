import { supabase } from "@/lib/supabase";

// Envoltorios finos sobre la tabla `projects`: devuelven el mismo builder/resultado
// ({ data, error }) que Supabase. Los payloads los construye cada página.

export const getProjectById = (id) => supabase.from("projects").select("*").eq("id", id).single();

export const getProjectByName = (name) =>
  supabase.from("projects").select("*").eq("name", name).single();

export const updateProject = (id, payload) =>
  supabase.from("projects").update(payload).eq("id", id);

export const insertProjectReturning = (rows) =>
  supabase.from("projects").insert(rows).select().single();
