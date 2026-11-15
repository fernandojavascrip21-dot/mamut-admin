-- Renglones por completar: una remisión con piezas vacías o en 0 se guarda con su nombre y costo leídos
-- y sin piezas (qty null), en estado `incomplete`. No tiene producto ni movimiento de inventario; al dar
-- de alta el producto el administrador captura las piezas y el renglón pasa a `created`.

alter table public.supplier_receipt_lines
  drop constraint supplier_receipt_lines_status_check;

alter table public.supplier_receipt_lines
  add constraint supplier_receipt_lines_status_check
    check (status in ('received', 'pending', 'created', 'discarded', 'incomplete'));

-- Sin piezas: solo un renglón por completar, o uno por completar que se descartó (no tiene piezas que
-- capturar). Un renglón por completar siempre va sin piezas.
alter table public.supplier_receipt_lines
  alter column qty drop not null,
  drop constraint supplier_receipt_lines_qty_check,
  add constraint supplier_receipt_lines_qty_check check (qty is null or qty > 0),
  add constraint supplier_receipt_lines_incomplete_check check (status <> 'incomplete' or qty is null),
  add constraint supplier_receipt_lines_no_qty_check check (qty is not null or status in ('incomplete', 'discarded'));

-- El índice de pendientes también cubre los renglones por completar, para que la lista los encuentre.
drop index public.supplier_receipt_lines_pending_idx;

create index supplier_receipt_lines_pending_idx on public.supplier_receipt_lines (receipt_id)
  where status in ('pending', 'incomplete') or cost_status = 'pending';
