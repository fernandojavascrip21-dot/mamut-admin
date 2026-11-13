import type { ConfirmReceiptPayload, PreviewLine, ReceiptCatalogItem, ReceiptPreview, ReceiptSource } from '../interfaces/receipt.models';
import type { ReceiptLineFormValue } from '../components/receipt-preview-form/receipt-preview-form.models';

// Pendiente de implementar (HU-42): funciones puras que anticipan lo que decidirá el backend.
export function stockBefore(productId: number, preview: ReceiptPreview, catalog: ReceiptCatalogItem[]): number {
  throw new Error(`No implementado ${productId} ${preview.source} ${catalog.length}`);
}

export function stockAfter(
  productId: number,
  preview: ReceiptPreview,
  catalog: ReceiptCatalogItem[],
  lines: ReceiptLineFormValue[],
): number {
  throw new Error(`No implementado ${productId} ${preview.source} ${catalog.length} ${lines.length}`);
}

export function costChanged(line: ReceiptLineFormValue, product: ReceiptCatalogItem | null): boolean {
  throw new Error(`No implementado ${line.unitCost} ${product?.id}`);
}

export function buildConfirmPayload(params: {
  requestId: string;
  source: ReceiptSource;
  fileName: string | null;
  proposed: PreviewLine[];
  values: ReceiptLineFormValue[];
}): ConfirmReceiptPayload {
  throw new Error(`No implementado ${params.requestId}`);
}
