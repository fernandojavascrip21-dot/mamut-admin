import { CurrencyPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { Tag } from 'primeng/tag';
import { STOCK_LEVEL_LABELS } from '@shared/constants/stock-level.constants';
import { initialsOf } from '@shared/utils/initials';
import type { SaleLine } from '../../interfaces/sale.models';
import { SALE_LINE_TEXTS } from './sale-line.constants';

// Un renglón de «Venta confirmada», el mismo para los dos roles (HU-16 y HU-17): foto (o iniciales),
// nombre, piezas × precio c/u y subtotal. Lo que cambia según quién lo ve llega por `input()`:
// - Vendedor (`holderLabel` null): «Te quedan N» y nunca costo ni ganancia.
// - Administrador (`holderLabel` con el titular): «Luis: 6 → 4», la etiqueta «Baja existencia» o
//   «Agotado» si el titular quedó así (HU-18) y, si llega `profit`, la ganancia del renglón.
// Solo presentación: la página decide qué dato le pasa a cada rol.
@Component({
  imports: [CurrencyPipe, Tag],
  selector: 'app-sale-line',
  templateUrl: './sale-line.component.html',
})
export class SaleLineComponent {
  readonly texts = SALE_LINE_TEXTS;
  readonly levelLabels = STOCK_LEVEL_LABELS;

  readonly line = input.required<SaleLine>();
  // «Bodega» o el primer nombre del vendedor; null = vista del vendedor.
  readonly holderLabel = input<string | null>(null);
  // Ganancia del renglón como texto; null = no se muestra.
  readonly profitText = input<string | null>(null);

  // Si la URL de la foto no carga, cae a las iniciales en vez de dejar una imagen rota.
  private readonly imageBroken = signal(false);

  readonly showPhoto = computed(() => !!this.line().image && !this.imageBroken());
  readonly initials = computed(() => initialsOf(this.line().name));
  // Único `Number()` sobre un monto: solo para pasarlo al pipe `currency` al mostrarlo.
  readonly unitPrice = computed(() => Number(this.line().unitPrice));
  readonly subtotal = computed(() => Number(this.line().subtotal));
  readonly profit = computed(() => Number(this.profitText() ?? 0));

  onPhotoError(): void {
    this.imageBroken.set(true);
  }
}
