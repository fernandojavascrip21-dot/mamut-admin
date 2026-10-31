import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { isNotFound } from '@shared/utils/http-errors';
import { DeliverySummaryComponent } from '../../components/delivery-summary/delivery-summary.component';
import { PRODUCTS_URL } from '../../constants/deliveries.constants';
import type { Delivery } from '../../interfaces/delivery.models';
import type { DeliverySummaryState } from '../../models/delivery-summary-page.models';
import { parseReturnTarget, returnUrl } from '../../rules/delivery.rules';
import { DeliveriesService } from '../../services/deliveries.service';

// Resumen de una entrega (/admin/entregas/:requestId, HU-11). Sale de GET /api/deliveries/:requestId
// y no de un estado de navegación, para que sobreviva a una recarga y se pueda abrir desde
// «Últimas entregas» del detalle del vendedor.
@Component({
  imports: [RouterLink, DeliverySummaryComponent],
  selector: 'app-delivery-summary-page',
  templateUrl: './delivery-summary-page.component.html',
})
export class DeliverySummaryPageComponent {
  private readonly deliveries = inject(DeliveriesService);
  private readonly route = inject(ActivatedRoute);

  private readonly requestId = this.route.snapshot.paramMap.get('requestId') ?? '';
  private readonly returnTarget = parseReturnTarget(
    this.route.snapshot.queryParamMap.get('volver'),
  );

  readonly productsUrl = PRODUCTS_URL;
  readonly deliveryResource = rxResource({ stream: () => this.deliveries.get(this.requestId) });
  readonly state = computed<DeliverySummaryState>(() => {
    const status = this.deliveryResource.status();
    if (status === 'error')
      return isNotFound(this.deliveryResource.error()) ? 'not-found' : 'error';
    return this.deliveryResource.hasValue() && status !== 'reloading' ? 'ready' : 'loading';
  });
  readonly delivery = computed<Delivery | null>(() =>
    this.deliveryResource.hasValue() ? this.deliveryResource.value() : null,
  );
  readonly doneUrl = computed(() =>
    returnUrl(this.returnTarget, this.delivery()?.seller.id ?? null),
  );
  readonly anotherQueryParams = computed<Record<string, string>>(() => {
    const params: Record<string, string> = { volver: this.returnTarget };
    const sellerId = this.delivery()?.seller.id;
    if (sellerId) params['vendedor'] = sellerId;
    return params;
  });

  // Botón «Reintentar» del error de carga.
  retry(): void {
    this.deliveryResource.reload();
  }
}
