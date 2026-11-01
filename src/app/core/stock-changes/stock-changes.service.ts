import { Injectable, signal } from '@angular/core';

// Aviso de que el inventario cambió (spec T-16): el pop-up de «Dejar» o «Retirar» llama a `notify()`
// al guardar, y las páginas que muestran piezas (el detalle del vendedor, «Productos») recargan al
// ver cambiar `version`. No lleva datos: así una feature avisa a otra sin importarla.
@Injectable({ providedIn: 'root' })
export class StockChangesService {
  private readonly counter = signal(0);

  // Sube con cada cambio. Quien lo lee guarda el valor con el que nació y ignora ese.
  readonly version = this.counter.asReadonly();

  notify(): void {
    this.counter.update((value) => value + 1);
  }
}
