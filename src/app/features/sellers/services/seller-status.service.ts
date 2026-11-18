import { Injectable } from '@angular/core';
import { EMPTY, Observable } from 'rxjs';
import type { SellerStatusResult } from '../interfaces/seller.models';

// Esqueleto (spec M13-hu44): desactivar, reactivar y eliminar un vendedor traduciendo el error HTTP a un
// SellerStatusResult. Sin providedIn: lo proveen la ficha y el pop-up «Editar datos».
@Injectable()
export class SellerStatusService {
  deactivate(id: string): Observable<SellerStatusResult> {
    return EMPTY;
  }

  reactivate(id: string): Observable<SellerStatusResult> {
    return EMPTY;
  }

  remove(id: string): Observable<SellerStatusResult> {
    return EMPTY;
  }
}
