import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase-config';

// No se usa `supabase.auth`: la sesión del administrador ya la maneja `AuthService` por su
// cuenta (mismo patrón que `supabaseAuth()`/`supabaseAdmin()` en el backend). Cada llamada que
// necesita autorizarse ante una política de RLS (como subir a `product-photos`) construye su
// propio cliente con el token vigente, en vez de congelar uno solo al arrancar la app — el
// token se refresca con el tiempo y un cliente creado una sola vez quedaría con uno viejo.
export function createSupabaseClient(accessToken?: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  });
}
