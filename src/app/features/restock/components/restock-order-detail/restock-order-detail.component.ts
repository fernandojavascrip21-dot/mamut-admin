import { Component, input } from '@angular/core';
import type { RestockOrder } from '../../interfaces/restock.models';

@Component({
  imports: [],
  selector: 'app-restock-order-detail',
  templateUrl: './restock-order-detail.component.html',
})
export class RestockOrderDetailComponent {
  readonly order = input.required<RestockOrder>();
}
