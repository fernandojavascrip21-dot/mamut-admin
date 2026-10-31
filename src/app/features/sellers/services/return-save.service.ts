import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { httpErrorMessage, httpStatus } from '@shared/utils/http-errors';
import { newUuid } from '@shared/utils/uuid';
import { NOT_ENOUGH_UNITS_MESSAGE } from '../constants/sellers.constants';
import type { ReturnFormValue, ReturnResult } from '../interfaces/seller.models';
import { SellerReturnsService } from './seller-returns.service';

// Orquesta el guardado de «Retirar producto» (HU-12) y traduce los errores HTTP a un ReturnResult,
// para que la página no lea HttpErrorResponse. Sin providedIn: la página lo provee en sus
// `providers`, como DeliverySaveService, y su requestId vive lo que dure la pantalla.
@Injectable()
export class ReturnSaveService {
  private readonly returns = inject(SellerReturnsService);

  // Una sola llave por pantalla: «Reintentar» reenvía la misma, así que si la primera petición sí
  // llegó pero se perdió la respuesta, el backend responde ese retiro en vez de duplicarlo. Si se
  // cambian los datos antes de reintentar y el retiro ya existía, el backend lo rechaza con 409
  // («mismatch»); si no existía, simplemente se registra.
  private readonly requestId = newUuid();

  create(sellerId: string, value: ReturnFormValue): Observable<ReturnResult> {
    return this.returns
      .create(sellerId, { requestId: this.requestId, productId: value.productId, qty: value.qty })
      .pipe(
        map((sellerReturn): ReturnResult => ({ ok: true, sellerReturn })),
        catchError((error: unknown) => of(this.toFailure(error))),
      );
  }

  // 409 = el vendedor no tiene tantas piezas (cuerpo «No hay piezas suficientes») o el requestId ya
  // se usó con otros datos; 404 = el vendedor o el producto ya no está; 422 = el backend rechazó un
  // dato (trae su mensaje). Cualquier otro error (sin red, 5xx) es «no se pudo registrar», con Reintentar.
  private toFailure(error: unknown): ReturnResult {
    const status = httpStatus(error);
    const message = httpErrorMessage(error) ?? undefined;
    if (status === 409) {
      return {
        ok: false,
        reason: message === NOT_ENOUGH_UNITS_MESSAGE ? 'not-enough-units' : 'mismatch',
        message,
      };
    }
    if (status === 404) return { ok: false, reason: 'not-found' };
    if (status === 422) return { ok: false, reason: 'invalid', message };
    return { ok: false, reason: 'offline' };
  }
}
