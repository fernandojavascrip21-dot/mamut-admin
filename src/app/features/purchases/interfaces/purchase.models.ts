// Contratos de la pantalla «Entrada a bodega» (HU-27); espejo de lo que manda el backend.

// Un producto activo de GET /api/products (enteros y bolsitas). `stock` son las piezas de la bodega.
export interface PurchaseProduct {
  id: number;
  name: string;
  image: string | null;
  stock: number;
  parentProductId: number | null; // distinto de null = bolsita
}

// Respuesta de POST /api/purchases: `stock` es el de la bodega antes → después.
export interface Purchase {
  requestId: string;
  createdAt: string;
  qty: number;
  product: { id: number; name: string; image: string | null };
  stock: { before: number; after: number };
}

export interface CreatePurchasePayload {
  requestId: string;
  productId: number;
  qty: number;
}

export type PurchaseFailureReason = 'conflict' | 'not-found' | 'offline';

export type PurchaseResult =
  | { ok: true; purchase: Purchase; replayed: boolean }
  | { ok: false; reason: PurchaseFailureReason; message: string | null };
