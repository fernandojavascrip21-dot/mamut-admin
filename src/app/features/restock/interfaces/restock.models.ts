export type RestockOrderStatus = 'draft' | 'closed';
export type RestockStockLevel = 'ok' | 'low' | 'out';

export interface RestockSuggestion {
  productId: number;
  name: string;
  image: string | null;
  units: number;
  stockLevel: 'low' | 'out';
  unitCost: string;
}

export interface RestockProduct {
  productId: number;
  name: string;
  image: string | null;
  units: number;
  stockLevel: RestockStockLevel;
  unitCost: string;
}

export interface RestockOrderSummary {
  id: number;
  status: RestockOrderStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  lineCount: number;
  totalUnits: number;
  estimatedTotal: string;
}

export interface RestockOrderLine {
  product: { id: number; name: string; image: string | null };
  qty: number;
  unitCost: string;
}

export interface RestockCustomLine {
  id: number;
  name: string;
  qty: number;
  unitCost: string | null;
}

export interface RestockOrder extends RestockOrderSummary {
  requestId: string;
  lines: RestockOrderLine[];
  customLines: RestockCustomLine[];
}

export interface RestockCatalogLinePayload {
  productId: number;
  qty: number;
  unitCost: string;
}

export interface RestockCustomLinePayload {
  name: string;
  qty: number;
  unitCost: string | null;
}

export type RestockLinePayload = RestockCatalogLinePayload | RestockCustomLinePayload;

export interface CreateRestockOrderPayload {
  requestId: string;
  note: string | null;
  lines: RestockLinePayload[];
}

export interface UpdateRestockOrderPayload {
  note: string | null;
  lines: RestockLinePayload[];
}

export type RestockFailureReason = 'invalid' | 'closed' | 'conflict' | 'not-found' | 'offline';

export type RestockResult =
  | { ok: true; order: RestockOrder }
  | { ok: false; reason: RestockFailureReason; message: string | null };

// Resultado de descartar un borrador: no hay pedido que devolver, y un 404 cuenta como descartado.
export type RestockDiscardResult =
  | { ok: true }
  | { ok: false; reason: RestockFailureReason; message: string | null };
