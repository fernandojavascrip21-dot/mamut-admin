import { Component, DestroyRef, computed, inject, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, catchError, filter, from, map, of, startWith, switchMap, tap } from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { SelectButton } from 'primeng/selectbutton';
import { Skeleton } from 'primeng/skeleton';
import { ConfirmService } from '@core/confirm/confirm.service';
import { StockChangesService } from '@core/stock-changes/stock-changes.service';
import { ToastService } from '@core/toast/toast.service';
import { httpErrorCode, httpErrorMessage, httpStatus } from '@shared/utils/http-errors';
import { receiptModalLink } from '@shared/utils/modal-links';
import { NewProductDialogComponent } from '../../components/new-product-dialog/new-product-dialog.component';
import { PendingCostChangeCardComponent } from '../../components/pending-cost-change-card/pending-cost-change-card.component';
import { PendingNewProductCardComponent } from '../../components/pending-new-product-card/pending-new-product-card.component';
import type {
  CreateProductFromLinePayload, CreateProductFromLineResult, PendingCostChange, PendingNewProduct, ReceiptCategory,
} from '../../interfaces/receipt.models';
import type { PendingLoad, PendingTab, PendingTabOption } from '../../models/receipt-pending-page.models';
import { initialPendingTab } from '../../rules/receipt-pending.rules';
import { ReceiptsService } from '../../services/receipts.service';
import { RECEIPT_PENDING_PAGE_TEXTS, RECEIPT_PENDING_SKELETON_ROWS } from './receipt-pending-page.constants';

// «Pendientes de remisiones» (HU-42 §3): los productos nuevos que esperan alta y los cambios de costo que
// esperan decisión. Cada acción quita su tarjeta sin recargar todo; si el pendiente ya no existe (409/404),
// avisa y vuelve a pedir la lista. Dar de alta es un pop-up; descartar y aceptar piden confirmación.
@Component({
  imports: [
    ButtonDirective, FormsModule, NewProductDialogComponent, PendingCostChangeCardComponent,
    PendingNewProductCardComponent, SelectButton, Skeleton,
  ],
  selector: 'app-receipt-pending-page',
  templateUrl: './receipt-pending-page.component.html',
})
export class ReceiptPendingPageComponent {
  // --- Dependencias ---
  private readonly router = inject(Router);
  private readonly receipts = inject(ReceiptsService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly stockChanges = inject(StockChangesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly texts = RECEIPT_PENDING_PAGE_TEXTS;
  readonly skeletonRows = RECEIPT_PENDING_SKELETON_ROWS;

  // --- Carga ---
  // Se usa toSignal y no rxResource: un resource en carga registra una tarea pendiente y bloquea whenStable
  // hasta que llega la respuesta, así que «Reintentar» no podría esperar a su propia petición. Cada recarga
  // pasa por `loadRequests`; mientras llega la respuesta el estado es «loading» (esqueletos).
  private readonly loadRequests = new Subject<void>();
  readonly load = toSignal<PendingLoad, PendingLoad>(
    this.loadRequests.pipe(
      startWith(undefined),
      switchMap(() =>
        this.receipts.getPending().pipe(
          map((value): PendingLoad => ({ status: 'ready', value })),
          startWith<PendingLoad>({ status: 'loading' }),
          catchError(() => of<PendingLoad>({ status: 'error' })),
        ),
      ),
    ),
    { initialValue: { status: 'loading' } },
  );
  readonly loadStatus = computed(() => this.load().status);
  readonly pendingLines = computed(() => {
    const current = this.load();
    return current.status === 'ready' ? current.value : undefined;
  });
  // Copias de la lista del servidor que se van quitando al resolver; cada carga nueva las reemplaza.
  readonly newProducts = linkedSignal<PendingNewProduct[]>(() => this.pendingLines()?.newProducts ?? []);
  readonly costChanges = linkedSignal<PendingCostChange[]>(() => this.pendingLines()?.costChanges ?? []);
  // Cada carga vuelve a decidir el apartado de entrada; elegir uno lo mantiene hasta la siguiente carga.
  readonly activeTab = linkedSignal<PendingTab>(() => initialPendingTab(this.pendingLines()));
  readonly tabOptions = computed<PendingTabOption[]>(() => [
    { label: `${this.texts.newTab} (${this.newProducts().length})`, value: 'new' },
    { label: `${this.texts.costTab} (${this.costChanges().length})`, value: 'cost' },
  ]);

  // --- Acciones en curso ---
  // Un solo envío por tarjeta: mientras una acción corre, las de la misma tarjeta quedan deshabilitadas.
  readonly busyLineId = signal<number | null>(null);
  // Tras un COST_ABOVE_PRICE la tarjeta ofrece «Editar producto».
  readonly editLinkLineId = signal<number | null>(null);

  // --- Pop-up de alta ---
  readonly creating = signal<PendingNewProduct | null>(null);
  readonly categories = signal<ReceiptCategory[]>([]);
  readonly saving = signal(false);
  readonly nameError = signal<string | null>(null);
  readonly formError = signal<string | null>(null);

  reload(): void {
    this.loadRequests.next();
  }

  // «Cargar remisión» abre el pop-up de la bodega sobre esta página.
  openUpload(): void {
    void this.router.navigate(receiptModalLink());
  }

  // --- Productos nuevos ---
  // Abre el alta con el nombre y el costo leídos; las categorías se piden al abrir.
  openCreate(item: PendingNewProduct): void {
    this.nameError.set(null);
    this.formError.set(null);
    this.saving.set(false);
    this.creating.set(item);
    this.receipts
      .getCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => this.categories.set(categories),
        error: () => this.toast.error(this.texts.categoriesFailed),
      });
  }

  closeCreate(): void {
    this.creating.set(null);
  }

  saveProduct(payload: CreateProductFromLinePayload): void {
    const item = this.creating();
    if (item === null || this.saving()) return;
    this.saving.set(true);
    this.nameError.set(null);
    this.formError.set(null);
    this.receipts
      .createProduct(item.lineId, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => this.onProductCreated(item, result),
        error: (error: unknown) => this.onCreateFailed(error),
      });
  }

  private onProductCreated(item: PendingNewProduct, result: CreateProductFromLineResult): void {
    this.saving.set(false);
    this.creating.set(null);
    this.newProducts.update((list) => list.filter((pending) => pending.lineId !== item.lineId));
    this.stockChanges.notify();
    this.toast.success(this.texts.created(result.product.name, result.stock.before, result.stock.after));
  }

  // 409 de nombre repetido: el campo nombre. 422: arriba del formulario. 409/404: el pendiente ya no está,
  // así que el pop-up se cierra y la lista se vuelve a pedir.
  private onCreateFailed(error: unknown): void {
    this.saving.set(false);
    const message = httpErrorMessage(error);
    if (httpErrorCode(error) === 'DUPLICATE_NAME') {
      this.nameError.set(message ?? this.texts.createFailed);
      return;
    }
    if (this.isStale(error)) {
      this.creating.set(null);
      this.onResolveFailed(error, this.texts.createFailed);
      return;
    }
    this.formError.set(message ?? this.texts.createFailed);
  }

  discard(item: PendingNewProduct): void {
    if (this.busyLineId() !== null) return;
    from(this.confirm.ask({
      title: this.texts.discardTitle,
      message: this.texts.discardMessage(item.suggestedName, item.qty),
      confirmLabel: this.texts.discardConfirm,
      cancelLabel: this.texts.cancel,
      tone: 'danger',
    }))
      .pipe(
        filter((accepted) => accepted),
        tap(() => this.busyLineId.set(item.lineId)),
        switchMap(() => this.receipts.discard(item.lineId)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.busyLineId.set(null);
          this.newProducts.update((list) => list.filter((pending) => pending.lineId !== item.lineId));
          this.toast.success(this.texts.discarded);
        },
        error: (error: unknown) => this.onResolveFailed(error, this.texts.discardFailed),
      });
  }

  // --- Cambios de costo ---
  acceptCost(item: PendingCostChange): void {
    if (this.busyLineId() !== null || !item.product.active) return;
    from(this.confirm.ask({
      title: this.texts.acceptTitle,
      message: this.texts.acceptMessage(item.product.name, item.newUnitCost),
      confirmLabel: this.texts.acceptConfirm,
      cancelLabel: this.texts.cancel,
      tone: 'default',
    }))
      .pipe(
        filter((accepted) => accepted),
        tap(() => this.busyLineId.set(item.lineId)),
        switchMap(() => this.receipts.acceptCost(item.lineId)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.busyLineId.set(null);
          this.removeCostChange(item.lineId);
          this.toast.success(this.texts.accepted);
        },
        error: (error: unknown) => this.onCostFailed(item, error, this.texts.acceptFailed),
      });
  }

  rejectCost(item: PendingCostChange): void {
    if (this.busyLineId() !== null) return;
    this.busyLineId.set(item.lineId);
    this.receipts
      .rejectCost(item.lineId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busyLineId.set(null);
          this.removeCostChange(item.lineId);
          this.toast.success(this.texts.rejected);
        },
        error: (error: unknown) => this.onCostFailed(item, error, this.texts.rejectFailed),
      });
  }

  // COST_ABOVE_PRICE: el costo supera el precio; la tarjeta enlaza a editar el producto y la lista no se recarga.
  private onCostFailed(item: PendingCostChange, error: unknown, fallback: string): void {
    if (httpErrorCode(error) === 'COST_ABOVE_PRICE') {
      this.busyLineId.set(null);
      this.editLinkLineId.set(item.lineId);
      this.toast.error(httpErrorMessage(error) ?? fallback);
      return;
    }
    this.onResolveFailed(error, fallback);
  }

  private removeCostChange(lineId: number): void {
    this.costChanges.update((list) => list.filter((pending) => pending.lineId !== lineId));
  }

  // --- Errores comunes ---
  // Un pendiente ya resuelto (409) o inexistente (404) avisa y la lista se vuelve a pedir.
  private onResolveFailed(error: unknown, fallback: string): void {
    this.busyLineId.set(null);
    this.toast.error(httpErrorMessage(error) ?? fallback);
    if (this.isStale(error)) this.reload();
  }

  private isStale(error: unknown): boolean {
    const status = httpStatus(error);
    return status === 404 || status === 409;
  }
}
