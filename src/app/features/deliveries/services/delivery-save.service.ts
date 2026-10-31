import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { httpErrorMessage, httpStatus } from '@shared/utils/http-errors';
import { newUuid } from '@shared/utils/uuid';
import { NOT_ENOUGH_UNITS_MESSAGE } from '../constants/deliveries.constants';
import type { DeliveryFormValue, DeliveryResult } from '../interfaces/delivery.models';
import { DeliveriesService } from './deliveries.service';

// Orquesta el guardado de «Dejar a vendedor» (HU-11) y traduce los errores HTTP a un
// DeliveryResult, para que la página no lea HttpErrorResponse. Sin providedIn: la página lo provee
// en sus `providers`, como ProductSaveService, y su requestId vive lo que dure la pantalla.
@Injectable()
export class DeliverySaveService {
  private readonly deliveries = inject(DeliveriesService);

  // Una sola llave por pantalla: «Reintentar» reenvía la misma, así que si la primera petición sí
  // llegó pero se perdió la respuesta, el backend responde esa entrega en vez de duplicarla. Si el
  // administrador cambia los datos antes de reintentar y la entrega ya existía, el backend lo
  // rechaza con 409 («mismatch»); si no existía, simplemente se registra.
  private readonly requestId = newUuid();

  create(value: DeliveryFormValue): Observable<DeliveryResult> {
    return this.deliveries
      .create(value.sellerId, {
        requestId: this.requestId,
        productId: value.productId,
        qty: value.qty,
        unitPrice: value.unitPrice,
        unitCostWithShipping: value.unitCostWithShipping,
      })
      .pipe(
        map((delivery): DeliveryResult => ({ ok: true, delivery })),
        catchError((error: unknown) => of(this.toFailure(error))),
      );
  }

  // 409 = no alcanzan las piezas (cuerpo «No hay piezas suficientes») o el requestId ya se usó con
  // otros datos; 404 = el vendedor o el producto ya no está; 422 = el backend rechazó un dato (trae
  // su mensaje). Cualquier otro error (sin red, 5xx) es «no se pudo registrar», con Reintentar.
  private toFailure(error: unknown): DeliveryResult {
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
