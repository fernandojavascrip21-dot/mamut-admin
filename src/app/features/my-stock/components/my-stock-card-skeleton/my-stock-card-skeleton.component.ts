import { Component } from '@angular/core';
import { Card } from 'primeng/card';
import { Skeleton } from 'primeng/skeleton';
import { MY_STOCK_SKELETON_PASS_THROUGH } from './my-stock-card-skeleton.constants';

// Esqueleto del estado cargando de «Mi stock»: mismo tamaño y distribución que
// `app-my-stock-card`, sin datos; aria-hidden porque es puro relleno visual.
@Component({
  imports: [Card, Skeleton],
  selector: 'app-my-stock-card-skeleton',
  templateUrl: './my-stock-card-skeleton.component.html',
})
export class MyStockCardSkeletonComponent {
  readonly cardPassThrough = MY_STOCK_SKELETON_PASS_THROUGH;
}
