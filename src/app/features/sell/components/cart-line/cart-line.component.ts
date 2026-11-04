import { CurrencyPipe } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { initialsOf } from '@shared/utils/initials';
import { CART_PAGE_TEXTS } from '../../constants/cart-page.constants';
import type { CartRow } from '../../models/cart-page.models';
import { canIncrement } from '../../rules/sell.rules';

// Un renglón de «Carrito» (HU-15): foto (o iniciales), nombre, precio c/u, −/piezas «de N»/+, subtotal
// y «Quitar». Si el stock cambió desde que se armó el carrito avisa: «Solo te quedan N de este
// producto» (el + queda deshabilitado y el − sigue funcionando) o «Agotado» (sin −/+, solo «Quitar»).
// Es solo presentación: emite `increment`, `decrement` y `remove`, y la página cambia el carrito.
@Component({
  imports: [CurrencyPipe, ButtonDirective],
  selector: 'app-cart-line',
  templateUrl: './cart-line.component.html',
})
export class CartLineComponent {
  readonly texts = CART_PAGE_TEXTS;

  readonly row = input.required<CartRow>();

  readonly increment = output<void>();
  readonly decrement = output<void>();
  readonly remove = output<void>();

  // Si la URL de la foto no carga, cae a las iniciales en vez de dejar una imagen rota.
  private readonly imageBroken = signal(false);

  readonly product = computed(() => this.row().product);
  readonly showPhoto = computed(() => !!this.product().image && !this.imageBroken());
  readonly initials = computed(() => initialsOf(this.product().name));
  // Único `Number()` sobre un monto: solo para pasarlo al pipe `currency` al mostrarlo.
  readonly unitPrice = computed(() => Number(this.product().price));
  readonly subtotal = computed(() => Number(this.row().subtotal));

  readonly soldOut = computed(() => this.row().status === 'soldOut');
  readonly over = computed(() => this.row().status === 'over');
  readonly canIncrement = computed(() => canIncrement(this.product(), this.row().units));
  // «Solo te queda 1 de este producto» / «Solo te quedan N de este producto».
  readonly overText = computed(() => {
    const available = this.row().available;
    return `${available === 1 ? this.texts.onlySingular : this.texts.onlyPlural} ${available} ${this.texts.onlySuffix}`;
  });

  onPhotoError(): void {
    this.imageBroken.set(true);
  }
}
