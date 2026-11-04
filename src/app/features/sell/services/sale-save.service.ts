import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { httpErrorMessage, httpStatus } from '@shared/utils/http-errors';
import {
  NOT_ENOUGH_UNITS_MESSAGE,
  SALE_INVALID_FALLBACK_MESSAGE,
  SALE_MISMATCH_MESSAGE,
} from '../constants/sales.constants';
import type { CreateSaleRequest, SaleResult } from '../interfaces/sale.models';
import { SalesService } from './sales.service';

// Orquesta la confirmación de la venta (HU-16) y traduce los errores HTTP a un SaleResult, para que
// la página no lea HttpErrorResponse. Sin providedIn: «Carrito» lo provee en sus `providers`. A
// diferencia de «Dejar», la llave de idempotencia no la genera él: viene en la petición, porque
// vive con el carrito (CartService) y debe sobrevivir a recargar.
@Injectable()
export class SaleSaveService {
  private readonly sales = inject(SalesService);

  confirm(body: CreateSaleRequest): Observable<SaleResult> {
    return this.sales.create(body).pipe(
      map(({ sale, replayed }): SaleResult => ({ ok: true, sale, replayed })),
      catchError((error: unknown) => of(this.toFailure(error))),
    );
  }

  // 409 con «No hay piezas suficientes» = alguna pieza ya no alcanza; 409 con «ya se registró con
  // otros datos» = la primera petición sí llegó y el carrito cambió después; 404/422 (y cualquier
  // otro 409) = el backend rechazó la venta y se muestra su mensaje. Sin respuesta, 0 o 5xx es
  // «offline»: la venta no se sabe registrada y se reintenta con la misma llave.
  private toFailure(error: unknown): SaleResult {
    const status = httpStatus(error);
    const message = httpErrorMessage(error);
    if (status === 409 && message === NOT_ENOUGH_UNITS_MESSAGE) return { ok: false, reason: 'not-enough-units' };
    if (status === 409 && message === SALE_MISMATCH_MESSAGE) return { ok: false, reason: 'already-registered' };
    if (status === 404 || status === 409 || status === 422) {
      return { ok: false, reason: 'invalid', message: message ?? SALE_INVALID_FALLBACK_MESSAGE };
    }
    return { ok: false, reason: 'offline' };
  }
}
