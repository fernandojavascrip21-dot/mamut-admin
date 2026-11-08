-- T-25: el motivo de una merma es uno de cuatro códigos (lost, damaged, expired, other).
--
-- Solo valida si viene: los movimientos `shrinkage` sin motivo (anteriores o de pruebas) siguen
-- siendo válidos. Que el motivo sea obligatorio lo garantiza el caso de uso `createShrinkage`,
-- que es el único que registra mermas reales.

alter table public.stock_movements
  add constraint stock_movements_shrinkage_reason_check
  check (
    type <> 'shrinkage'
    or reason is null
    or reason in ('lost', 'damaged', 'expired', 'other')
  );
