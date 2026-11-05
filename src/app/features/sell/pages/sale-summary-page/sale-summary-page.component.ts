import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { httpStatus } from '@shared/utils/http-errors';
import { unitsLabel } from '@shared/utils/units-label';
import { SaleSummaryViewComponent } from '../../components/sale-summary-view/sale-summary-view.component';
import { SALE_SUMMARY_LINKS, SALE_SUMMARY_TEXTS } from '../../constants/sale-summary-page.constants';
import { REPLAYED_QUERY_PARAM } from '../../constants/sales.constants';
import { lowStockLines } from '../../rules/sell.rules';
import type { Sale } from '../../interfaces/sale.models';
import type { SaleSummaryState } from '../../models/sale-summary-page.models';
import { SalesService } from '../../services/sales.service';

// «Venta confirmada» (/vendedor/venta/:requestId, HU-16). Siempre se lee de GET /api/sales/:requestId,
// también justo después de confirmar, para que recargar o volver atrás muestre la misma venta.
// `?repetida=1` avisa que la venta ya estaba registrada con otros renglones.
@Component({
  imports: [SaleSummaryViewComponent],
  selector: 'app-sale-summary-page',
  templateUrl: './sale-summary-page.component.html',
})
export class SaleSummaryPageComponent {
  private readonly sales = inject(SalesService);
  private readonly route = inject(ActivatedRoute);

  private readonly requestId = this.route.snapshot.paramMap.get('requestId') ?? '';

  readonly texts = SALE_SUMMARY_TEXTS;
  readonly links = SALE_SUMMARY_LINKS;
  readonly replayed = this.route.snapshot.queryParamMap.get(REPLAYED_QUERY_PARAM) === '1';

  readonly saleResource = rxResource({ stream: () => this.sales.get(this.requestId) });
  // Una llave que no existe responde 404 y una que no es UUID responde 422: ambas son «no encontrada».
  readonly state = computed<SaleSummaryState>(() => {
    const status = this.saleResource.status();
    if (status === 'error') {
      const code = httpStatus(this.saleResource.error());
      return code === 404 || code === 422 ? 'not-found' : 'error';
    }
    return this.saleResource.hasValue() && status !== 'reloading' ? 'ready' : 'loading';
  });
  readonly sale = computed<Sale | null>(() =>
    this.saleResource.hasValue() ? this.saleResource.value().sale : null,
  );
  // Único `Number()` sobre un monto: solo para pasarlo al pipe `currency` al mostrarlo.
  readonly totalAmount = computed(() => Number(this.sale()?.total ?? 0));

  // «3 productos · 8 piezas»: de qué tamaño fue la venta, para el panel de totales.
  readonly countsLabel = computed(() => {
    const lines = this.sale()?.lines ?? [];
    const products = `${lines.length} ${lines.length === 1 ? this.texts.productSingular : this.texts.productPlural}`;
    return `${products} · ${unitsLabel(lines.reduce((sum, line) => sum + line.qty, 0))}`;
  });

  // «Se avisó al administrador que te quedan pocas piezas de: …» con los productos que quedaron
  // bajos o agotados (HU-18); null si ninguno. El administrador lo ve en «Stock general» al abrirlo.
  readonly lowStockNotice = computed(() => {
    const names = lowStockLines(this.sale()?.lines ?? []).map((line) => line.name);
    return names.length === 0 ? null : `${this.texts.lowStockPrefix} ${names.join(', ')}.`;
  });

  retry(): void {
    this.saleResource.reload();
  }
}
