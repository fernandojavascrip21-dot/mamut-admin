import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/api-base-url';
import type { ShrinkageHistoryItem } from '../interfaces/seller.models';

// Cliente HTTP de las últimas mermas de un vendedor (HU-26). El Bearer token lo agrega authInterceptor.
@Injectable({
  providedIn: 'root',
})
export class SellerShrinkagesService {
  private readonly http = inject(HttpClient);

  // Últimas mermas del vendedor, de la más nueva a la más vieja.
  list(sellerId: string): Observable<ShrinkageHistoryItem[]> {
    return this.http.get<ShrinkageHistoryItem[]>(
      `${API_BASE_URL}/api/sellers/${encodeURIComponent(sellerId)}/shrinkages`,
    );
  }
}
