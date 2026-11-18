// Estado del detalle de un vendedor: `not-found` cubre un 404 (no existe, no es vendedor o está
// desactivado) y `error` cualquier otra falla de carga, que se puede reintentar.
export type SellerDetailState = 'loading' | 'error' | 'not-found' | 'ready';

// Estado de «Últimas entregas»: se carga aparte del detalle y su error no lo esconde.
export type DeliveryHistoryState = 'loading' | 'error' | 'ready';

// Estado de «Últimos retiros» (HU-12): igual que el de las entregas, se carga aparte.
export type ReturnHistoryState = 'loading' | 'error' | 'ready';

// Estado de «Últimas mermas» (HU-26): igual que el de los retiros, se carga aparte.
export type ShrinkageHistoryState = 'loading' | 'error' | 'ready';

// Lista que pinta el grid del detalle: su stock (HU-09/HU-11), sus entregas (HU-11), sus retiros
// (HU-12) o sus mermas (HU-26).
export type SellerDetailView = 'stock' | 'deliveries' | 'returns' | 'shrinkages';
