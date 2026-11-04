import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/api-base-url';
import type { SaleCatalog } from './sale-catalog.models';

// Cliente de GET /api/sales/catalog (HU-17): lo que el administrador puede vender de un titular, con
// piezas, precio y costo ya resueltos. Vive en core porque lo usan «Productos» y el carrito del
// administrador, features que no se importan entre sí. El Bearer token lo agrega authInterceptor.
@Injectable({ providedIn: 'root' })
export class SaleCatalogService {
  private readonly http = inject(HttpClient);

  // `null` es la bodega (sin parámetro); un id es un vendedor activo.
  load(holderId: string | null): Observable<SaleCatalog> {
    return this.http.get<SaleCatalog>(
      `${API_BASE_URL}/api/sales/catalog`,
      holderId === null ? {} : { params: { holderId } },
    );
  }
}
