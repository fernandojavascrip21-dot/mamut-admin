import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, forkJoin, map, of, switchMap, throwError, type Observable } from 'rxjs';
import { httpErrorMessage, httpStatus, isOffline } from '@shared/utils/http-errors';
import {
  CLOSED_ORDER_MESSAGE,
  RESTOCK_CLOSED_URL,
  RESTOCK_DRAFTS_URL,
  RESTOCK_ORDERS_URL,
  RESTOCK_PRODUCTS_URL,
  RESTOCK_SUGGESTIONS_URL,
} from '../constants/restock.constants';
import type {
  CreateRestockOrderPayload,
  RestockDiscardResult,
  RestockFailure,
  RestockOrderLookup,
  RestockOrderResponse,
  RestockOrderSummary,
  RestockOrdersResponse,
  RestockProductsResponse,
  RestockResult,
  RestockSuggestionsResponse,
  UpdateRestockOrderPayload,
} from '../interfaces/restock.models';
import type { RestockPageData } from '../models/restock-page.models';

// Cliente de /api/restock (T-36 y HU-31). Los errores no se lanzan: el servicio los traduce a un
// motivo y la página decide qué pintar. Es el único que traduce el status HTTP.
@Injectable({ providedIn: 'root' })
export class RestockService {
  private readonly http = inject(HttpClient);

  // Carga de la pantalla en paralelo. El borrador se pide en dos pasos: primero la lista de
  // borradores y después el detalle del primero (`orders[0]`, el más reciente según el backend).
  getPageData(): Observable<RestockPageData> {
    return forkJoin({
      draft: this.loadDraft(),
      suggestions: this.http
        .get<RestockSuggestionsResponse>(RESTOCK_SUGGESTIONS_URL)
        .pipe(map((response) => response.suggestions)),
      products: this.http
        .get<RestockProductsResponse>(RESTOCK_PRODUCTS_URL)
        .pipe(map((response) => response.products)),
    });
  }

  // Pedidos cerrados para la lista de pedidos anteriores. Los errores los recoge el rxResource.
  listClosed(): Observable<RestockOrderSummary[]> {
    return this.http
      .get<RestockOrdersResponse>(RESTOCK_CLOSED_URL)
      .pipe(map((response) => response.orders));
  }

  // Un 404 significa que el pedido ya no existe: se devuelve como dato para que la pantalla lo
  // muestre sin tratarlo como error. Los demás fallos siguen su curso hacia el rxResource.
  getOrder(id: number): Observable<RestockOrderLookup> {
    return this.http.get<RestockOrderResponse>(`${RESTOCK_ORDERS_URL}/${id}`).pipe(
      map((response): RestockOrderLookup => ({ found: true, order: response.order })),
      catchError((error: unknown) =>
        httpStatus(error) === 404 ? of<RestockOrderLookup>({ found: false }) : throwError(() => error),
      ),
    );
  }

  create(payload: CreateRestockOrderPayload): Observable<RestockResult> {
    return this.outcome(this.http.post<RestockOrderResponse>(RESTOCK_ORDERS_URL, payload));
  }

  update(id: number, payload: UpdateRestockOrderPayload): Observable<RestockResult> {
    return this.outcome(this.http.put<RestockOrderResponse>(`${RESTOCK_ORDERS_URL}/${id}`, payload));
  }

  close(id: number): Observable<RestockResult> {
    return this.outcome(this.http.post<RestockOrderResponse>(`${RESTOCK_ORDERS_URL}/${id}/close`, {}));
  }

  // Un 404 significa que el borrador ya no existe, así que para la pantalla también está descartado.
  discard(id: number): Observable<RestockDiscardResult> {
    return this.http.delete<void>(`${RESTOCK_ORDERS_URL}/${id}`).pipe(
      map((): RestockDiscardResult => ({ ok: true })),
      catchError((error: unknown) =>
        httpStatus(error) === 404 ? of<RestockDiscardResult>({ ok: true }) : of<RestockDiscardResult>(this.failure(error)),
      ),
    );
  }

  private loadDraft(): Observable<RestockPageData['draft']> {
    return this.http.get<RestockOrdersResponse>(RESTOCK_DRAFTS_URL).pipe(
      switchMap(({ orders }) =>
        orders.length === 0
          ? of(null)
          : this.http
              .get<RestockOrderResponse>(`${RESTOCK_ORDERS_URL}/${orders[0].id}`)
              .pipe(map((response) => response.order)),
      ),
    );
  }

  // 201 y 200 `replayed` llegan igual aquí: para la página son el mismo pedido.
  private outcome(request: Observable<RestockOrderResponse>): Observable<RestockResult> {
    return request.pipe(
      map((response): RestockResult => ({ ok: true, order: response.order })),
      catchError((error: unknown) => of<RestockResult>(this.failure(error))),
    );
  }

  // Traduce el fallo a un motivo. Sin respuesta o 5xx se trata como «sin conexión»: la página
  // reintenta con el mismo `requestId`. Los demás 4xx conservan el mensaje del backend.
  private failure(error: unknown): RestockFailure {
    const status = httpStatus(error);
    const message = httpErrorMessage(error);
    if (status === null || isOffline(error) || status >= 500) {
      return { ok: false, reason: 'offline', message: null };
    }
    if (status === 409) {
      return { ok: false, reason: message === CLOSED_ORDER_MESSAGE ? 'closed' : 'conflict', message };
    }
    if (status === 404) return { ok: false, reason: 'not-found', message };
    return { ok: false, reason: 'invalid', message };
  }
}
