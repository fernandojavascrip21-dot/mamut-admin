// Forma de GET /api/cuts (T-20), compartida con «Mi corte» del vendedor (HU-20).
// Los campos de costo y ganancia se mantienen opcionales; desde HU-20 el vendedor también los recibe.
export type CutPeriodKind = 'day' | 'week' | 'month';

// Quién lee el corte: cambia solo los textos de los componentes compartidos (HU-19 / HU-20).
export type CutPerspective = 'admin' | 'seller';

// Petición del corte. `holderId` null = bodega (no se manda al backend); `date` es 'YYYY-MM-DD'.
export interface CashCutQuery {
  holderId: string | null;
  period: CutPeriodKind;
  date: string;
}

export interface CashCut {
  holder: { id: string; fullName: string } | null;
  period: { kind: CutPeriodKind; from: string; to: string; timeZone: string };
  totals: { salesCount: number; units: number; total: string; cost?: string; profit?: string };
  products: CutProductLine[];
  sales: CutSale[];
}

export interface CutProductLine {
  productId: number;
  name: string;
  image: string | null;
  unitPrice: string;
  units: number;
  total: string;
  cost?: string;
  profit?: string;
}

export interface CutSaleLine {
  productId: number;
  name: string;
  qty: number;
  unitPrice: string;
  subtotal: string;
  unitCost?: string;
  profit?: string;
}

export interface CutSale {
  requestId: string;
  soldAt: string;
  registeredByAdmin: boolean;
  soldBy: { id: string; fullName: string };
  total: string;
  profit?: string;
  lines: CutSaleLine[];
}
