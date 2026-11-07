// Contratos de la pantalla «Fraccionar» (HU-23); espejo de lo que manda el backend.
export interface FractionOption {
  productId: number;
  name: string;
  image: string | null;
  warehouseUnits: number;
  unitCost: string;
  portionSize: string;
  portionProduct: { id: number; name: string; price: string; active: boolean } | null;
}

export interface Fraction {
  id: number;
  requestId: string;
  portions: number;
  wholeUnitCost: string;
  portionUnitCost: string;
  createdAt: string;
  product: { id: number; name: string; stock: number };
  portionProduct: { id: number; name: string; created: boolean; price: string; stock: number };
}

export interface CreateFractionPayload {
  requestId: string;
  productId: number;
  portions: number;
  price: string;
}

export type FractionFailureReason =
  | 'no-units'
  | 'price-below-cost'
  | 'portions-invalid'
  | 'conflict'
  | 'offline';

export type FractionResult =
  | { ok: true; fraction: Fraction; replayed: boolean }
  | { ok: false; reason: FractionFailureReason; message: string | null };

// Vista previa «Baja 1 entero (N → N−1) · Suben B bolsitas».
export interface FractionPreview {
  wholeBefore: number;
  wholeAfter: number;
  portions: number;
}

// Bodega antes → después del resultado; el «antes» es null con `replayed: true`.
export interface FractionBeforeAfter {
  wholeBefore: number | null;
  wholeAfter: number;
  portionBefore: number | null;
  portionAfter: number;
}
