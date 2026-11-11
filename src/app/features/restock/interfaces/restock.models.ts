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

// Fallo ya traducido: `message` es el del backend, o null si no hubo respuesta (sin conexión o 5xx).
export interface RestockFailure {
  ok: false;
  reason: RestockFailureReason;
  message: string | null;
}

export type RestockResult = { ok: true; order: RestockOrder } | RestockFailure;

// Descartar no devuelve pedido, y un 404 cuenta como descartado.
export type RestockDiscardResult = { ok: true } | RestockFailure;

// Cuerpos de respuesta de /api/restock (T-36 y HU-31).
export interface RestockSuggestionsResponse {
  suggestions: RestockSuggestion[];
}

export interface RestockProductsResponse {
  products: RestockProduct[];
}

export interface RestockOrdersResponse {
  orders: RestockOrderSummary[];
}

export interface RestockOrderResponse {
  order: RestockOrder;
}

// Detalle de un pedido: un 404 no es error de pantalla, es «ya no existe».
export type RestockOrderLookup = { found: true; order: RestockOrder } | { found: false };
export type RestockExportFormat = 'pdf' | 'xlsx';

// Renglones listos para el formulario a partir de un pedido viejo y de los productos pedibles hoy.
export interface RestockBaseLines {
  lines: Array<
    | { kind: 'catalog'; productId: number; qty: number; unitCost: string }
    | { kind: 'custom'; name: string; qty: number; unitCost: string | null }
  >;
  skipped: number;
  baseClosedAt: string;
}
