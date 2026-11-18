import { Injectable, signal } from '@angular/core';

// Aviso de que los datos de un vendedor cambiaron (HU-43).
@Injectable({ providedIn: 'root' })
export class SellerChangesService {
  private readonly counter = signal(0);

  readonly version = this.counter.asReadonly();

  notify(): void {
    return;
  }
}
