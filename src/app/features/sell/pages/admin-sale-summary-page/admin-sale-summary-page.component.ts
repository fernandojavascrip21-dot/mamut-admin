import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { httpStatus } from '@shared/utils/http-errors';
import { AdminSaleLineComponent } from '../../components/admin-sale-line/admin-sale-line.component';
import { SellProductCardSkeletonComponent } from '../../components/sell-product-card-skeleton/sell-product-card-skeleton.component';
import {
  ADMIN_SALE_SUMMARY_LINKS,
  ADMIN_SALE_SUMMARY_TEXTS,
} from '../../constants/admin-sale-summary-page.constants';
import { REPLAYED_QUERY_PARAM } from '../../constants/sales.constants';
import type { AdminSale } from '../../interfaces/sale.models';
import type { SaleSummaryState } from '../../models/sale-summary-page.models';
import { SalesService } from '../../services/sales.service';

// «Venta confirmada» del administrador (/admin/venta/:requestId, HU-17). Siempre se lee de
// GET /api/sales/:requestId, también justo después de confirmar, así que recargar o volver atrás
// muestra la misma venta. El administrador recibe además costo y ganancia por renglón y de la venta.
// `?repetida=1` avisa que la venta ya estaba registrada con otros renglones.
@Component({
  imports: [
    CurrencyPipe,
    DatePipe,
    RouterLink,
    ButtonDirective,
    AdminSaleLineComponent,
    SellProductCardSkeletonComponent,
  ],
  selector: 'app-admin-sale-summary-page',
  templateUrl: './admin-sale-summary-page.component.html',
})
export class AdminSaleSummaryPageComponent {
  private readonly sales = inject(SalesService);
  private readonly route = inject(ActivatedRoute);

  private readonly requestId = this.route.snapshot.paramMap.get('requestId') ?? '';

  readonly texts = ADMIN_SALE_SUMMARY_TEXTS;
  readonly links = ADMIN_SALE_SUMMARY_LINKS;
  readonly replayed = this.route.snapshot.queryParamMap.get(REPLAYED_QUERY_PARAM) === '1';

  readonly saleResource = rxResource({ stream: () => this.sales.get<AdminSale>(this.requestId) });
  // Una llave que no existe responde 404 y una que no es UUID responde 422: ambas son «no encontrada».
  readonly state = computed<SaleSummaryState>(() => {
    const status = this.saleResource.status();
    if (status === 'error') {
      const code = httpStatus(this.saleResource.error());
      return code === 404 || code === 422 ? 'not-found' : 'error';
    }
    return this.saleResource.hasValue() && status !== 'reloading' ? 'ready' : 'loading';
  });
  readonly sale = computed<AdminSale | null>(() =>
    this.saleResource.hasValue() ? this.saleResource.value().sale : null,
  );
  // De quién era el stock: «Bodega» o el vendedor (nombre completo arriba, primer nombre en cada renglón).
  readonly holderName = computed(() => this.sale()?.holder?.fullName ?? this.texts.warehouse);
  readonly holderLabel = computed(() => this.sale()?.holder?.fullName.split(' ')[0] ?? this.texts.warehouse);
  // Único `Number()` sobre un monto: solo para pasarlo al pipe `currency` al mostrarlo.
  readonly totalAmount = computed(() => Number(this.sale()?.total ?? 0));
  readonly profitAmount = computed(() => Number(this.sale()?.profit ?? 0));

  retry(): void {
    this.saleResource.reload();
  }
}
