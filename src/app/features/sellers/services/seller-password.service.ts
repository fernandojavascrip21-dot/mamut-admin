import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { httpErrorMessage, httpStatus } from '@shared/utils/http-errors';
import { SellersService } from './sellers.service';
import type { SellerPasswordResult, SetSellerPasswordInput } from '../interfaces/seller.models';

// Cambia la contraseña temporal (HU-45) y traduce el error HTTP a un SellerPasswordResult, para que
// la página no lea HttpErrorResponse. Sin providedIn: la página lo provee.
@Injectable()
export class SellerPasswordService {
  private readonly sellersService = inject(SellersService);

  change(id: string, input: SetSellerPasswordInput): Observable<SellerPasswordResult> {
    return this.sellersService.setPassword(id, input).pipe(
      map((response): SellerPasswordResult => ({ ok: true, emailStatus: response.emailStatus })),
      catchError((error: unknown) => of(this.toFailure(error))),
    );
  }

  // 422 = contraseña rechazada (trae su mensaje); 404 = el vendedor ya no está; sin red o 5xx = reintentar.
  private toFailure(error: unknown): SellerPasswordResult {
    const status = httpStatus(error);
    if (status === 422) return { ok: false, reason: 'invalid', message: httpErrorMessage(error) ?? undefined };
    if (status === 404) return { ok: false, reason: 'not-found' };
    return { ok: false, reason: 'offline' };
  }
}
