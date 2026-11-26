import { supabase } from "@/lib/supabase";

// Envoltorios finos sobre la tabla `blades`: devuelven el mismo builder/resultado
// ({ data, error }) que Supabase. El texto de cada select se conserva tal cual.

export const listBladesByTurbine = (turbineId) =>
  supabase
    .from("blades")
        .select("id, position, turbine_id")
        .eq("turbine_id", turbineId);

export const listBladesWithLength = (turbineId) =>
  supabase
    .from("blades")
          .select("id, blade_name, blade_length")
          .eq("turbine_id", turbineId);
