import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { httpErrorMessage, httpStatus } from '@shared/utils/http-errors';
import { NOT_ENOUGH_UNITS_MESSAGE } from '../constants/deliveries.constants';
import type { HoldingFormValue, HoldingResult } from '../interfaces/delivery.models';
import { DeliveriesService } from './deliveries.service';

// Orquesta el guardado de «Editar lo dejado» y traduce los errores HTTP a un HoldingResult, para que
// la página no lea HttpErrorResponse. No necesita llave de idempotencia: manda el total final de
// piezas, así que repetir la petición no mueve nada dos veces.
@Injectable({
  providedIn: 'root',
})
export class HoldingSaveService {
  private readonly deliveries = inject(DeliveriesService);

  save(sellerId: string, productId: number, value: HoldingFormValue): Observable<HoldingResult> {
    return this.deliveries.updateHolding(sellerId, productId, value).pipe(
      map((holding): HoldingResult => ({ ok: true, holding })),
      catchError((error: unknown) => of(this.toFailure(error))),
    );
  }

  // 409 = la bodega no alcanza para subirle tantas piezas; 404 = el vendedor, el producto o su stock
  // ya no existe; 422 = el backend rechazó un dato (trae su mensaje). Cualquier otro error (sin red,
  // 5xx) es «no se pudo guardar», con Reintentar.
  private toFailure(error: unknown): HoldingResult {
    const status = httpStatus(error);
    const message = httpErrorMessage(error) ?? undefined;
    if (status === 409 && message === NOT_ENOUGH_UNITS_MESSAGE) {
      return { ok: false, reason: 'not-enough-units', message };
    }
    if (status === 404) return { ok: false, reason: 'not-found' };
    if (status === 422 || status === 409) return { ok: false, reason: 'invalid', message };
    return { ok: false, reason: 'offline' };
  }
}
