import type { StockLevel } from '@shared/constants/stock-level.constants';

// Un producto del stock propio del vendedor (GET /api/me/stock, HU-14). `price` ya viene resuelto
// por el backend (el precio propio o, si no tiene, el general) y es texto con 2 decimales (T-08).
// La respuesta no trae costos ni ganancia (RF-02, RNF-04).
export interface MyStockProduct {
  productId: number;
  name: string;
  image: string | null;
  units: number;
  price: string;
  // Existencia propia (HU-18): la decide el backend. Un 0 por retiro llega como 'ok'.
  stockLevel: StockLevel;
}

// Aviso de baja existencia del propio vendedor (HU-18): pocas piezas o se le acabó vendiendo. Un
// producto agotado puede no estar en `products`, porque «Mi stock» lista lo que tiene en mano.
export interface MyStockAlert {
  productId: number;
  name: string;
  units: number;
  stockLevel: 'low' | 'out';
}

// Lo que el vendedor tiene en mano: solo productos con piezas, por nombre. `total` es la suma de `units`.
export interface MyStock {
  total: number;
  products: MyStockProduct[];
  alerts: MyStockAlert[];
}
