import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '@core/api-base-url';
import type { CashCut, CashCutQuery } from '../interfaces/cash-cut.models';

// Cliente HTTP del corte (T-20). El Bearer token lo agrega authInterceptor.
@Injectable({
  providedIn: 'root',
})
export class CashCutService {
  private readonly http = inject(HttpClient);

  // Pide el corte calculado, sin guardarlo. `holderId` se omite para la bodega: el backend
  // interpreta su ausencia como «bodega», así que mandar `null` o vacío sería un error.
  get(query: CashCutQuery): Observable<CashCut> {
    let params = new HttpParams().set('period', query.period).set('date', query.date);
    if (query.holderId !== null) params = params.set('holderId', query.holderId);
    return this.http
      .get<{ cut: CashCut }>(`${API_BASE_URL}/api/cuts`, { params })
      .pipe(map((r) => r.cut));
  }

  // Pide el corte para casa (costo de fábrica, ganancia real y cobertura de envío) con `type=home`.
  // Misma regla que `get()`: `holderId` se omite para la bodega.
  getHome(query: CashCutQuery): Observable<CashCut> {
    let params = new HttpParams()
      .set('type', 'home')
      .set('period', query.period)
      .set('date', query.date);
    if (query.holderId !== null) params = params.set('holderId', query.holderId);
    return this.http
      .get<{ cut: CashCut }>(`${API_BASE_URL}/api/cuts`, { params })
      .pipe(map((r) => r.cut));
  }

  // Pide el resumen del negocio (corte para casa de todos los titulares, `scope=business`).
  // Nunca manda `holderId`: el alcance es todo el negocio y el backend lo rechazaría.
  getBusiness(query: Pick<CashCutQuery, 'period' | 'date'>): Observable<CashCut> {
    const params = new HttpParams()
      .set('type', 'home')
      .set('scope', 'business')
      .set('period', query.period)
      .set('date', query.date);
    return this.http
      .get<{ cut: CashCut }>(`${API_BASE_URL}/api/cuts`, { params })
      .pipe(map((r) => r.cut));
  }
}
