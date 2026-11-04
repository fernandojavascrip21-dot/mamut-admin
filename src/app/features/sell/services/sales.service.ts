import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/api-base-url';
import type { CreateSaleRequest, SaleResponse } from '../interfaces/sale.models';

// Cliente HTTP de las ventas (HU-16). El Bearer token lo agrega authInterceptor.
@Injectable({
  providedIn: 'root',
})
export class SalesService {
  private readonly http = inject(HttpClient);

  // Confirma la venta. Repetir el mismo `requestId` con los mismos renglones responde la venta ya
  // hecha (200, `replayed`), así que reintentar tras perder la respuesta no la duplica.
  create(body: CreateSaleRequest): Observable<SaleResponse> {
    return this.http.post<SaleResponse>(`${API_BASE_URL}/api/sales`, body);
  }

  // Lee una venta por su llave; una que no existe (o no es del vendedor) responde 404.
  get(requestId: string): Observable<SaleResponse> {
    return this.http.get<SaleResponse>(`${API_BASE_URL}/api/sales/${encodeURIComponent(requestId)}`);
  }
}
