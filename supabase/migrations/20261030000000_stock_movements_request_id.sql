-- HU-11: llave de idempotencia de las entregas a vendedores.
--
-- Una entrega escribe dos movimientos `delivery` con el mismo request_id: bodega (holder null) y
-- vendedor. Si la respuesta se pierde y el administrador reintenta, el backend reconoce el
-- request_id y no mueve nada otra vez. La columna es nula: los movimientos anteriores no cambian.

alter table public.stock_movements add column request_id uuid;

-- `nulls not distinct` (PostgreSQL 15+) hace que la fila de la bodega, con holder null,
-- también cuente para la unicidad.
create unique index stock_movements_request_holder_key
  on public.stock_movements (request_id, holder_profile_id) nulls not distinct
  where request_id is not null;
