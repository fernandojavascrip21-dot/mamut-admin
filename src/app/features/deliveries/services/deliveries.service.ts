import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/api-base-url';
import type { Delivery, NewDeliveryInput, SellerHolding } from '../interfaces/delivery.models';

// Cliente HTTP de las entregas a vendedores (HU-11). El Bearer token lo agrega authInterceptor.
@Injectable({
  providedIn: 'root',
})
export class DeliveriesService {
  private readonly http = inject(HttpClient);

  // Deja piezas a un vendedor. Repetir el mismo `requestId` con los mismos datos responde la
  // entrega ya hecha, así que reintentar tras perder la respuesta no la duplica.
  create(sellerId: string, input: NewDeliveryInput): Observable<Delivery> {
    return this.http.post<Delivery>(
      `${API_BASE_URL}/api/sellers/${encodeURIComponent(sellerId)}/deliveries`,
      input,
    );
  }

  // Resumen de una entrega; un requestId que no existe responde 404.
  get(requestId: string): Observable<Delivery> {
    return this.http.get<Delivery>(
      `${API_BASE_URL}/api/deliveries/${encodeURIComponent(requestId)}`,
    );
  }

  // Lo que el vendedor ya tiene de ese producto, para prellenar la ventana.
  holding(sellerId: string, productId: number): Observable<SellerHolding> {
    return this.http.get<SellerHolding>(
      `${API_BASE_URL}/api/sellers/${encodeURIComponent(sellerId)}/stock/${productId}`,
    );
  }
}
