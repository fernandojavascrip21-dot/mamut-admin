import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/api-base-url';
import type { DeliveryProduct, DeliveryProductSummary } from '../interfaces/delivery.models';

// Lee los productos que necesita la ventana «Dejar a vendedor». Repite dos lecturas pequeñas de
// features/products porque una feature no importa a otra; sus tipos son los de la entrega.
@Injectable({
  providedIn: 'root',
})
export class DeliveryProductsService {
  private readonly http = inject(HttpClient);

  // Productos activos para el buscador (GET /api/products, sin costo).
  list(): Observable<DeliveryProductSummary[]> {
    return this.http.get<DeliveryProductSummary[]>(`${API_BASE_URL}/api/products`);
  }

  // Un producto con su costo de fábrica; uno archivado o inexistente responde 404.
  get(id: number): Observable<DeliveryProduct> {
    return this.http.get<DeliveryProduct>(`${API_BASE_URL}/api/products/${id}`);
  }
}
