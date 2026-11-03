import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/api-base-url';
import type { SellStock } from '../interfaces/sell-stock.models';

// Cliente HTTP hacia /api/me/stock para «Vender» y «Carrito». El Bearer token lo agrega authInterceptor.
@Injectable({
  providedIn: 'root',
})
export class SellStockService {
  private readonly http = inject(HttpClient);

  // Lo que el vendedor en sesión tiene y lo que tuvo y se le acabó (HU-15). El id sale de la sesión
  // en el backend: no viaja ningún parámetro que lo cambie.
  load(): Observable<SellStock> {
    return this.http.get<SellStock>(`${API_BASE_URL}/api/me/stock`, { params: { includeSoldOut: 'true' } });
  }
}
