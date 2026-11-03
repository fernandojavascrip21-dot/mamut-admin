import { Component } from '@angular/core';
import { Card } from 'primeng/card';
import { Skeleton } from 'primeng/skeleton';
import { STOCK_PRODUCT_ROW_SKELETON_PASS_THROUGH } from './stock-product-row-skeleton.constants';

// Esqueleto de una fila de «Stock general» mientras carga (HU-13).
@Component({
  imports: [Card, Skeleton],
  selector: 'app-stock-product-row-skeleton',
  templateUrl: './stock-product-row-skeleton.component.html',
})
export class StockProductRowSkeletonComponent {
  readonly cardPassThrough = STOCK_PRODUCT_ROW_SKELETON_PASS_THROUGH;
}
