import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { ViewingService } from '@core/viewing/viewing.service';
import { httpErrorMessage, httpStatus } from '@shared/utils/http-errors';
import { SellerChangesService } from './seller-changes.service';
import { SellersService } from './sellers.service';
import type { UpdateSellerInput, UpdateSellerResult } from '../interfaces/seller.models';

// Guarda los datos de un vendedor (HU-43) y traduce el error HTTP a un UpdateSellerResult, para que
// la página no lea HttpErrorResponse. Sin providedIn: la página lo provee, como SellerSaveService.
@Injectable()
export class SellerUpdateService {
  private readonly sellersService = inject(SellersService);
  private readonly viewing = inject(ViewingService);
  private readonly sellerChanges = inject(SellerChangesService);

  // Solo un guardado exitoso recarga «Viendo» y avisa a la ficha: un error no cambió nada que mostrar.
  update(id: string, input: UpdateSellerInput): Observable<UpdateSellerResult> {
    return this.sellersService.update(id, input).pipe(
      tap(() => {
        this.viewing.reload();
        this.sellerChanges.notify();
      }),
      map((seller): UpdateSellerResult => ({ ok: true, seller })),
      catchError((error: unknown) => of(this.toFailure(error))),
    );
  }

  // 409 = correo de otra cuenta; 422 = dato rechazado (trae su mensaje); 404 = el vendedor ya no
  // está. Cualquier otro error (sin red, 5xx) es «no se pudo guardar», con Reintentar.
  private toFailure(error: unknown): UpdateSellerResult {
    const status = httpStatus(error);
    if (status === 409) return { ok: false, reason: 'duplicate-email' };
    if (status === 422) return { ok: false, reason: 'invalid', message: httpErrorMessage(error) ?? undefined };
    if (status === 404) return { ok: false, reason: 'not-found' };
    return { ok: false, reason: 'offline' };
  }
}
