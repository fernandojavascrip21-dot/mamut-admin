-- Negocio del vendedor (spec M13-t42): nombre opcional del lugar donde vende (gimnasio, cafetería…).
-- Es nulo para todos los perfiles existentes, así que no cambia administradores, clientes ni vendedores.
-- No es único: dos vendedores pueden tener el mismo negocio (por ejemplo, dos sucursales).

alter table public.profiles add column business_name text;

-- Red de seguridad: el backend ya recorta y valida antes de guardar. Sin espacios en los extremos y de
-- 1 a 80 caracteres; vacío se guarda como null.
alter table public.profiles add constraint profiles_business_name_check
  check (
    business_name is null
    or (char_length(business_name) between 1 and 80 and business_name = btrim(business_name))
  );
