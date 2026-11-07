import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { httpErrorCode, httpErrorMessage, httpStatus, isOffline } from '@shared/utils/http-errors';
import {
  FRACTIONS_URL,
  NO_UNITS_MESSAGE,
  PORTIONS_INVALID_CODES,
  PRICE_BELOW_COST_CODE,
} from '../constants/fraction.constants';
import type {
  CreateFractionPayload,
  Fraction,
  FractionFailureReason,
  FractionOption,
  FractionResult,
} from '../interfaces/fraction.models';

// Cliente de /api/fractions (HU-23). El Bearer token lo agrega authInterceptor.
@Injectable({
  providedIn: 'root',
})
export class FractionService {
  private readonly http = inject(HttpClient);

  // Enteros fraccionables con su bolsita y sus piezas en bodega.
  getOptions(): Observable<FractionOption[]> {
    return this.http
      .get<{ products: FractionOption[] }>(`${FRACTIONS_URL}/options`)
      .pipe(map((body) => body.products));
  }

  // Registra el fraccionado. El backend responde { fraction, replayed }: replayed es true cuando es una
  // repetición del mismo requestId (200) y false cuando es uno nuevo (201).
  // Los errores no se lanzan: se devuelven como motivo para que la página decida qué pintar.
  create(payload: CreateFractionPayload): Observable<FractionResult> {
    return this.http.post<{ fraction: Fraction; replayed: boolean }>(FRACTIONS_URL, payload).pipe(
      map((body) => ({ ok: true as const, fraction: body.fraction, replayed: body.replayed })),
      catchError((error: unknown) => of(toFailure(error))),
    );
  }
}

// Traduce un error de la API a un motivo. Sin status (red) o 5xx no hay un error de negocio que
// mostrar, así que se trata como «sin conexión» y se conserva el requestId en la página.
function toFailure(error: unknown): FractionResult {
  const status = httpStatus(error);
  if (isOffline(error) || status === null || status >= 500) {
    return { ok: false, reason: 'offline', message: null };
  }
  return {
    ok: false,
    reason: failureReason(status, httpErrorCode(error), httpErrorMessage(error)),
    message: httpErrorMessage(error),
  };
}

// Motivo de un 4xx: el código decide el campo; el 409 de «sin piezas» se reconoce por su mensaje
// porque comparte código con los demás conflictos.
function failureReason(status: number, code: string | null, message: string | null): FractionFailureReason {
  if (status === 409 && message === NO_UNITS_MESSAGE) return 'no-units';
  if (code === PRICE_BELOW_COST_CODE) return 'price-below-cost';
  if (code !== null && PORTIONS_INVALID_CODES.includes(code)) return 'portions-invalid';
  return 'conflict';
}
