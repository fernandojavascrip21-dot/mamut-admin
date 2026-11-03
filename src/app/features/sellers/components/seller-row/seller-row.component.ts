import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { initialsOf } from '@shared/utils/initials';
import type { SellerSummary } from '../../interfaces/seller.models';
import { unitsLabel } from '@shared/utils/units-label';
import { SELLER_ROW_CARD_PASS_THROUGH } from './seller-row.constants';

// Fila de «Mis vendedores» (HU-09, pantalla 04): iniciales, nombre y piezas en total. Toda la
// fila es un enlace a su detalle; «Dejar» y «Retirar» llegan en HU-11 y HU-12.
@Component({
  imports: [RouterLink, Card],
  selector: 'app-seller-row',
  templateUrl: './seller-row.component.html',
})
export class SellerRowComponent {
  readonly cardPassThrough = SELLER_ROW_CARD_PASS_THROUGH;

  readonly seller = input.required<SellerSummary>();

  readonly initials = computed(() => initialsOf(this.seller().fullName));
  readonly units = computed(() => unitsLabel(this.seller().units));
}
