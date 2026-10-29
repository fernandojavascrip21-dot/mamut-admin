import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@shared/api-base-url';
import type { CreateSellerInput, Seller } from '../interfaces/seller.models';

// Cliente HTTP hacia /api/sellers. El Bearer token lo agrega authInterceptor.
@Injectable({
  providedIn: 'root',
})
export class SellersService {
  private readonly http = inject(HttpClient);

  create(input: CreateSellerInput): Observable<Seller> {
    return this.http.post<Seller>(`${API_BASE_URL}/api/sellers`, input);
  }
}
