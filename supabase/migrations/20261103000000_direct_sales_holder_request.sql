-- T-18: base de ventas. Adapta las tablas heredadas direct_sales / direct_sale_items y liga cada
-- movimiento de venta con su venta.

-- Guardia: la v1 empieza a usar direct_sales. Si ya trae filas del proyecto anterior,
-- holder_profile_id null las haría pasar por ventas de bodega: se detiene la migración.
do $$ begin
  if exists (select 1 from public.direct_sales) then
    raise exception 'direct_sales tiene filas heredadas: revisar antes de migrar (spec M3-t18 §8)';
  end if;
end $$;

alter table public.direct_sales
  add column holder_profile_id uuid references public.profiles(id) on delete restrict, -- null = bodega
  add column request_id uuid;

create unique index direct_sales_request_id_key
  on public.direct_sales (request_id) where request_id is not null;
create index direct_sales_holder_sold_at_idx
  on public.direct_sales (holder_profile_id, sold_at desc);

alter table public.direct_sale_items
  add constraint direct_sale_items_sale_product_key unique (direct_sale_id, product_id);

alter table public.stock_movements
  add column direct_sale_id bigint references public.direct_sales(id) on delete restrict,
  add constraint stock_movements_direct_sale_type_check
    check (direct_sale_id is null or type in ('direct_sale', 'direct_sale_void'));

create unique index stock_movements_direct_sale_product_key
  on public.stock_movements (direct_sale_id, product_id)
  where type = 'direct_sale';
