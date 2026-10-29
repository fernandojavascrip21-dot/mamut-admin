-- T-10 · Preparar la base para los vendedores (teléfono y precios por vendedor)
-- Ver specs/M2-t10-base-vendedores/spec.md

-- 0. Precondición: los datos actuales deben cumplir los checks nuevos ---------
-- Un vendedor sin teléfono o un precio/costo <= 0 se corrige a mano; aquí no se inventan datos.
-- `phone` todavía no existe, así que cualquier perfil 'vendedor' lo tendría nulo.

do $$
declare
  sellers_without_phone text;
  bad_vendor_prices text;
begin
  select string_agg(p.id::text, ', ' order by p.id) into sellers_without_phone
  from public.profiles p
  where p.role = 'vendedor';

  if sellers_without_phone is not null then
    raise exception 'Hay vendedores sin teléfono; captúralo antes de aplicar esta migración: %', sellers_without_phone;
  end if;

  select string_agg(v.id::text, ', ' order by v.id) into bad_vendor_prices
  from public.vendor_stock v
  where v.unit_price <= 0 or v.unit_cost_with_shipping <= 0;

  if bad_vendor_prices is not null then
    raise exception 'vendor_stock tiene precio o costo con envío <= 0 en las filas: %', bad_vendor_prices;
  end if;
end $$;

-- 1. Teléfono ----------------------------------------------------------------
-- Nulo para administradores y clientes; obligatorio para vendedores (spec T-10 §3).
-- Exactamente 10 dígitos, sin espacios, guiones ni +52: el formulario de HU-08 lo normaliza.

alter table public.profiles
  add column phone text;

alter table public.profiles
  add constraint profiles_phone_format_check
    check (phone is null or phone ~ '^[0-9]{10}$');

alter table public.profiles
  add constraint profiles_seller_phone_required_check
    check (role <> 'vendedor' or phone is not null);

-- 2. Precio y costo con envío por vendedor -------------------------------------
-- Nulo = usar el precio general / el costo de fábrica (RF-26, RF-27); si se escribe, > 0
-- como en los productos. No tocan `qty`, que sigue siendo del trigger de T-07.

alter table public.vendor_stock
  add constraint vendor_stock_unit_price_check
    check (unit_price is null or unit_price > 0);

alter table public.vendor_stock
  add constraint vendor_stock_unit_cost_with_shipping_check
    check (unit_cost_with_shipping is null or unit_cost_with_shipping > 0);
