import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/api-base-url';
import type {
  CreateSellerInput, DeliveryHistoryItem, Seller, SellerDetail, SellerSummary,
} from '../interfaces/seller.models';

// Cliente HTTP hacia /api/sellers. El Bearer token lo agrega authInterceptor.
@Injectable({
  providedIn: 'root',
})
export class SellersService {
  private readonly http = inject(HttpClient);

  create(input: CreateSellerInput): Observable<Seller> {
    return this.http.post<Seller>(`${API_BASE_URL}/api/sellers`, input);
  }

  // Vendedores activos con su total de piezas («Mis vendedores», HU-09).
  list(): Observable<SellerSummary[]> {
    return this.http.get<SellerSummary[]>(`${API_BASE_URL}/api/sellers`);
  }

  // Un vendedor con su stock por producto; un id que no es de un vendedor activo responde 404.
  get(id: string): Observable<SellerDetail> {
    return this.http.get<SellerDetail>(`${API_BASE_URL}/api/sellers/${encodeURIComponent(id)}`);
  }

  // Últimas entregas que se le dejaron al vendedor, de la más nueva a la más vieja (HU-11).
  deliveries(id: string): Observable<DeliveryHistoryItem[]> {
    return this.http.get<DeliveryHistoryItem[]>(`${API_BASE_URL}/api/sellers/${encodeURIComponent(id)}/deliveries`);
  }
}
