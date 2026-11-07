-- T-24: base del fraccionado. Registra cada vez que se abre 1 entero de la bodega y salen N bolsitas,
-- y liga sus dos movimientos (fraction_out / fraction_in) con ese registro.
--
-- Tabla propia con request_id único (patrón de direct_sales, T-18): el índice
-- stock_movements_request_holder_key de HU-11 es por (request_id, titular) y los dos movimientos
-- del fraccionado son de la bodega, así que no sirve para la idempotencia.

create table public.fractions (
  id bigint generated always as identity primary key,
  request_id uuid not null,
  product_id bigint not null references public.products (id) on delete restrict,         -- el entero
  portion_product_id bigint not null references public.products (id) on delete restrict, -- la bolsita
  portions integer not null check (portions between 2 and 1000),
  whole_unit_cost numeric(10,4) not null,                          -- costo del entero en ese momento
  portion_unit_cost numeric(10,4) not null check (portion_unit_cost > 0),
  portion_price numeric(10,2) not null check (portion_price > 0),  -- precio de la bolsita tras el fraccionado
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  constraint fractions_request_id_key unique (request_id),
  constraint fractions_distinct_products check (product_id <> portion_product_id)
);

create index fractions_product_created_at_idx on public.fractions (product_id, created_at desc);

alter table public.stock_movements
  add column fraction_id bigint references public.fractions (id) on delete restrict,
  add constraint stock_movements_fraction_type_check
    check (fraction_id is null or type in ('fraction_out', 'fraction_in'));
