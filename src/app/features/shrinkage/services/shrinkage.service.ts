import { Injectable } from '@angular/core';
import { EMPTY, type Observable } from 'rxjs';
import type {
  CreateShrinkagePayload,
  ShrinkageOptions,
  ShrinkageResult,
} from '../interfaces/shrinkage.models';

// Cliente de /api/shrinkages (HU-25). Esqueleto: la lógica llega con la implementación.
@Injectable({
  providedIn: 'root',
})
export class ShrinkageService {
  getOptions(sellerId?: string): Observable<ShrinkageOptions> {
    void sellerId;
    return EMPTY;
  }

  create(payload: CreateShrinkagePayload): Observable<ShrinkageResult> {
    void payload;
    return EMPTY;
  }
}
