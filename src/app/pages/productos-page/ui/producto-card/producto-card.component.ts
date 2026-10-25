import { CurrencyPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import type { ProductoResumen } from '../../../../productos/interfaces/producto.models';
import { initialsOf } from '../../../../shared/initials';

// Tarjeta horizontal de la pantalla 03 (spec M1-hu05 §6): foto o inicial con las etiquetas
// "Agotado"/"Fraccionado" encima, nombre, piezas en bodega y precio. Sin acciones todavía
// (Vender/Dejar a vendedor llegan en M2/M3) ni eventos propios.
@Component({
  imports: [CurrencyPipe],
  selector: 'app-producto-card',
  templateUrl: './producto-card.component.html',
})
export class ProductoCardComponent {
  readonly producto = input.required<ProductoResumen>();

  // Si la URL de la foto no carga, cae a la inicial en vez de dejar una imagen rota (§2).
  private readonly imagenRota = signal(false);

  readonly mostrarFoto = computed(() => this.producto().image !== '' && !this.imagenRota());
  readonly inicial = computed(() => initialsOf(this.producto().name));
  readonly agotado = computed(() => this.producto().stock <= 0);
  readonly precio = computed(() => Number(this.producto().price));

  onErrorFoto(): void {
    this.imagenRota.set(true);
  }
}
