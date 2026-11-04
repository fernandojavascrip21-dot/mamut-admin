import { CurrencyPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { initialsOf } from '@shared/utils/initials';
import type { AdminSaleLine } from '../../interfaces/sale.models';
import { ADMIN_SALE_LINE_TEXTS } from './admin-sale-line.constants';

// Un renglón de «Venta confirmada» del administrador (HU-17): foto (o iniciales), nombre, piezas × precio
// c/u, subtotal, la ganancia del renglón y el stock del titular antes y después («Bodega: 4 → 2»,
// «Luis: 6 → 4»). Solo presentación: el nombre del titular lo pone la página.
@Component({
  imports: [CurrencyPipe],
  selector: 'app-admin-sale-line',
  templateUrl: './admin-sale-line.component.html',
})
export class AdminSaleLineComponent {
  readonly texts = ADMIN_SALE_LINE_TEXTS;

  readonly line = input.required<AdminSaleLine>();
  // «Bodega» o el primer nombre del vendedor: de quién es el stock que bajó.
  readonly holderLabel = input.required<string>();

  // Si la URL de la foto no carga, cae a las iniciales en vez de dejar una imagen rota.
  private readonly imageBroken = signal(false);

  readonly showPhoto = computed(() => !!this.line().image && !this.imageBroken());
  readonly initials = computed(() => initialsOf(this.line().name));
  // Único `Number()` sobre un monto: solo para pasarlo al pipe `currency` al mostrarlo.
  readonly unitPrice = computed(() => Number(this.line().unitPrice));
  readonly subtotal = computed(() => Number(this.line().subtotal));
  readonly profit = computed(() => Number(this.line().profit));

  onPhotoError(): void {
    this.imageBroken.set(true);
  }
}
