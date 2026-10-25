-- HU-04 · Dar de alta un producto nuevo (Mammut) — corrección
-- Ver specs/M1-hu04-dar-de-alta-producto/spec.md §5
--
-- La política `product_photos_admin_insert` (migración 20261025000001) consultaba
-- `public.profiles` directo desde su EXISTS. `profiles` tiene RLS activado SIN ninguna
-- política (bloquea todo acceso que no sea el dueño de la tabla, a propósito: el único
-- camino sancionado para leer/escribir profiles es el backend de Next.js, que se conecta
-- con un rol que sí evade RLS). Eso significa que, bajo el rol `authenticated` con el que
-- corre esta política, el EXISTS siempre veía cero filas y rechazaba a cualquier admin real
-- (verificado manualmente: SCRUM-21 criterio 6, al intentar subir una foto real).
--
-- Arreglo: una función SECURITY DEFINER (patrón estándar de Supabase para este caso) que
-- corre con los privilegios de quien la creó, evadiendo el RLS de `profiles` solo para esta
-- comprobación puntual, sin agregarle ninguna política propia a `profiles`.

create or replace function public.is_active_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where profiles.id = uid and profiles.role = 'admin' and profiles.active
  );
$$;

drop policy if exists "product_photos_admin_insert" on storage.objects;

create policy "product_photos_admin_insert" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'product-photos'
    and public.is_active_admin(auth.uid())
  );
