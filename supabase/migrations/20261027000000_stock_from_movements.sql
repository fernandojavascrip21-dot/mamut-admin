-- T-07 · El stock solo cambia con movimientos (trigger en la base)
-- Ver specs/M1-t07-stock-por-movimientos/spec.md

-- 0. Precondición: los saldos actuales deben coincidir con sus movimientos ---
-- Si algo no cuadra, se decide a mano con qué movimiento cuadrarlo; aquí no se corrige en silencio.

do $$
declare
  bad_products text;
  bad_vendor_stock text;
begin
  select string_agg(p.id::text, ', ' order by p.id) into bad_products
  from public.products p
  where p.stock <> coalesce((
    select sum(m.qty) from public.stock_movements m
    where m.product_id = p.id and m.holder_profile_id is null
  ), 0);

  if bad_products is not null then
    raise exception 'products.stock no coincide con stock_movements en los productos: %', bad_products;
  end if;

  -- Cada (vendedor, producto) con fila o con movimientos debe cuadrar.
  select string_agg(format('(%s, %s)', k.profile_id, k.product_id), ', ') into bad_vendor_stock
  from (
    select profile_id, product_id from public.vendor_stock
    union
    select holder_profile_id, product_id from public.stock_movements where holder_profile_id is not null
  ) k
  where coalesce((
    select v.qty from public.vendor_stock v
    where v.profile_id = k.profile_id and v.product_id = k.product_id
  ), 0) <> coalesce((
    select sum(m.qty) from public.stock_movements m
    where m.holder_profile_id = k.profile_id and m.product_id = k.product_id
  ), 0);

  if bad_vendor_stock is not null then
    raise exception 'vendor_stock.qty no coincide con stock_movements en (profile_id, product_id): %', bad_vendor_stock;
  end if;
end $$;

-- 1. Checks ------------------------------------------------------------------
-- `qty <> 0` y `products.stock >= 0` ya existen (stock_movements_qty_check, products_stock_check);
-- vendor_stock_qty_check (`qty >= 0`) viene de T-03. Solo falta el signo por tipo y dueño.

-- Signo por tipo y dueño (spec T-07 §3): entrada > 0, salida < 0; holder nulo = bodega.
alter table public.stock_movements
  add constraint stock_movements_qty_sign_check check (
    case
      when type in ('initial', 'purchase') then holder_profile_id is null and qty > 0
      when type = 'delivery' then
        (holder_profile_id is null and qty < 0) or (holder_profile_id is not null and qty > 0)
      when type = 'return' then
        (holder_profile_id is null and qty > 0) or (holder_profile_id is not null and qty < 0)
      when type in ('direct_sale', 'shrinkage', 'fraction_out') then qty < 0
      when type in ('direct_sale_void', 'shrinkage_void', 'fraction_in') then qty > 0
      when type = 'adjustment' then qty <> 0
      else false
    end
  );

-- 2. Mantener la caché desde stock_movements ---------------------------------
-- `stock = stock + qty` es atómico y toma el candado de la fila, así que dos movimientos
-- simultáneos del mismo saldo no se pisan; los checks de >= 0 hacen fallar el que sobre.

create function public.add_to_stock_balance(
  p_product_id bigint, p_holder_profile_id uuid, p_qty integer
) returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_holder_profile_id is null then
    update public.products set stock = stock + p_qty where id = p_product_id;
  else
    insert into public.vendor_stock (profile_id, product_id)
    values (p_holder_profile_id, p_product_id)
    on conflict (profile_id, product_id) do nothing;

    update public.vendor_stock set qty = qty + p_qty, updated_at = now()
    where profile_id = p_holder_profile_id and product_id = p_product_id;
  end if;
end $$;

create function public.apply_stock_movement() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.add_to_stock_balance(new.product_id, new.holder_profile_id, new.qty);
  return null;
end $$;

-- Borrar un movimiento solo lo hacen las pruebas al limpiar; revertirlo mantiene la caché.
create function public.revert_stock_movement() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.add_to_stock_balance(old.product_id, old.holder_profile_id, -old.qty);
  return null;
end $$;

-- Un movimiento no se edita: se corrige con otro (*_void o adjustment).
create function public.reject_stock_movement_update() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'stock_movements no se edita; registra un movimiento compensatorio';
end $$;

create trigger stock_movements_apply
  after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

create trigger stock_movements_revert
  after delete on public.stock_movements
  for each row execute function public.revert_stock_movement();

create trigger stock_movements_reject_update
  before update on public.stock_movements
  for each row execute function public.reject_stock_movement_update();

-- 3. Guardas del saldo -------------------------------------------------------
-- El backend entra como `postgres` con bypassrls, así que revocar permisos de columna no
-- bastaría. Solo el trigger de movimientos (profundidad > 1) puede cambiar el saldo.

create function public.guard_products_stock() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_trigger_depth() <= 1 and (
    (tg_op = 'INSERT' and new.stock <> 0)
    or (tg_op = 'UPDATE' and new.stock is distinct from old.stock)
  ) then
    raise exception 'products.stock solo cambia con stock_movements';
  end if;
  return new;
end $$;

create function public.guard_vendor_stock_qty() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_trigger_depth() <= 1 and (
    (tg_op = 'INSERT' and new.qty <> 0)
    or (tg_op = 'UPDATE' and new.qty is distinct from old.qty)
  ) then
    raise exception 'vendor_stock.qty solo cambia con stock_movements';
  end if;
  return new;
end $$;

create trigger products_guard_stock
  before insert or update on public.products
  for each row execute function public.guard_products_stock();

create trigger vendor_stock_guard_qty
  before insert or update on public.vendor_stock
  for each row execute function public.guard_vendor_stock_qty();
