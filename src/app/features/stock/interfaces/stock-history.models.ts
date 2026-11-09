// Una merma del historial (HU-26): GET /api/shrinkages. `qty` va en positivo.
export interface ShrinkageHistoryItem {
  requestId: string | null;
  createdAt: string;
  qty: number;
  reason: string | null;
  reasonLabel: string | null;
  holder: { id: string; fullName: string } | null; // null = bodega
  product: { id: number; name: string; image: string | null };
}

// Fila de GET /api/fractions (HU-24): un fraccionado del historial; espejo del backend.
export interface FractionHistoryItem {
  id: number;
  requestId: string;
  createdAt: string;
  portions: number;
  wholeUnitCost: string;
  portionUnitCost: string;
  portionPrice: string;
  product: { id: number; name: string };
  portionProduct: { id: number; name: string };
  createdBy: { id: string; name: string };
}

// Vista elegida en «Stock general».
export type StockView = 'products' | 'shrinkages' | 'fractions';
