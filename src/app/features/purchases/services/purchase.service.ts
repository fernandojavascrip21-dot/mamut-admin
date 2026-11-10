import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, catchError, map, of } from 'rxjs';
import { httpErrorMessage, httpStatus, isOffline } from '@shared/utils/http-errors';
import { PRODUCTS_URL, PURCHASES_URL } from '../constants/purchase.constants';
import type { CreatePurchasePayload, Purchase, PurchaseProduct, PurchaseResult } from '../interfaces/purchase.models';

// Cliente de /api/purchases (HU-27). El Bearer token lo agrega authInterceptor.
@Injectable({
  providedIn: 'root',
})
export class PurchaseService {
  private readonly http = inject(HttpClient);

  // Productos activos (enteros y bolsitas) con las piezas actuales de la bodega.
  getProducts(): Observable<PurchaseProduct[]> {
    return this.http.get<PurchaseProduct[]>(PRODUCTS_URL);
  }

  // Registra la entrada. El backend responde { purchase, replayed }: 201 es nueva y 200 una repetición
  // del mismo requestId. Los errores no se lanzan: se devuelven como motivo para que la página decida.
  create(payload: CreatePurchasePayload): Observable<PurchaseResult> {
    return this.http.post<{ purchase: Purchase; replayed: boolean }>(PURCHASES_URL, payload).pipe(
      map((body) => ({ ok: true as const, purchase: body.purchase, replayed: body.replayed })),
      catchError((error: unknown) => of(toFailure(error))),
    );
  }
}

// Sin status (red) o 5xx no hay un error de negocio que mostrar: se trata como «sin conexión» y la
// página conserva el requestId para que reintentar no registre dos entradas.
function toFailure(error: unknown): PurchaseResult {
  const status = httpStatus(error);
  if (isOffline(error) || status === null || status >= 500) {
    return { ok: false, reason: 'offline', message: null };
  }
  return { ok: false, reason: status === 404 ? 'not-found' : 'conflict', message: httpErrorMessage(error) };
}
