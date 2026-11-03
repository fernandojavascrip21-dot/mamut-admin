import { CurrencyPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { Card } from 'primeng/card';
import { initialsOf } from '@shared/utils/initials';
import type { MyStockProduct } from '../../interfaces/my-stock.models';
import { unitsLeftLabel } from '../../rules/my-stock.rules';
import { MY_STOCK_CARD_PASS_THROUGH } from './my-stock-card.constants';

// Tarjeta de un producto de «Mi stock» (HU-14): foto (o iniciales), nombre, «Me quedan N» y el
// precio del vendedor. Es solo lectura: «Vender» lo decide HU-15. `price` ya llega resuelto
// (propio o general) y sin costos, así que aquí no hay nada que ocultar.
@Component({
  imports: [CurrencyPipe, Card],
  selector: 'app-my-stock-card',
  templateUrl: './my-stock-card.component.html',
})
export class MyStockCardComponent {
  readonly cardPassThrough = MY_STOCK_CARD_PASS_THROUGH;

  readonly product = input.required<MyStockProduct>();

  // Si la URL de la foto no carga, cae a las iniciales en vez de dejar una imagen rota.
  private readonly imageBroken = signal(false);

  readonly showPhoto = computed(() => !!this.product().image && !this.imageBroken());
  readonly initials = computed(() => initialsOf(this.product().name));
  readonly unitsText = computed(() => unitsLeftLabel(this.product().units));
  // Único `Number()` sobre un monto: solo para pasarlo al pipe `currency` al mostrarlo.
  readonly price = computed(() => Number(this.product().price));

  onPhotoError(): void {
    this.imageBroken.set(true);
  }
}
