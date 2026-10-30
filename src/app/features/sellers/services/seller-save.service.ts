import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { httpErrorMessage, httpStatus } from '@shared/utils/http-errors';
import { SellersService } from './sellers.service';
import type { CreateSellerInput, CreateSellerResult } from '../interfaces/seller.models';

// Orquesta el guardado de la pantalla 15 (HU-08) y traduce los errores HTTP a un
// CreateSellerResult, para que la página no lea HttpErrorResponse. Sin providedIn: la página lo
// provee en sus `providers`, como ProductSaveService.
@Injectable()
export class SellerSaveService {
  private readonly sellersService = inject(SellersService);

  create(input: CreateSellerInput): Observable<CreateSellerResult> {
    return this.sellersService.create(input).pipe(
      map((seller): CreateSellerResult => ({ ok: true, seller })),
      catchError((error: unknown) => of(this.toFailure(error))),
    );
  }

  // 409 = correo ya usado; 422 = el backend rechazó un dato (trae su mensaje). Cualquier otro
  // error (sin red, 5xx) se trata como «no se pudo guardar», con Reintentar.
  private toFailure(error: unknown): CreateSellerResult {
    const status = httpStatus(error);
    if (status === 409) return { ok: false, reason: 'duplicate-email' };
    if (status === 422) return { ok: false, reason: 'invalid', message: httpErrorMessage(error) ?? undefined };
    return { ok: false, reason: 'offline' };
  }
}
