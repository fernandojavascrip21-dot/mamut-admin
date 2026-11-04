import { CurrencyPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { initialsOf } from '@shared/utils/initials';
import type { SaleLine } from '../../interfaces/sale.models';
import { SALE_LINE_TEXTS } from './sale-line.constants';

// Un renglón de «Venta confirmada» (HU-16): foto (o iniciales), nombre, piezas, mi precio c/u,
// subtotal y «Te quedan N» (`stock.after`). Solo presentación; nunca muestra costo ni ganancia.
@Component({
  imports: [CurrencyPipe],
  selector: 'app-sale-line',
  templateUrl: './sale-line.component.html',
})
export class SaleLineComponent {
  readonly texts = SALE_LINE_TEXTS;

  readonly line = input.required<SaleLine>();

  // Si la URL de la foto no carga, cae a las iniciales en vez de dejar una imagen rota.
  private readonly imageBroken = signal(false);

  readonly showPhoto = computed(() => !!this.line().image && !this.imageBroken());
  readonly initials = computed(() => initialsOf(this.line().name));
  // Único `Number()` sobre un monto: solo para pasarlo al pipe `currency` al mostrarlo.
  readonly unitPrice = computed(() => Number(this.line().unitPrice));
  readonly subtotal = computed(() => Number(this.line().subtotal));

  onPhotoError(): void {
    this.imageBroken.set(true);
  }
}
