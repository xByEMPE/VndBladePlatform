import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

// Orígenes de navegador permitidos (secreto opcional, separados por comas). Sin él, no se envía
// Access-Control-Allow-Origin; los llamadores servidor-a-servidor no usan CORS.
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
// Roles de usuario (JWT) autorizados a disparar el aviso
const ALLOWED_ROLES = ['admin', 'technician']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const buildCors = (req: Request) => {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
  const origin = req.headers.get('Origin') ?? ''
  if (ALLOWED_ORIGINS.includes(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

const json = (req: Request, body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCors(req), 'Content-Type': 'application/json' },
  })

const escapeHtml = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const oneLine = (s: unknown) => String(s ?? '').replace(/[\r\n]+/g, ' ').slice(0, 200)

// Comparación en tiempo constante (evita filtrar la clave por tiempos de respuesta)
const safeEqual = (a: string, b: string) => {
  const enc = new TextEncoder()
  const x = enc.encode(a)
  const y = enc.encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

serve(async (req) => {
  // Preflight: responde sin consultar nada
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: buildCors(req) })
  }
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    console.error('[notify-inspection-complete] faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
    return json(req, { error: 'Internal error' }, 500)
  }
  const supabaseClient = createClient(supabaseUrl, serviceKey)

  // 1. Identidad: antes de consultar turbinas o enviar correos
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return json(req, { error: 'Unauthorized' }, 401)

  // Llamadas de backend (webhook / pipeline) con la service_role; el resto debe ser un usuario válido
  const isService = safeEqual(token, serviceKey)

  if (!isService) {
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) return json(req, { error: 'Unauthorized' }, 401)

    // Solo personal interno
    const { data: profile } = await supabaseClient
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
      return json(req, { error: 'Forbidden' }, 403)
    }
  }

  try {
    let body: { turbineId?: unknown }
    try {
      body = await req.json()
    } catch {
      return json(req, { error: 'Invalid request' }, 400)
    }
    const turbineId = body?.turbineId
    if (typeof turbineId !== 'string' || !UUID_RE.test(turbineId)) {
      return json(req, { error: 'Invalid turbineId' }, 400)
    }

    // 2. Fetch Turbine Name and Project details
    const { data: turbineData, error: turbineError } = await supabaseClient
      .from('turbines')
      .select(`
        turbine_name,
        projects (
          name,
          wind_farm
        )
      `)
      .eq('id', turbineId)
      .maybeSingle()

    if (turbineError) throw turbineError
    if (!turbineData) return json(req, { error: 'Not found' }, 404)

    const turbineName = turbineData.turbine_name
    const projectName = turbineData.projects?.name || 'Desconocido'
    const windFarm = turbineData.projects?.wind_farm || 'Desconocido'

    // 3. Fetch all admins emails
    const { data: adminProfiles, error: profilesError } = await supabaseClient
      .from('user_profiles')
      .select('email')
      .eq('role', 'admin')

    if (profilesError) throw profilesError

    const adminEmails = adminProfiles.filter((p) => p.email).map((p) => p.email)

    if (adminEmails.length === 0) {
      return json(req, { message: "No admins found to notify." }, 200)
    }

    // 4. Send Email via Hostinger SMTP
    const client = new SMTPClient({
      connection: {
        hostname: Deno.env.get("SMTP_HOSTNAME") || 'smtp.hostinger.com',
        port: Number(Deno.env.get("SMTP_PORT")) || 465,
        tls: true,
        auth: {
          username: Deno.env.get("SMTP_USERNAME") || '',
          password: Deno.env.get("SMTP_PASSWORD") || '',
        },
      },
    });

    const emailTemplate = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:'Arial',sans-serif;background:#f5f5f5;margin:0;padding:20px;}
.container{max-width:600px;margin:0 auto;background:white;border-radius:10px;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.1);}
.header{background:linear-gradient(135deg,#0a0f1c 0%,#1a2332 50%,#0f1829 100%);padding:40px 30px;text-align:center;}
.logo{color:#eab308;font-size:24px;font-weight:bold;margin-bottom:10px;}
.subtitle{color:#9ca3af;font-size:14px;}
.content{padding:40px 30px;}
.button{display:inline-block;background:#eab308;color:#000;padding:15px 30px;text-decoration:none;border-radius:8px;font-weight:bold;margin:20px 0;}
.footer{background:#f8f9fa;padding:20px 30px;text-align:center;font-size:12px;color:#6b7280;}
</style></head><body><div class="container"><div class="header">
<div class="logo">VIND REPORT PLATFORM</div><div class="subtitle">Inspección Completada Exitosamente</div></div>
<div class="content"><h2 style="color:#1f2937;margin-bottom:20px;">Nueva carga de inspección completada</h2>
<p style="color:#4b5563;line-height:1.6;">Se le notifica que una inspección completa (3 palas y sus secciones) ha terminado de cargarse exitosamente en la plataforma.</p>
<div style="background-color:#f3f4f6;padding:15px;border-radius:8px;margin:20px 0;">
<p style="color:#4b5563;margin:5px 0;"><strong>Parque Eólico:</strong> ${escapeHtml(windFarm)}</p>
<p style="color:#4b5563;margin:5px 0;"><strong>Proyecto:</strong> ${escapeHtml(projectName)}</p>
<p style="color:#4b5563;margin:5px 0;"><strong>Máquina / Turbina:</strong> ${escapeHtml(turbineName)}</p></div>
<p style="color:#4b5563;line-height:1.6;">Ya puede proceder a ingresar al portal para revisar los resultados, daños detectados y proceder con la validación de la turbina.</p></div>
<div class="footer"><p>© 2026 Vind Report Platform — All rights reserved</p><p>vnd-blade-platform.com.mx</p></div></div></body></html>`;

    try {
      for (const email of adminEmails) {
        await client.send({
          from: Deno.env.get("SMTP_USERNAME") || "noreply@vnd-blade-platform.com.mx",
          to: email,
          subject: `Inspección Completada: Turbina ${oneLine(turbineName)}`,
          html: emailTemplate,
        })
      }
    } finally {
      await client.close()
    }

    return json(req, { success: true, notified: adminEmails.length }, 200)
  } catch (error) {
    // El detalle va solo al log del servidor; el cliente recibe un mensaje genérico
    console.error('[notify-inspection-complete]', error)
    return json(req, { error: 'Internal error' }, 500)
  }
})
