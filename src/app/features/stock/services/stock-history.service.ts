import { Injectable } from '@angular/core';
import { type Observable, NEVER } from 'rxjs';
import type { FractionHistoryItem, ShrinkageHistoryItem } from '../interfaces/stock-history.models';

// Esqueleto (HU-26 §12): el implementer agrega las peticiones a /api/shrinkages y /api/fractions.
@Injectable({
  providedIn: 'root',
})
export class StockHistoryService {
  shrinkages(sellerId?: string): Observable<ShrinkageHistoryItem[]> {
    void sellerId;
    return NEVER;
  }

  fractions(): Observable<FractionHistoryItem[]> {
    return NEVER;
  }
}
