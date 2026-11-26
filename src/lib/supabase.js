// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'
import { USER_ROLES } from './utils'

// Para Vite, usar import.meta.env directamente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key'

// false cuando el build se hizo sin VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (los valores de arriba son solo respaldo)
export const isSupabaseConfigured =
  Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY)
if (!isSupabaseConfigured) {
  console.error('[Supabase] Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en el build: el login y las consultas fallarán.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
})

// Función helper para subir archivos
export const uploadFile = async (file, path) => {
  try {
    const { data, error } = await supabase.storage
      .from('images') 
      .upload(path, file, {
        cacheControl: '15552000',
        upsert: false
      })

    if (error) {
      throw error
    }

    return data
  } catch (error) {
    console.error('Error uploading file:', error)
    throw error
  }
}

// Función para subir múltiples archivos con progreso
export const uploadMultipleFiles = async (files, onProgress = () => {}) => {
  const results = []
  let completed = 0

  for (const { file, path } of files) {
    try {
      const result = await uploadFile(file, path)
      results.push({ success: true, path, result })
      completed++
      onProgress(Math.round((completed / files.length) * 100))
    } catch (error) {
      results.push({ success: false, path, error: error.message })
      completed++
      onProgress(Math.round((completed / files.length) * 100))
    }
  }

  return results
}

// Obtiene el rol del usuario logueado desde la tabla user_profiles
export const fetchCurrentUserRole = async () => {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    // Si el usuario no existe (token inválido/stale), cerrar sesión forzosamente
    if (authError && authError.code === 'user_not_found') {
      console.warn('Stale session detected, signing out...', authError)
      await supabase.auth.signOut()
      window.location.reload() // Recargar para limpiar estado
      return null
    }

    if (!user) return null

    // Usar RPC para evitar problemas de RLS
    const { data, error } = await supabase.rpc('get_current_user_role')

    if (error) {
      console.error('Error with RPC, falling back to direct query:', error)
      // Fallback: usar service role query si existe
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (fallbackError) {
        console.warn('Fallback query failed:', fallbackError)
        return USER_ROLES.CLIENT // Default role
      }
      return fallbackData?.role || USER_ROLES.CLIENT
    }

    return data || USER_ROLES.CLIENT
  } catch (err) {
    console.error('Error fetching user role:', err)
    return USER_ROLES.CLIENT // Default to client role
  }
}