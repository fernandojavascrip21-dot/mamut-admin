import { Injectable } from '@angular/core';
import { Observable, EMPTY } from 'rxjs';
import type { UpdateSellerInput, UpdateSellerResult } from '../interfaces/seller.models';

// Guarda los datos de un vendedor y traduce el resultado (HU-43). La lo provee la página.
@Injectable()
export class SellerUpdateService {
  update(id: string, input: UpdateSellerInput): Observable<UpdateSellerResult> {
    void id;
    void input;
    return EMPTY;
  }
}
