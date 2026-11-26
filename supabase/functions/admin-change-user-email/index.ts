import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { createHandler } from "./handler.js"

// Cambio de correo de OTRA cuenta por un `dev` activo. Toda la lógica y las reglas de seguridad están
// en handler.js (probado con vitest) y en la base (admin_email_change_precheck / _audit / trigger).
//
// Secretos: SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase.
// Opcional: ALLOWED_ORIGINS (orígenes de navegador permitidos, separados por comas).
serve(createHandler({
  env: Deno.env.toObject(),
  createClient,
}))
