import { Component } from '@angular/core';
import { Card } from 'primeng/card';
import { Skeleton } from 'primeng/skeleton';
import { SKELETON_CARD_PASS_THROUGH } from './product-card-skeleton.constants';

// Tarjeta de esqueleto del estado cargando (spec M1-hu05 §6): mismo tamaño y distribución
// que app-product-card, sin datos ni entradas; aria-hidden porque es puro relleno visual.
@Component({
  imports: [Card, Skeleton],
  selector: 'app-product-card-skeleton',
  templateUrl: './product-card-skeleton.component.html',
})
export class ProductCardSkeletonComponent {
  readonly cardPassThrough = SKELETON_CARD_PASS_THROUGH;
}
