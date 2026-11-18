import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { ViewingService } from '@core/viewing/viewing.service';
import { httpStatus } from '@shared/utils/http-errors';
import { SellerChangesService } from './seller-changes.service';
import { SellersService } from './sellers.service';
import type { SellerStatusFailure, SellerStatusResult } from '../interfaces/seller.models';

// Desactivar, reactivar y eliminar un vendedor (HU-44), traduciendo el error HTTP a un
// SellerStatusResult para que la página no lea HttpErrorResponse. Sin providedIn: lo proveen la ficha
// y el pop-up «Editar datos». Solo un éxito recarga «Viendo»; desactivar y reactivar además avisan a la
// ficha (eliminar no: la ficha ya no tiene a quién recargar).
@Injectable()
export class SellerStatusService {
  private readonly sellersService = inject(SellersService);
  private readonly viewing = inject(ViewingService);
  private readonly sellerChanges = inject(SellerChangesService);

  deactivate(id: string): Observable<SellerStatusResult> {
    return this.sellersService.deactivate(id).pipe(
      tap(() => this.onChanged(true)),
      map(({ emailStatus, ...seller }): SellerStatusResult => ({ ok: true, seller, emailStatus })),
      catchError((error: unknown) => of(this.toFailure(error, 'has-units'))),
    );
  }

  reactivate(id: string): Observable<SellerStatusResult> {
    return this.sellersService.reactivate(id).pipe(
      tap(() => this.onChanged(true)),
      map(({ emailStatus, ...seller }): SellerStatusResult => ({ ok: true, seller, emailStatus })),
      catchError((error: unknown) => of(this.toFailure(error, 'has-units'))),
    );
  }

  remove(id: string): Observable<SellerStatusResult> {
    return this.sellersService.remove(id).pipe(
      tap(() => this.onChanged(false)),
      map((): SellerStatusResult => ({ ok: true, seller: null, emailStatus: null })),
      catchError((error: unknown) => of(this.toFailure(error, 'has-history'))),
    );
  }

  private onChanged(notifyDetail: boolean): void {
    this.viewing.reload();
    if (notifyDetail) this.sellerChanges.notify();
  }

  // 409 = piezas a su cargo (desactivar) o historial (eliminar); 404 = ya no existe; el resto, sin red o 5xx.
  private toFailure(error: unknown, conflict: SellerStatusFailure): SellerStatusResult {
    const status = httpStatus(error);
    if (status === 409) return { ok: false, reason: conflict };
    if (status === 404) return { ok: false, reason: 'not-found' };
    return { ok: false, reason: 'offline' };
  }
}
