-- Archivado de vendedores (spec M13-hu45 §10): eliminar a un vendedor con historial lo archiva en vez de borrarlo.
-- `archived_at` no nulo = archivado (fuera de listas y detalle; su historial sigue contando en cortes).
-- `archived_email` guarda solo el correo original, como referencia: el correo de Auth se libera.
-- Nulos para todos los perfiles existentes; sin índices nuevos.

alter table public.profiles add column archived_at timestamptz;
alter table public.profiles add column archived_email text;
