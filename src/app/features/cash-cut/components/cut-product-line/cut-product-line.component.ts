import { CurrencyPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { Card } from 'primeng/card';
import { CUT_CARD_PASS_THROUGH } from '../../constants/cash-cut.constants';
import { initialsOf } from '@shared/utils/initials';
import type { CutProductLine } from '../../interfaces/cash-cut.models';
import { CUT_PRODUCT_LINE_TEXTS } from './cut-product-line.constants';

// Un renglón del desglose del corte (HU-19): foto (o iniciales), nombre, «2 × $920.00», el costo, el
// subtotal y la ganancia. Un mismo producto con dos precios llega como dos renglones. Solo presentación.
@Component({
  imports: [Card, CurrencyPipe],
  selector: 'app-cut-product-line',
  templateUrl: './cut-product-line.component.html',
})
export class CutProductLineComponent {
  readonly cardPassThrough = CUT_CARD_PASS_THROUGH;
  readonly line = input.required<CutProductLine>();
  // true con un vendedor («costo con envío»); false con la bodega («costo»).
  readonly withShipping = input.required<boolean>();

  // Si la URL de la foto no carga, cae a las iniciales en vez de dejar una imagen rota.
  private readonly imageBroken = signal(false);

  readonly showPhoto = computed(() => !!this.line().image && !this.imageBroken());
  readonly initials = computed(() => initialsOf(this.line().name));
  readonly costLabel = computed(() =>
    this.withShipping() ? CUT_PRODUCT_LINE_TEXTS.costWithShipping : CUT_PRODUCT_LINE_TEXTS.cost,
  );

  // `Number()` solo para pasar el monto al pipe `currency` al mostrarlo.
  readonly unitPrice = computed(() => Number(this.line().unitPrice));
  readonly total = computed(() => Number(this.line().total));
  readonly cost = computed(() => Number(this.line().cost));
  readonly profit = computed(() => Number(this.line().profit));
  // El signo del texto decide el «+» y el color; no se compara como número.
  readonly profitIsNegative = computed(() => this.line().profit?.startsWith('-') ?? false);

  onPhotoError(): void {
    this.imageBroken.set(true);
  }
}
