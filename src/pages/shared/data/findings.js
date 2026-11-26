import { supabase } from "@/lib/supabase";

// Envoltorios finos sobre la tabla `findings`: devuelven el mismo builder/resultado
// ({ data, error }) que Supabase. El manejo de errores, toasts y la construcción de
// payloads permanece en cada página.

export const deleteFinding = (id) => supabase.from("findings").delete().eq("id", id);

export const updateFinding = (id, payload) =>
  supabase.from("findings").update(payload).eq("id", id);

export const updateFindingReturning = (id, payload) =>
  supabase.from("findings").update(payload).eq("id", id).select().single();

export const insertFinding = (payload) => supabase.from("findings").insert(payload);

export const insertFindingReturning = (payload) =>
  supabase.from("findings").insert(payload).select().single();

export const getFindingAttributesAndRegion = (id) =>
  supabase.from("findings").select("attributes, region").eq("id", id).maybeSingle();

export const upsertFindingReturning = (payload) =>
  supabase.from("findings").upsert(payload).select().single();


export const listFindingsWithCapture = (bladeIds) =>
  supabase
    .from("findings")
          .select(
            `
                *,
                captures!inner (
                    id,
                    blade_id,
                    section,
                    storage_path,
                    blades!inner (position)
                )
            `,
          )
          .in("captures.blade_id", bladeIds);
