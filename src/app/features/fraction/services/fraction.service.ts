import { Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { CreateFractionPayload, FractionOption, FractionResult } from '../interfaces/fraction.models';

// Esqueleto de HU-23: cliente de /api/fractions. Sin implementar.
@Injectable({
  providedIn: 'root',
})
export class FractionService {
  getOptions(): Observable<FractionOption[]> {
    throw new Error('getOptions sin implementar');
  }

  create(payload: CreateFractionPayload): Observable<FractionResult> {
    void payload;
    throw new Error('create sin implementar');
  }
}
