import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { ShrinkageHistoryItem } from '../interfaces/seller.models';

// Cliente HTTP de las últimas mermas de un vendedor (HU-26). Esqueleto: aún sin implementar.
@Injectable({
  providedIn: 'root',
})
export class SellerShrinkagesService {
  // Últimas mermas del vendedor, de la más nueva a la más vieja.
  list(sellerId: string): Observable<ShrinkageHistoryItem[]> {
    throw new Error(`no implementado: ${sellerId}`);
  }
}
