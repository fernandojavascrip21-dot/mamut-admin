// Una línea de la venta tal como la devuelve POST/GET /api/sales (T-18). Al vendedor el backend no le
// manda costo ni ganancia, y estos modelos tampoco tienen esas llaves (RNF-04). Los montos son texto
// con 2 decimales (T-08).
export interface SaleLine {
  productId: number;
  name: string;
  image: string | null;
  qty: number;
  unitPrice: string;
  subtotal: string;
  stock: { before: number; after: number };
}

export interface Sale {
  id: number;
  requestId: string;
  soldAt: string;
  soldById: string;
  holder: { id: string; fullName: string } | null;
  lines: SaleLine[];
  total: string;
}

// Petición de POST /api/sales. El vendedor nunca manda `holderId` ni precios: el backend vende de su
// propio stock con el precio del momento.
export interface CreateSaleRequest {
  requestId: string;
  lines: { productId: number; qty: number }[];
}

// `replayed` es true cuando la llave ya existía y el backend respondió la venta hecha (200).
export interface SaleResponse {
  sale: Sale;
  replayed: boolean;
}

// Resultado de confirmar una venta, ya traducido de HTTP para que la página no lea errores.
export type SaleResult =
  | { ok: true; sale: Sale; replayed: boolean }
  | { ok: false; reason: 'not-enough-units' | 'already-registered' | 'offline' }
  | { ok: false; reason: 'invalid'; message: string };
