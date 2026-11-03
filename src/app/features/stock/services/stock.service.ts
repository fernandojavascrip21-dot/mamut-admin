import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/api-base-url';
import type { StockOverview } from '../interfaces/stock-overview.models';

// Cliente HTTP hacia /api/stock. El Bearer token lo agrega authInterceptor.
@Injectable({
  providedIn: 'root',
})
export class StockService {
  private readonly http = inject(HttpClient);

  // Bodega, vendedores activos y reparto por producto en una sola respuesta («Stock general», HU-13).
  overview(): Observable<StockOverview> {
    return this.http.get<StockOverview>(`${API_BASE_URL}/api/stock`);
  }
}
