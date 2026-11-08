import { ButtonDirective } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { CurrencyPipe } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ProductSummary } from '../../interfaces/product.models';
import { deliveryModalLink } from '@shared/utils/modal-links';
import { STOCK_LEVEL_LABELS, type StockLevel } from '@shared/constants/stock-level.constants';
import { initialsOf } from '@shared/utils/initials';
import {
  PRODUCT_CARD_COST_TEXT,
  PRODUCT_CARD_FRACTION_TAGS,
  PRODUCT_CARD_PASS_THROUGH,
  PRODUCT_CARD_SELL_TEXTS,
} from './product-card.constants';

// Tarjeta horizontal de la pantalla 03 (spec M1-hu05 §6): foto o inicial con las etiquetas
// "Agotado"/"Baja existencia" y, si es bolsita o fraccionable, "Fraccionado"/"Se fracciona" encima,
// nombre, «Cantidad N» y precio (y el costo de la bolsita con «Yo · bodega»). La parte de arriba abre la
// edición y, si hay piezas en la bodega, una acción aparte abre «Dejar a vendedor» (HU-11); son
// dos enlaces hermanos porque un enlace no puede ir dentro de otro. «Agregar» (HU-17) agrega 1 pieza
// al carrito del titular de «Viendo» y se vuelve − N + con tope en las piezas de ese titular; la
// tarjeta solo presenta y emite, la página decide qué cambio pedirle al carrito.
@Component({
  imports: [CurrencyPipe, RouterLink, ButtonDirective, Card, Tag],
  selector: 'app-product-card',
  templateUrl: './product-card.component.html',
})
export class ProductCardComponent {
  readonly cardPassThrough = PRODUCT_CARD_PASS_THROUGH;

  readonly product = input.required<ProductSummary>();
  readonly sellerId = input<string | null>(null); // vendedor en «Viendo»: la ventana lo deja fijo
  readonly texts = PRODUCT_CARD_SELL_TEXTS;
  readonly levelLabels = STOCK_LEVEL_LABELS;
  readonly fractionTags = PRODUCT_CARD_FRACTION_TAGS;
  readonly costText = PRODUCT_CARD_COST_TEXT;

  // Existencia del titular de «Viendo» según su catálogo (HU-18). null = sin catálogo todavía: se
  // conserva la regla de HU-05 (sin piezas en la bodega → «Agotado») y no sale «Baja existencia».
  readonly stockLevel = input<StockLevel | null>(null);

  // Piezas que el titular de «Viendo» puede vender de este producto; null si no hay catálogo
  // (cargando, error o un vendedor que nunca lo tuvo). Con 0 y fuera del carrito no se ofrece «Agregar».
  readonly sellUnits = input<number | null>(null);
  // Piezas de este producto en el carrito de ese mismo titular.
  readonly unitsInCart = input(0);
  // Primer nombre del vendedor en «Viendo» («Luis»); null con «Yo · bodega».
  readonly holderLabel = input<string | null>(null);

  readonly sellAdd = output<void>();
  readonly sellIncrement = output<void>();
  readonly sellDecrement = output<void>();


  // Si la URL de la foto no carga, cae a la inicial en vez de dejar una imagen rota (§2).
  private readonly imageBroken = signal(false);

  readonly showPhoto = computed(() => this.product().image !== '' && !this.imageBroken());
  readonly initial = computed(() => initialsOf(this.product().name));
  readonly level = computed<StockLevel>(() => this.stockLevel() ?? (this.product().stock <= 0 ? 'out' : 'ok'));
  readonly price = computed(() => Number(this.product().price));
  // Bolsita (HU-24): lleva «Fraccionado» en vez de «Se fracciona». `?? null` cubre los productos sin el
  // campo (specs previos): undefined no es una bolsita.
  readonly isPortion = computed(() => (this.product().parentProductId ?? null) !== null);
  // Costo de fábrica de la bolsita solo con «Yo · bodega»: con un vendedor la tarjeta es de su stock y no
  // muestra costos (spec M5-hu24 §2).
  readonly showPortionCost = computed(() =>
    (this.product().portionUnitCost ?? null) !== null && this.holderLabel() === null,
  );

  // Solo se puede dejar lo que hay en la bodega, y solo con «Yo · bodega»: con un vendedor en «Viendo»
  // la tarjeta es de su stock y el pie queda para vender.
  readonly canDeliver = computed(() => this.holderLabel() === null && this.product().stock > 0);
  readonly inCart = computed(() => this.unitsInCart() > 0);
  readonly canSell = computed(() => this.inCart() || (this.sellUnits() ?? 0) > 0);
  // El «+» se deshabilita en el tope: las piezas del titular.
  readonly canIncrement = computed(() => this.unitsInCart() < (this.sellUnits() ?? 0));
  readonly showFooter = computed(() => this.canDeliver() || this.canSell());
  readonly deliveryLink = computed(() => deliveryModalLink({
    productId: this.product().id,
    sellerId: this.sellerId() ?? undefined,
  }));

  onPhotoError(): void {
    this.imageBroken.set(true);
  }
}
