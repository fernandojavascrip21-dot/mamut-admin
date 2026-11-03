import { CurrencyPipe } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { Card } from 'primeng/card';
import { initialsOf } from '@shared/utils/initials';
import { SELL_CARD_TEXTS } from '../../constants/sell-page.constants';
import type { SellProduct } from '../../interfaces/sell-stock.models';
import { canIncrement, unitsLeft } from '../../rules/sell.rules';
import { SELL_PRODUCT_CARD_PASS_THROUGH } from './sell-product-card.constants';

// Card de un producto del catálogo «Vender» (HU-15): foto (o iniciales), nombre, precio del vendedor y
// «Quedan N». Sin el producto en el carrito ofrece «+ Agregar»; con él, −/piezas/+, y el + se
// deshabilita en el tope. Un producto sin piezas sale «Agotado» y no se puede agregar. Es solo
// presentación: no toca el carrito, emite `add`, `increment` y `decrement` y la página decide.
@Component({
  imports: [CurrencyPipe, ButtonDirective, Card],
  selector: 'app-sell-product-card',
  templateUrl: './sell-product-card.component.html',
})
export class SellProductCardComponent {
  readonly cardPassThrough = SELL_PRODUCT_CARD_PASS_THROUGH;
  readonly texts = SELL_CARD_TEXTS;

  readonly product = input.required<SellProduct>();
  readonly unitsInCart = input(0);

  readonly add = output<void>();
  readonly increment = output<void>();
  readonly decrement = output<void>();

  // Si la URL de la foto no carga, cae a las iniciales en vez de dejar una imagen rota.
  private readonly imageBroken = signal(false);

  readonly showPhoto = computed(() => !!this.product().image && !this.imageBroken());
  readonly initials = computed(() => initialsOf(this.product().name));
  // Único `Number()` sobre un monto: solo para pasarlo al pipe `currency` al mostrarlo.
  readonly price = computed(() => Number(this.product().price));

  readonly soldOut = computed(() => this.product().units <= 0);
  readonly inCart = computed(() => this.unitsInCart() > 0);
  readonly left = computed(() => unitsLeft(this.product(), this.unitsInCart()));
  readonly canIncrement = computed(() => canIncrement(this.product(), this.unitsInCart()));
  // «Queda 1» / «Quedan N»; un producto sin piezas dice «Sin piezas».
  readonly leftText = computed(() => {
    if (this.soldOut()) return this.texts.soldOutLeft;
    const left = this.left();
    return `${left === 1 ? this.texts.leftSingular : this.texts.leftPlural} ${left}`;
  });

  onPhotoError(): void {
    this.imageBroken.set(true);
  }
}
