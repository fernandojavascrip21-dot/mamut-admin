import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { FRACTIONS_URL, SHRINKAGES_URL } from '../constants/stock-history.constants';
import type { FractionHistoryItem, ShrinkageHistoryItem } from '../interfaces/stock-history.models';

// Historial de mermas y fraccionados para «Stock general» (HU-26 §12). El Bearer token lo agrega authInterceptor.
@Injectable({
  providedIn: 'root',
})
export class StockHistoryService {
  private readonly http = inject(HttpClient);

  // Últimas mermas, de la más nueva a la más vieja. Sin `sellerId` son las de la bodega y de todos los
  // vendedores; con uno, solo las de ese vendedor (el backend limita la lista a 50).
  shrinkages(sellerId?: string): Observable<ShrinkageHistoryItem[]> {
    const params: Record<string, string> = sellerId ? { sellerId } : {};
    return this.http.get<ShrinkageHistoryItem[]>(SHRINKAGES_URL, { params });
  }

  // Los 50 fraccionados más recientes de la bodega. El backend responde { fractions }; aquí se devuelve la lista.
  fractions(): Observable<FractionHistoryItem[]> {
    return this.http
      .get<{ fractions: FractionHistoryItem[] }>(FRACTIONS_URL)
      .pipe(map((body) => body.fractions));
  }
}
