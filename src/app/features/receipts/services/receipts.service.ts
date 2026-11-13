import { Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  ConfirmReceiptPayload, ConfirmReceiptResponse, CreateProductFromLinePayload, CreateProductFromLineResult,
  AcceptLineCostResult, PendingReceiptLines, Receipt, ReceiptCatalogItem, ReceiptCategory, ReceiptLineResult, ReceiptPreview,
} from '../interfaces/receipt.models';

// Cliente de /api/receipts (HU-42). Pendiente de implementar.
@Injectable({ providedIn: 'root' })
export class ReceiptsService {
  preview(file: File): Observable<ReceiptPreview> {
    throw new Error(`No implementado ${file.name}`);
  }
  getProducts(): Observable<ReceiptCatalogItem[]> {
    throw new Error('No implementado');
  }
  confirm(payload: ConfirmReceiptPayload): Observable<ConfirmReceiptResponse> {
    throw new Error(`No implementado ${payload.requestId}`);
  }
  get(requestId: string): Observable<Receipt> {
    throw new Error(`No implementado ${requestId}`);
  }
  getPending(): Observable<PendingReceiptLines> {
    throw new Error('No implementado');
  }
  createProduct(lineId: number, payload: CreateProductFromLinePayload): Observable<CreateProductFromLineResult> {
    throw new Error(`No implementado ${lineId} ${payload.name}`);
  }
  discard(lineId: number): Observable<ReceiptLineResult> {
    throw new Error(`No implementado ${lineId}`);
  }
  acceptCost(lineId: number): Observable<AcceptLineCostResult> {
    throw new Error(`No implementado ${lineId}`);
  }
  rejectCost(lineId: number): Observable<ReceiptLineResult> {
    throw new Error(`No implementado ${lineId}`);
  }
  getCategories(): Observable<ReceiptCategory[]> {
    throw new Error('No implementado');
  }
}
