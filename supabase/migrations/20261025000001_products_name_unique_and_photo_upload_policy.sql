-- HU-04 · Dar de alta un producto nuevo (Mammut)
-- Ver specs/M1-hu04-dar-de-alta-producto/spec.md §5

-- 1. products: nombre único, sin distinguir mayúsculas ni espacios -----------
-- Verificado por separado con una consulta de solo lectura (2026-10-25): hoy
-- no hay nombres duplicados en products, así que este índice no falla al
-- crearse. Si vuelve a aparecer un duplicado legado antes de aplicar esta
-- migración, hay que resolverlo a mano (renombrar o fusionar) primero.

create unique index products_name_lower_key on public.products (lower(trim(name)));

-- 2. product-photos: política de subida, solo para administradores ---------
-- El bucket ya es público para LECTURA desde T-03 (storage.buckets.public =
-- true); sin esta política nadie podía subir, ni con la llave anónima: faltaba
-- el permiso de escritura. Solo deja subir a un usuario autenticado con
-- profiles.role = 'admin' y activo.

create policy "product_photos_admin_insert" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'product-photos'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin' and profiles.active
    )
  );
