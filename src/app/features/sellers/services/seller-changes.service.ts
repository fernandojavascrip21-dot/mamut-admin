import { Injectable, signal } from '@angular/core';

// Aviso de que los datos de un vendedor cambiaron (HU-43). La ficha observa `version` y vuelve a
// pedir al vendedor sin pasar por «cargando». No se reusa StockChangesService: ese significa «cambió el stock».
@Injectable({ providedIn: 'root' })
export class SellerChangesService {
  private readonly counter = signal(0);

  readonly version = this.counter.asReadonly();

  notify(): void {
    this.counter.update((count) => count + 1);
  }
}
