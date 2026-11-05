import { Component } from '@angular/core';
import { SELLER_CASH_CUT_PAGE_TEXTS } from '../../constants/seller-cash-cut-page.constants';

// «Mi corte» del vendedor (HU-20), en /vendedor/mi-corte. Este paso solo monta la página;
// el periodo, «Generar corte» y los estados llegan en el paso 3 del plan.
@Component({
  imports: [],
  selector: 'app-seller-cash-cut-page',
  templateUrl: './seller-cash-cut-page.component.html',
})
export class SellerCashCutPageComponent {
  readonly texts = SELLER_CASH_CUT_PAGE_TEXTS;
}
