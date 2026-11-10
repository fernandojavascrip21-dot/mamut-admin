import { Injectable } from '@angular/core';
import { EMPTY, type Observable } from 'rxjs';
import type {
  CreateRestockOrderPayload, RestockDiscardResult, RestockResult, UpdateRestockOrderPayload,
} from '../interfaces/restock.models';
import type { RestockPageData } from '../models/restock-page.models';

// Cliente de /api/restock (T-36 y HU-31). Los errores no se lanzan: se devuelven como motivo.
@Injectable({ providedIn: 'root' })
export class RestockService {
  getPageData(): Observable<RestockPageData> {
    return EMPTY;
  }

  create(payload: CreateRestockOrderPayload): Observable<RestockResult> {
    void payload;
    return EMPTY;
  }

  update(id: number, payload: UpdateRestockOrderPayload): Observable<RestockResult> {
    void id;
    void payload;
    return EMPTY;
  }

  close(id: number): Observable<RestockResult> {
    void id;
    return EMPTY;
  }

  discard(id: number): Observable<RestockDiscardResult> {
    void id;
    return EMPTY;
  }
}
