import { supabase } from "@/lib/supabase";

// Catálogos de empresas y parques eólicos (mismo resultado { data, error } de Supabase).

export const fetchCompanies = () => supabase.from("companies").select("*").order("name");

// Incluye metadata (modelos y total de referencia) y el conteo real de aerogeneradores (wind_turbines(count)).
export const fetchWindFarms = () => supabase.from("wind_farms").select("*, wind_turbines(count)").order("name");
