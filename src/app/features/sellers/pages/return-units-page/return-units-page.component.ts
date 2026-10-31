import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ToastService } from '@core/toast/toast.service';
import { ViewingService } from '@core/viewing/viewing.service';
import { isNotFound } from '@shared/utils/http-errors';
import { unitsLabel } from '@shared/utils/units-label';
import { ReturnFormComponent } from '../../components/return-form/return-form.component';
import { RETURN_FAILURE_MESSAGES, SELLERS_LIST_URL } from '../../constants/sellers.constants';
import type {
  ReturnFormValue,
  ReturnResult,
  SellerDetail,
  SellerStockLine,
} from '../../interfaces/seller.models';
import type {
  ReturnFailureNotice,
  ReturnSaveState,
  ReturnUnitsPageState,
} from '../../models/return-units-page.models';
import { ReturnSaveService } from '../../services/return-save.service';
import { SellersService } from '../../services/sellers.service';

// «Retirar producto» (/admin/vendedores/:id/retirar, HU-12): carga al vendedor con su stock, deja
// elegir un producto de los que tiene y guarda el retiro con ReturnSaveService. Termina en el
// resumen del retiro. Sigue a la barra «Viendo» (HU-10), como el detalle del vendedor.
@Component({
  imports: [RouterLink, ReturnFormComponent],
  providers: [ReturnSaveService],
  selector: 'app-return-units-page',
  templateUrl: './return-units-page.component.html',
})
export class ReturnUnitsPageComponent {
  // --- Dependencias ---
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly viewing = inject(ViewingService);
  private readonly sellersService = inject(SellersService);
  private readonly saveService = inject(ReturnSaveService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  // Se lee de paramMap y no del snapshot porque, al elegir a otro vendedor en la barra, el router
  // podría reusar esta misma página con otro :id.
  readonly sellerId = toSignal(this.route.paramMap.pipe(map((params) => params.get('id') ?? '')), {
    initialValue: this.route.snapshot.paramMap.get('id') ?? '',
  });

  // --- Carga de datos ---
  private readonly sellerResource = rxResource({
    params: () => this.sellerId(),
    stream: ({ params: id }) => this.sellersService.get(id),
  });
  readonly seller = computed<SellerDetail | null>(() =>
    this.sellerResource.hasValue() ? this.sellerResource.value() : null,
  );
  readonly stock = computed<SellerStockLine[]>(() => this.seller()?.stock ?? []);

  // --- Estado de la pantalla ---
  private readonly saveState = signal<ReturnSaveState>('idle');
  readonly notEnoughUnits = signal(false);
  readonly failure = signal<ReturnFailureNotice | null>(null);
  private lastValue: ReturnFormValue | null = null;

  // Volver a pedir el stock tras un 409 no cuenta como «cargando»: el formulario conserva lo escrito.
  readonly state = computed<ReturnUnitsPageState>(() => {
    if (this.sellerResource.status() === 'error') {
      return isNotFound(this.sellerResource.error()) ? 'not-found' : 'error';
    }
    const seller = this.seller();
    if (!seller) return 'loading';
    return seller.stock.length === 0 ? 'empty' : 'ready';
  });
  readonly saving = computed(() => this.saveState() === 'saving');
  readonly offline = computed(() => this.saveState() === 'offline');
  readonly detailUrl = computed(() => `${SELLERS_LIST_URL}/${this.sellerId()}`);

  constructor() {
    // Una pantalla que cargó bien cuenta como elegir a ese vendedor; un 404 no cambia la barra.
    effect(() => {
      const seller = this.seller();
      if (seller) this.viewing.select(seller.id);
    });

    // Solo lo que el administrador elige en la barra navega (no el select() de arriba), para que
    // página y barra no se persigan en bucle.
    this.viewing.picked.pipe(takeUntilDestroyed()).subscribe((sellerId) => {
      void this.router.navigateByUrl(sellerId === null ? SELLERS_LIST_URL : `${SELLERS_LIST_URL}/${sellerId}`);
    });
  }

  // Botón «Reintentar» del error de carga.
  retryLoad(): void {
    this.sellerResource.reload();
  }

  // --- Guardado ---
  // Ignora un segundo envío mientras el primero sigue en curso. takeUntilDestroyed evita tocar el
  // estado si el usuario ya salió de la pantalla.
  save(value: ReturnFormValue): void {
    if (this.saveState() === 'saving') return;
    this.lastValue = value;
    this.notEnoughUnits.set(false);
    this.failure.set(null);
    this.saveState.set('saving');
    this.saveService
      .create(this.sellerId(), value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.showResult(result));
  }

  // Botón «Reintentar» del aviso sin conexión: reenvía lo mismo con el mismo requestId.
  retrySave(): void {
    if (this.lastValue) this.save(this.lastValue);
  }

  private showResult(result: ReturnResult): void {
    if (result.ok) {
      const { sellerReturn } = result;
      this.saveState.set('idle');
      this.toastService.success(
        `Le retiraste ${unitsLabel(sellerReturn.qty)} a ${sellerReturn.seller.fullName}`,
      );
      // replaceUrl: «Atrás» desde el resumen no debe reabrir un formulario ya enviado.
      void this.router.navigate(
        [SELLERS_LIST_URL, this.sellerId(), 'retiros', sellerReturn.requestId],
        { replaceUrl: true },
      );
      return;
    }
    const message =
      result.reason === 'invalid' && result.message
        ? result.message
        : RETURN_FAILURE_MESSAGES[result.reason];
    this.toastService.error(message);
    this.notEnoughUnits.set(result.reason === 'not-enough-units');
    // El saldo cambió en otra sesión: se vuelve a pedir el stock para validar contra lo real.
    if (result.reason === 'not-enough-units') this.sellerResource.reload();
    // Otros datos para el mismo requestId, un 404 o un 422 no se arreglan reintentando.
    const fixedNotice =
      result.reason === 'mismatch' || result.reason === 'not-found' || result.reason === 'invalid';
    this.failure.set(fixedNotice ? { reason: result.reason, message } : null);
    this.saveState.set(result.reason === 'offline' ? 'offline' : 'idle');
  }
}
