import { Component } from '@angular/core';
import { Card } from 'primeng/card';
import { Skeleton } from 'primeng/skeleton';
import { SELLER_ROW_SKELETON_PASS_THROUGH } from './seller-row-skeleton.constants';

// Esqueleto de una fila de «Mis vendedores» mientras carga la lista (HU-09, criterio 5).
@Component({
  imports: [Card, Skeleton],
  selector: 'app-seller-row-skeleton',
  templateUrl: './seller-row-skeleton.component.html',
})
export class SellerRowSkeletonComponent {
  readonly cardPassThrough = SELLER_ROW_SKELETON_PASS_THROUGH;
}
