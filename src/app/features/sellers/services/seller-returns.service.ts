import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/api-base-url';
import type { NewReturnInput, ReturnHistoryItem, SellerReturn } from '../interfaces/seller.models';

// Cliente HTTP de los retiros a vendedores (HU-12). El Bearer token lo agrega authInterceptor.
@Injectable({
  providedIn: 'root',
})
export class SellerReturnsService {
  private readonly http = inject(HttpClient);

  private url(sellerId: string): string {
    return `${API_BASE_URL}/api/sellers/${encodeURIComponent(sellerId)}/returns`;
  }

  // Retira piezas del vendedor. Repetir el mismo `requestId` con los mismos datos responde el
  // retiro ya hecho, así que reintentar tras perder la respuesta no lo duplica.
  create(sellerId: string, input: NewReturnInput): Observable<SellerReturn> {
    return this.http.post<SellerReturn>(this.url(sellerId), input);
  }

  // Resumen de un retiro; uno que no existe, o que es de otro vendedor, responde 404.
  get(sellerId: string, requestId: string): Observable<SellerReturn> {
    return this.http.get<SellerReturn>(`${this.url(sellerId)}/${encodeURIComponent(requestId)}`);
  }

  // Últimos retiros del vendedor, del más nuevo al más viejo.
  list(sellerId: string): Observable<ReturnHistoryItem[]> {
    return this.http.get<ReturnHistoryItem[]>(this.url(sellerId));
  }
}
