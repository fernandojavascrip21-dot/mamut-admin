import { Component } from '@angular/core';
import { Card } from 'primeng/card';
import { Skeleton } from 'primeng/skeleton';
import { SELL_SKELETON_PASS_THROUGH } from './sell-product-card-skeleton.constants';

// Esqueleto del estado cargando de «Vender» y «Carrito»: mismo tamaño y distribución que
// `app-sell-product-card`, sin datos; aria-hidden porque es puro relleno visual.
@Component({
  imports: [Card, Skeleton],
  selector: 'app-sell-product-card-skeleton',
  templateUrl: './sell-product-card-skeleton.component.html',
})
export class SellProductCardSkeletonComponent {
  readonly cardPassThrough = SELL_SKELETON_PASS_THROUGH;
}
