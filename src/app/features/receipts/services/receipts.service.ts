import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { CATEGORIES_URL, RECEIPTS_URL } from '../constants/receipts.constants';
import type {
  AcceptLineCostResult, ConfirmReceiptPayload, ConfirmReceiptResponse, CreateProductFromLinePayload,
  CreateProductFromLineResult, PendingReceiptLines, Receipt, ReceiptCatalogItem, ReceiptCategory,
  ReceiptLineResult, ReceiptPreview,
} from '../interfaces/receipt.models';

// Cliente de /api/receipts (HU-42). El Bearer token lo agrega authInterceptor. Los errores no se
// capturan aquí: la página decide qué mostrar según el status.
@Injectable({ providedIn: 'root' })
export class ReceiptsService {
  private readonly http = inject(HttpClient);

  // Lee el archivo sin guardar nada: el campo «file» es el que espera el backend.
  preview(file: File): Observable<ReceiptPreview> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<ReceiptPreview>(`${RECEIPTS_URL}/preview`, body);
  }

  // Catálogo para corregir renglones (solo activos); el backend lo envuelve en { products }.
  getProducts(): Observable<ReceiptCatalogItem[]> {
    return this.http.get<{ products: ReceiptCatalogItem[] }>(`${RECEIPTS_URL}/products`).pipe(
      map((body) => body.products),
    );
  }

  // Registra la entrada. 201 es nueva y 200 una repetición del mismo requestId.
  confirm(payload: ConfirmReceiptPayload): Observable<ConfirmReceiptResponse> {
    return this.http.post<ConfirmReceiptResponse>(RECEIPTS_URL, payload);
  }

  // Una remisión ya registrada; el backend la envuelve en { receipt }.
  get(requestId: string): Observable<Receipt> {
    return this.http.get<{ receipt: Receipt }>(`${RECEIPTS_URL}/${requestId}`).pipe(
      map((body) => body.receipt),
    );
  }

  getPending(): Observable<PendingReceiptLines> {
    return this.http.get<PendingReceiptLines>(`${RECEIPTS_URL}/pending`);
  }

  createProduct(lineId: number, payload: CreateProductFromLinePayload): Observable<CreateProductFromLineResult> {
    return this.http.post<CreateProductFromLineResult>(`${RECEIPTS_URL}/lines/${lineId}/product`, payload);
  }

  discard(lineId: number): Observable<ReceiptLineResult> {
    return this.http.post<ReceiptLineResult>(`${RECEIPTS_URL}/lines/${lineId}/discard`, {});
  }

  acceptCost(lineId: number): Observable<AcceptLineCostResult> {
    return this.http.post<AcceptLineCostResult>(`${RECEIPTS_URL}/lines/${lineId}/cost/accept`, {});
  }

  rejectCost(lineId: number): Observable<ReceiptLineResult> {
    return this.http.post<ReceiptLineResult>(`${RECEIPTS_URL}/lines/${lineId}/cost/reject`, {});
  }

  getCategories(): Observable<ReceiptCategory[]> {
    return this.http.get<ReceiptCategory[]>(CATEGORIES_URL);
  }
}
