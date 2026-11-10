-- T-36: pedidos de resurtir. Una lista de lo que se piensa pedir al proveedor; no mueve inventario
-- (la mercancía que llega se registra con «Entrada a bodega», HU-27). RLS la activa el event trigger
-- rls_auto_enable del baseline; el backend entra con la conexión directa.

create table public.restock_orders (
  id bigint generated always as identity primary key,
  request_id uuid not null,
  status text not null default 'draft',
  note text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint restock_orders_request_id_key unique (request_id),
  constraint restock_orders_status_check check (status in ('draft', 'closed')),
  constraint restock_orders_closed_at_check check ((status = 'closed') = (closed_at is not null)),
  constraint restock_orders_note_check check (note is null or char_length(note) between 1 and 500)
);

create index restock_orders_created_at_idx on public.restock_orders (created_at desc);

create table public.restock_order_lines (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.restock_orders (id) on delete cascade,
  product_id bigint not null references public.products (id) on delete restrict,
  qty integer not null check (qty > 0),
  unit_cost numeric(10,4) not null check (unit_cost >= 0),   -- costo de fábrica al agregar el renglón
  constraint restock_order_lines_product_key unique (order_id, product_id)
);
