import { CurrencyPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { initialsOf } from '@shared/utils/initials';
import { unitsLabel } from '@shared/utils/units-label';
import { DELIVERY_NEW_URL } from '../../constants/deliveries.constants';
import type { Delivery } from '../../interfaces/delivery.models';
import {
  effectiveCost,
  effectivePrice,
  isBelowCost,
  profitPerUnit,
} from '../../rules/delivery.rules';

// Resumen de una entrega ya registrada (HU-11): qué producto, cuántas piezas, cómo quedaron la
// bodega y el vendedor, y con qué precio y costo. Presentacional: los enlaces de «Listo» y «Dejar
// otro producto» los arma la página.
@Component({
  imports: [CurrencyPipe, RouterLink],
  selector: 'app-delivery-summary',
  templateUrl: './delivery-summary.component.html',
})
export class DeliverySummaryComponent {
  readonly delivery = input.required<Delivery>();
  readonly doneUrl = input.required<string>();
  readonly anotherQueryParams = input.required<Record<string, string>>();

  readonly newDeliveryUrl = DELIVERY_NEW_URL;
  readonly units = computed(() => unitsLabel(this.delivery().qty));
  readonly initials = computed(() => initialsOf(this.delivery().product.name));
  readonly imageBroken = signal(false);

  // Precio y costo que aplican a las piezas del vendedor, con la marca de si son propios.
  readonly price = computed(() =>
    effectivePrice(this.delivery().product.price, this.delivery().unitPrice),
  );
  readonly cost = computed(() =>
    effectiveCost(this.delivery().product.unitCost, this.delivery().unitCostWithShipping),
  );
  readonly hasOwnPrice = computed(() => this.delivery().unitPrice !== null);
  readonly hasOwnCost = computed(() => this.delivery().unitCostWithShipping !== null);
  readonly profit = computed(() => Number(profitPerUnit(this.price(), this.cost())));
  readonly belowCost = computed(() => isBelowCost(this.price(), this.cost()));
}
