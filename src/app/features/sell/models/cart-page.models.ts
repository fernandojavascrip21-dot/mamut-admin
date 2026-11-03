import type { SellProduct } from '../interfaces/sell-stock.models';

// Cómo está un renglón del carrito frente al stock de ahora: 'ok' si alcanza, 'over' si pide más
// piezas de las que le quedan y 'soldOut' si ya no le queda ninguna (o el producto ya no viene).
export type CartRowStatus = 'ok' | 'over' | 'soldOut';

// Un renglón del carrito ya resuelto: `units` son las piezas del carrito, `available` las que le
// quedan hoy, y `subtotal` es piezas × precio como texto con 2 decimales.
export interface CartRow {
  product: SellProduct;
  units: number;
  available: number;
  subtotal: string;
  status: CartRowStatus;
}
