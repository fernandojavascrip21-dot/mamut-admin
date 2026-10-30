import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { initialsOf } from '@shared/utils/initials';
import type { SellerSummary } from '../../interfaces/seller.models';
import { unitsLabel } from '../../rules/seller.rules';

// Fila de «Mis vendedores» (HU-09, pantalla 04): iniciales, nombre y piezas en total. Toda la
// fila es un enlace a su detalle; «Dejar» y «Retirar» llegan en HU-11 y HU-12.
@Component({
  imports: [RouterLink],
  selector: 'app-seller-row',
  templateUrl: './seller-row.component.html',
})
export class SellerRowComponent {
  readonly seller = input.required<SellerSummary>();

  readonly initials = computed(() => initialsOf(this.seller().fullName));
  readonly units = computed(() => unitsLabel(this.seller().units));
}
