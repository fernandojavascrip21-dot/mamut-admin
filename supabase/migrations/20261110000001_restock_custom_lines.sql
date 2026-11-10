-- HU-31: renglones escritos a mano en un pedido de resurtir. Son texto del pedido: no crean
-- productos ni tocan inventario. unit_cost de un renglón de catálogo es el costo del pedido y puede
-- editarse sin cambiar products.unit_cost.

alter table public.restock_order_lines
  alter column product_id drop not null,
  alter column unit_cost drop not null,
  add column custom_name text,
  add constraint restock_order_lines_custom_name_check
    check (custom_name is null or char_length(custom_name) between 1 and 120),
  add constraint restock_order_lines_kind_check
    check (
      (product_id is not null and custom_name is null and unit_cost is not null)
      or (product_id is null and custom_name is not null)
    );

create unique index restock_order_lines_custom_key
  on public.restock_order_lines (order_id, lower(custom_name))
  where custom_name is not null;
