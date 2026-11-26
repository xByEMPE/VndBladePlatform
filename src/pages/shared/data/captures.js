import { supabase } from "@/lib/supabase";

// Envoltorios finos sobre la tabla `captures`: devuelven el mismo builder/resultado
// ({ data, error }) que Supabase. El texto de cada select se conserva tal cual.

export const getCaptureByStoragePath = (storagePath) =>
  supabase
    .from("captures")
      .select("id")
      .eq("storage_path", storagePath)
      .single();

export const listCaptureMetadataByIds = (ids) =>
  supabase
    .from("captures")
        .select("id, raw_metadata")
        .in("id", ids);

export const listCapturesByBlade = (bladeId) =>
  supabase
    .from("captures") 
            .select("*, metadata:raw_metadata") // Alias raw_metadata to metadata for compatibility
            .eq("blade_id", bladeId);

export const listSectionCapturesWithBlade = (turbineId, targetSection) =>
  supabase
    .from("captures")
      .select(
        `
        *,
        blades!inner (
             id,
             blade_name,
             turbine_id
        )
      `,
      )
      .eq("blades.turbine_id", turbineId)
      .eq("section", targetSection)
      .order("calculated_height_m", { ascending: true });

export const listCapturesForBlades = (bladeIds) =>
  supabase
    .from("captures")
        .select(
          `
            id, 
            blade_id, 
            section, 
            storage_path, 
            measured_at, 
            created_at, 
            calculated_height_m,
            raw_metadata,
            blades!inner (position)
        `,
        )
        .in("blade_id", bladeIds);

export const listCaptureFilesForBlades = (bladeIds) =>
  supabase
    .from("captures")
          .select(
            "id, blade_id, storage_path, section, created_at, calculated_height_m, raw_metadata",
          )
          .in("blade_id", bladeIds);
