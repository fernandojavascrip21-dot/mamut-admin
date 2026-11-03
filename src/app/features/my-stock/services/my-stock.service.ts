import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/api-base-url';
import type { MyStock } from '../interfaces/my-stock.models';

// Cliente HTTP hacia /api/me/stock. El Bearer token lo agrega authInterceptor.
@Injectable({
  providedIn: 'root',
})
export class MyStockService {
  private readonly http = inject(HttpClient);

  // Stock del vendedor en sesión («Mi stock», HU-14). El id sale de la sesión en el backend: no
  // viaja ningún parámetro que lo cambie.
  load(): Observable<MyStock> {
    return this.http.get<MyStock>(`${API_BASE_URL}/api/me/stock`);
  }
}
