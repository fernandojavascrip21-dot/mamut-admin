import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, catchError, map, of } from 'rxjs';
import { httpErrorMessage, httpStatus, isOffline } from '@shared/utils/http-errors';
import { NO_UNITS_MESSAGE, SHRINKAGES_URL } from '../constants/shrinkage.constants';
import type {
  CreateShrinkagePayload,
  Shrinkage,
  ShrinkageFailureReason,
  ShrinkageHistoryItem,
  ShrinkageOptions,
  ShrinkageResult,
} from '../interfaces/shrinkage.models';

// Cliente de /api/shrinkages (HU-25). El Bearer token lo agrega authInterceptor.
@Injectable({
  providedIn: 'root',
})
export class ShrinkageService {
  private readonly http = inject(HttpClient);

  // Productos con piezas del titular. Sin `sellerId` el titular es la bodega.
  getOptions(sellerId?: string): Observable<ShrinkageOptions> {
    const params: Record<string, string> = sellerId ? { sellerId } : {};
    return this.http.get<ShrinkageOptions>(`${SHRINKAGES_URL}/options`, { params });
  }

  // Últimas mermas (HU-26), de la más nueva a la más vieja. Esqueleto: aún sin implementar.
  list(sellerId?: string): Observable<ShrinkageHistoryItem[]> {
    throw new Error(`no implementado: ${sellerId ?? ''}`);
  }

  // Registra la merma. El backend responde { shrinkage, replayed }: 201 es nueva y 200 una repetición
  // del mismo requestId. Los errores no se lanzan: se devuelven como motivo para que la página decida.
  create(payload: CreateShrinkagePayload): Observable<ShrinkageResult> {
    return this.http.post<{ shrinkage: Shrinkage; replayed: boolean }>(SHRINKAGES_URL, payload).pipe(
      map((body) => ({ ok: true as const, shrinkage: body.shrinkage, replayed: body.replayed })),
      catchError((error: unknown) => of(toFailure(error))),
    );
  }
}

// Sin status (red) o 5xx no hay un error de negocio que mostrar: se trata como «sin conexión» y la
// página conserva el requestId para que reintentar no registre dos mermas.
function toFailure(error: unknown): ShrinkageResult {
  const status = httpStatus(error);
  if (isOffline(error) || status === null || status >= 500) {
    return { ok: false, reason: 'offline', message: null };
  }
  const message = httpErrorMessage(error);
  return { ok: false, reason: failureReason(status, message), message };
}

// Motivo de un 4xx: el 409 de «sin piezas» se reconoce por su mensaje; un 404 es un titular o producto
// que ya no existe; el resto (otro 409, 422) se muestra tal cual lo redactó el backend.
function failureReason(status: number, message: string | null): ShrinkageFailureReason {
  if (status === 409 && message === NO_UNITS_MESSAGE) return 'no-units';
  if (status === 404) return 'not-found';
  return 'conflict';
}
