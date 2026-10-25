// Llave anónima (publishable): es pública por diseño. Quien sube a `product-photos` manda
// además el JWT de sesión del administrador (ver specs/M1-hu04-dar-de-alta-producto/spec.md
// §2); sin eso, la política de insert de Storage lo rechaza aunque tenga esta llave. La URL
// de producción queda fuera de este spec, igual que API_BASE_URL.
export const SUPABASE_URL = 'https://hcgzidhizxdbkgllupiw.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_YDtmkZgOMUyBEjA2LVVLcQ_BSHR_CId';
