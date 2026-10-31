import { Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ViewingService } from '@core/viewing/viewing.service';
import { initialsOf } from '@shared/utils/initials';
import { isNotFound } from '@shared/utils/http-errors';
import { unitsLabel } from '@shared/utils/units-label';
import { SELLERS_LIST_URL } from '../../constants/sellers.constants';
import type { SellerReturn } from '../../interfaces/seller.models';
import type { ReturnSummaryPageState } from '../../models/return-summary-page.models';
import { SellerReturnsService } from '../../services/seller-returns.service';

// Resumen de un retiro (/admin/vendedores/:id/retiros/:requestId, HU-12): producto, piezas y los
// saldos de cada lado. Sale del backend y no de un estado de navegación, así que se ve igual al
// recargar. Sigue a la barra «Viendo» (HU-10), como el detalle del vendedor.
@Component({
  imports: [RouterLink],
  selector: 'app-return-summary-page',
  templateUrl: './return-summary-page.component.html',
})
export class ReturnSummaryPageComponent {
  // --- Dependencias ---
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly viewing = inject(ViewingService);
  private readonly returnsService = inject(SellerReturnsService);

  // --- Parámetros de la URL ---
  readonly sellerId = toSignal(this.route.paramMap.pipe(map((params) => params.get('id') ?? '')), {
    initialValue: this.route.snapshot.paramMap.get('id') ?? '',
  });
  private readonly requestId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('requestId') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('requestId') ?? '' },
  );

  // --- Carga de datos ---
  private readonly returnResource = rxResource({
    params: () => ({ sellerId: this.sellerId(), requestId: this.requestId() }),
    stream: ({ params }) => this.returnsService.get(params.sellerId, params.requestId),
  });
  readonly sellerReturn = computed<SellerReturn | null>(() =>
    this.returnResource.hasValue() ? this.returnResource.value() : null,
  );
  readonly state = computed<ReturnSummaryPageState>(() => {
    if (this.returnResource.status() === 'error') {
      return isNotFound(this.returnResource.error()) ? 'not-found' : 'error';
    }
    return this.sellerReturn() ? 'ready' : 'loading';
  });

  readonly units = computed(() => unitsLabel(this.sellerReturn()?.qty ?? 0));
  readonly initials = computed(() => initialsOf(this.sellerReturn()?.product.name ?? ''));
  readonly imageBroken = signal(false);

  readonly detailUrl = computed(() => `${SELLERS_LIST_URL}/${this.sellerId()}`);
  readonly anotherUrl = computed(() => `${SELLERS_LIST_URL}/${this.sellerId()}/retirar`);

  constructor() {
    // Un resumen que cargó bien cuenta como elegir a ese vendedor; un 404 no cambia la barra.
    effect(() => {
      const sellerReturn = this.sellerReturn();
      if (sellerReturn) this.viewing.select(sellerReturn.seller.id);
    });

    // Solo lo que el administrador elige en la barra navega (no el select() de arriba).
    this.viewing.picked.pipe(takeUntilDestroyed()).subscribe((sellerId) => {
      void this.router.navigateByUrl(sellerId === null ? SELLERS_LIST_URL : `${SELLERS_LIST_URL}/${sellerId}`);
    });
  }

  // Botón «Reintentar» del error de carga.
  retry(): void {
    this.returnResource.reload();
  }
}
