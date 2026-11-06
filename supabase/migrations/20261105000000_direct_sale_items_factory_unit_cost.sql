-- T-22: base del corte para casa. Cada renglón de venta guarda también el costo de fábrica del
-- momento, junto al costo que ya guardaba (`unit_cost`: con envío del vendedor, o de fábrica).
-- Las ventas no se reescriben: solo se agrega la columna y se rellena una vez.

alter table public.direct_sale_items
  add column factory_unit_cost numeric(10,4); -- nullable solo mientras se rellena

-- Ventas de la bodega: su `unit_cost` ya era el costo de fábrica del momento (exacto).
update public.direct_sale_items dsi
set factory_unit_cost = dsi.unit_cost
from public.direct_sales ds
where ds.id = dsi.direct_sale_id
  and ds.holder_profile_id is null;

-- Ventas de un vendedor: no se sabe el costo de fábrica de entonces; se usa el actual del
-- producto (aproximado, spec M4b-t22 §3). Las ventas nuevas guardan el del momento.
update public.direct_sale_items dsi
set factory_unit_cost = p.unit_cost
from public.direct_sales ds, public.products p
where ds.id = dsi.direct_sale_id
  and ds.holder_profile_id is not null
  and p.id = dsi.product_id;

-- Sin valor por omisión: un insert que no lo mande falla, así ningún renglón nuevo queda sin él.
alter table public.direct_sale_items
  alter column factory_unit_cost set not null,
  add constraint direct_sale_items_factory_unit_cost_check check (factory_unit_cost >= (0)::numeric);
