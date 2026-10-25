-- T-03 · Tablas de productos y movimientos de stock (Mammut)
-- Ver specs/M1-t03-tablas-productos-stock/spec.md

-- 1. products: columnas para fraccionado ------------------------------------

alter table public.products
  add column fractionable boolean not null default false,
  add column portion_size text,
  add column parent_product_id bigint;

alter table public.products
  add constraint products_parent_product_id_fkey
    foreign key (parent_product_id) references public.products (id)
    on delete restrict;

alter table public.products
  add constraint products_parent_product_id_key
    unique (parent_product_id);

alter table public.products
  add constraint products_parent_not_self
    check (parent_product_id is null or parent_product_id <> id);

-- 2. vendor_stock: stock de cada vendedor por producto -----------------------

create table public.vendor_stock (
  id bigint generated always as identity primary key,
  profile_id uuid not null,
  product_id bigint not null,
  qty integer not null default 0,
  unit_price numeric(10, 2),
  unit_cost_with_shipping numeric(10, 4),
  updated_at timestamptz not null default now(),
  constraint vendor_stock_profile_id_fkey
    foreign key (profile_id) references public.profiles (id)
    on delete restrict,
  constraint vendor_stock_product_id_fkey
    foreign key (product_id) references public.products (id)
    on delete restrict,
  constraint vendor_stock_profile_product_key
    unique (profile_id, product_id),
  constraint vendor_stock_qty_check
    check (qty >= 0)
);

-- 3. stock_movements: de quién es el movimiento ------------------------------

alter table public.stock_movements
  add column holder_profile_id uuid;

alter table public.stock_movements
  add constraint stock_movements_holder_profile_id_fkey
    foreign key (holder_profile_id) references public.profiles (id)
    on delete restrict;

alter table public.stock_movements
  drop constraint stock_movements_type_check;

alter table public.stock_movements
  add constraint stock_movements_type_check
    check (type = any (array[
      'initial', 'purchase', 'adjustment', 'delivery', 'return',
      'direct_sale', 'direct_sale_void', 'shrinkage', 'shrinkage_void',
      'fraction_out', 'fraction_in'
    ]::text[]));

-- 4. Bucket de Storage para fotos de producto --------------------------------

insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do nothing;
