-- HU-04 · Dar de alta un producto nuevo (Mammut) — revierte la subida directa desde Angular
-- Ver specs/M1-hu04-dar-de-alta-producto/spec.md §2, §8 y §9
--
-- Verificación manual (Paso 9 de /spec-impl): aun con la política de insert corregida
-- (20261025000002, función SECURITY DEFINER `is_active_admin`, lógica confirmada correcta
-- en Postgres), el servicio de Storage de Supabase seguía rechazando la subida con el JWT de
-- un administrador real ("new row violates row-level security policy"). Es un comportamiento
-- específico de cómo ese servicio evalúa RLS con las llaves/firma de este proyecto, no un
-- error de la política en sí; no se pudo diagnosticar más a fondo sin acceso a sus logs.
--
-- Decisión del usuario: en vez de seguir investigando el lado de Supabase, se revierte el
-- enfoque — el backend recibe la foto (multipart) y la sube él mismo con la llave de
-- servicio (que ya evade RLS por diseño). Ya no hace falta que un cliente autenticado suba
-- directo al bucket, así que se quita la política y la función que solo existían para eso.

drop policy if exists "product_photos_admin_insert" on storage.objects;
drop function if exists public.is_active_admin(uuid);
