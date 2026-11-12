-- T-41: remisiones del proveedor. Confirmar una remisión registra una entrada `purchase` por renglón
-- con producto; los renglones sin producto y los cambios de costo quedan pendientes. La
-- idempotencia es por supplier_receipts.request_id: el índice stock_movements_request_holder_key
-- es por (request_id, titular) y todos los renglones son de la bodega. RLS la activa el event
-- trigger rls_auto_enable del baseline; el backend entra con la conexión directa.

create table public.supplier_receipts (
  id bigint generated always as identity primary key,
  request_id uuid not null,
  source text not null,
  file_name text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  constraint supplier_receipts_request_id_key unique (request_id),
  constraint supplier_receipts_source_check check (source in ('excel', 'pdf', 'image')),
  constraint supplier_receipts_file_name_check check (file_name is null or char_length(file_name) between 1 and 255)
);

create index supplier_receipts_created_at_idx on public.supplier_receipts (created_at desc);

create table public.supplier_receipt_lines (
  id bigint generated always as identity primary key,
  receipt_id bigint not null references public.supplier_receipts (id) on delete restrict,
  position integer not null check (position > 0),
  read_name text not null check (char_length(read_name) between 1 and 200),
  qty integer not null check (qty > 0),
  unit_cost numeric(10,4) check (unit_cost is null or unit_cost >= 0),   -- costo leído de la remisión
  product_id bigint references public.products (id) on delete restrict,
  status text not null,
  cost_status text,
  previous_unit_cost numeric(10,4),   -- products.unit_cost al confirmar, solo con cost_status
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id),
  constraint supplier_receipt_lines_position_key unique (receipt_id, position),
  constraint supplier_receipt_lines_status_check
    check (status in ('received', 'pending', 'created', 'discarded')),
  constraint supplier_receipt_lines_product_check
    check ((status in ('received', 'created')) = (product_id is not null)),
  constraint supplier_receipt_lines_cost_status_check
    check (cost_status is null or (cost_status in ('pending', 'accepted', 'rejected')
      and status = 'received' and unit_cost is not null and previous_unit_cost is not null))
);

create index supplier_receipt_lines_pending_idx on public.supplier_receipt_lines (receipt_id)
  where status = 'pending' or cost_status = 'pending';

create table public.supplier_product_aliases (
  id bigint generated always as identity primary key,
  normalized_name text not null check (char_length(normalized_name) between 1 and 200),
  product_id bigint not null references public.products (id) on delete restrict,
  updated_by uuid not null references auth.users (id),
  updated_at timestamptz not null default now(),
  constraint supplier_product_aliases_name_key unique (normalized_name)
);

alter table public.stock_movements
  add column receipt_line_id bigint references public.supplier_receipt_lines (id) on delete restrict,
  add constraint stock_movements_receipt_line_type_check
    check (receipt_line_id is null or type = 'purchase');

-- Una sola entrada por renglón: protege el alta de un pendiente contra un doble clic.
create unique index stock_movements_receipt_line_key on public.stock_movements (receipt_line_id)
  where receipt_line_id is not null;
