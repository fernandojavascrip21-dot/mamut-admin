import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Falta ${name}`)
  return value
}

const options = { auth: { persistSession: false, autoRefreshToken: false } }

// Cliente con la llave pública: valida tokens y hace login de usuarios.
export function supabaseAuth(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), options)
}

// Cliente con la llave de servicio: administra cuentas de Auth (crear, borrar, cambiar contraseña).
// Solo servidor; nunca se expone al navegador.
export function supabaseAdmin(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), options)
}
