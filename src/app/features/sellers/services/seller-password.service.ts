import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import type { SellerPasswordResult, SetSellerPasswordInput } from '../interfaces/seller.models';

// Esqueleto (HU-45): traduce el error HTTP a un SellerPasswordResult en el paso 3 del plan.
@Injectable()
export class SellerPasswordService {
  change(_id: string, _input: SetSellerPasswordInput): Observable<SellerPasswordResult> {
    return of({ ok: false, reason: 'offline' });
  }
}
