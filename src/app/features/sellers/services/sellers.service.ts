import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { API_BASE_URL } from '@core/api-base-url';
import type {
  CreateSellerInput, DeliveryHistoryItem, EmailStatus, Seller, SellerDetail, SellerListStatus, SellerSummary,
  SellerPasswordResponse, SetSellerPasswordInput, UpdateSellerInput,
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

  // Vendedores con su total de piezas («Mis vendedores», HU-09). Los activos van sin parámetro (la URL
  // de siempre); los desactivados piden `?status=inactive` (HU-44).
  list(status: SellerListStatus = 'active'): Observable<SellerSummary[]> {
    const params = status === 'inactive' ? new HttpParams().set('status', 'inactive') : undefined;
    return this.http.get<SellerSummary[]>(`${API_BASE_URL}/api/sellers`, { params });
  }

  // Un vendedor con su stock por producto; un id que no es de un vendedor activo responde 404.
  get(id: string): Observable<SellerDetail> {
    return this.http.get<SellerDetail>(`${API_BASE_URL}/api/sellers/${encodeURIComponent(id)}`);
  }

  // Edita los datos de un vendedor (HU-43). Siempre van los cuatro (T-42); un 409 es correo repetido.
  update(id: string, input: UpdateSellerInput): Observable<Seller> {
    return this.http.put<Seller>(`${API_BASE_URL}/api/sellers/${encodeURIComponent(id)}`, input);
  }

  // Últimas entregas que se le dejaron al vendedor, de la más nueva a la más vieja (HU-11).
  deliveries(id: string): Observable<DeliveryHistoryItem[]> {
    return this.http.get<DeliveryHistoryItem[]>(`${API_BASE_URL}/api/sellers/${encodeURIComponent(id)}/deliveries`);
  }

  // El detalle de un vendedor activo o desactivado (`?status=any`, HU-44); `get` solo ve activos.
  getAny(id: string): Observable<SellerDetail> {
    return this.http.get<SellerDetail>(`${API_BASE_URL}/api/sellers/${encodeURIComponent(id)}`, {
      params: { status: 'any' },
    });
  }

  // Desactivar y reactivar responden el vendedor y cómo salió el aviso por correo.
  deactivate(id: string): Observable<Seller & { emailStatus: EmailStatus | null }> {
    return this.http.post<Seller & { emailStatus: EmailStatus | null }>(
      `${API_BASE_URL}/api/sellers/${encodeURIComponent(id)}/deactivate`,
      {},
    );
  }

  reactivate(id: string): Observable<Seller & { emailStatus: EmailStatus | null }> {
    return this.http.post<Seller & { emailStatus: EmailStatus | null }>(
      `${API_BASE_URL}/api/sellers/${encodeURIComponent(id)}/reactivate`,
      {},
    );
  }

  // Elimina un alta hecha por error (204).
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/api/sellers/${encodeURIComponent(id)}`);
  }

  // Esqueleto (HU-45): la llamada real se implementa en el paso 3 del plan.
  setPassword(_id: string, _input: SetSellerPasswordInput): Observable<SellerPasswordResponse> {
    return throwError(() => new Error('sin implementar'));
  }
}
