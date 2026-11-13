export type ReceiptSource = 'excel' | 'pdf' | 'image';
export type MatchKind = 'alias' | 'name' | 'none';
export type SkipReason = 'missing_name' | 'invalid_qty' | 'invalid_cost' | 'inactive_product';
export type ReceiptLineStatus = 'received' | 'pending' | 'created' | 'discarded';
export type CostStatus = 'pending' | 'accepted' | 'rejected';

export interface ReceiptProductRef {
  id: number;
  name: string;
  image: string | null;
}

export interface PreviewLine {
  position: number;
  readName: string;
  suggestedName: string;
  qty: number;
  unitCost: string | null;
  match: MatchKind;
  product: (ReceiptProductRef & { unitCost: string }) | null;
  costChanged: boolean;
}

export interface SkippedLine {
  position: number;
  text: string;
  reason: SkipReason;
  label: string;
}

export interface ReceiptPreview {
  source: ReceiptSource;
  lines: PreviewLine[];
  skipped: SkippedLine[];
  stock: { productId: number; before: number; after: number }[];
}

export interface ConfirmReceiptLinePayload {
  readName: string;
  qty: number;
  unitCost: string | null;
  productId: number | null;
}

export interface ConfirmReceiptPayload {
  requestId: string;
  source: ReceiptSource;
  fileName: string | null;
  lines: ConfirmReceiptLinePayload[];
}

export interface ReceiptLine {
  id: number;
  position: number;
  readName: string;
  qty: number;
  unitCost: string | null;
  status: ReceiptLineStatus;
  costStatus: CostStatus | null;
  product: ReceiptProductRef | null;
}

export interface Receipt {
  requestId: string;
  source: ReceiptSource;
  fileName: string | null;
  createdAt: string;
  lines: ReceiptLine[];
  units: { productId: number; units: number }[];
}

export interface ConfirmReceiptResponse {
  receipt: Receipt;
  replayed: boolean;
}

export interface PendingNewProduct {
  lineId: number;
  receipt: { requestId: string; createdAt: string };
  suggestedName: string;
  qty: number;
  unitCost: string | null;
}

export interface PendingCostChange {
  lineId: number;
  receipt: { requestId: string; createdAt: string };
  product: { id: number; name: string; image: string | null; active: boolean };
  qty: number;
  currentUnitCost: string;
  previousUnitCost: string;
  newUnitCost: string;
}

export interface PendingReceiptLines {
  newProducts: PendingNewProduct[];
  costChanges: PendingCostChange[];
}

export interface ReceiptCatalogItem {
  id: number;
  name: string;
  image: string | null;
  unitCost: string;
  units: number;
}

export interface CreateProductFromLinePayload {
  name: string;
  price: string;
  categoryId: number | null;
  unitCost?: string;
}

export interface CreateProductFromLineResult {
  product: { id: number; name: string };
  line: ReceiptLine;
  stock: { before: number; after: number };
}

export interface ReceiptCategory {
  id: number;
  name: string;
}

export interface ReceiptLineResult {
  line: ReceiptLine;
}

export interface AcceptLineCostResult {
  line: ReceiptLine;
  product: { id: number; unitCost: string };
}
