import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { StockChangesService } from '@core/stock-changes/stock-changes.service';
import { ToastService } from '@core/toast/toast.service';
import { ModalPanelComponent } from '@shared/components/modal-panel/modal-panel.component';
import { closeModalLink } from '@shared/utils/modal-links';
import { newUuid } from '@shared/utils/uuid';
import { PurchaseFormComponent } from '../../components/purchase-form/purchase-form.component';
import type { PurchaseFormSubmit, PurchaseServerErrors } from '../../components/purchase-form/purchase-form.models';
import { PurchaseResultComponent } from '../../components/purchase-result/purchase-result.component';
import { PURCHASE_PAGE_TEXTS } from '../../constants/purchase-page.constants';
import type { CreatePurchasePayload, PurchaseProduct, PurchaseResult } from '../../interfaces/purchase.models';
import type { PurchasePageState } from '../../models/purchase-page.models';
import { PurchaseService } from '../../services/purchase.service';

// «Entrada a bodega» (HU-27), en un pop-up sobre la página actual (ruta `entrada` del outlet
// `ventana`). Elige un producto activo, manda las piezas con un requestId por intento y muestra el
// resultado. El requestId se conserva si el envío falla (para que reintentar no registre dos entradas)
// y se renueva solo con «Registrar otra». No pide confirmación: sumar piezas no es destructivo.
@Component({
  imports: [ButtonDirective, Skeleton, ModalPanelComponent, PurchaseFormComponent, PurchaseResultComponent],
  selector: 'app-purchase-page',
  templateUrl: './purchase-page.component.html',
})
export class PurchasePageComponent {
  // --- Dependencias ---
  private readonly router = inject(Router);
  private readonly purchaseService = inject(PurchaseService);
  private readonly toast = inject(ToastService);
  private readonly stockChanges = inject(StockChangesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly texts = PURCHASE_PAGE_TEXTS;

  // --- Carga de productos ---
  readonly productsResource = rxResource({
    stream: () => this.purchaseService.getProducts(),
  });
  // value() lanza en estado de error: se lee solo cuando hay un valor.
  readonly products = computed<PurchaseProduct[] | null>(() =>
    this.productsResource.hasValue() ? this.productsResource.value() : null,
  );

  // --- Estados del envío ---
  readonly saving = signal(false);
  readonly serverErrors = signal<PurchaseServerErrors>({});
  readonly notice = signal<string | null>(null);
  readonly offline = signal(false);
  readonly outcome = signal<Extract<PurchaseResult, { ok: true }> | null>(null);
  readonly state = computed<PurchasePageState>(() => {
    if (this.productsResource.status() === 'error' && !this.productsResource.hasValue()) return 'error';
    if (this.outcome()) return 'result';
    const loaded = this.products();
    if (!loaded) return 'loading';
    return loaded.length === 0 ? 'empty' : 'form';
  });
  // Un requestId por intento: se renueva solo con «Registrar otra».
  private requestId = newUuid();
  private lastSubmit: PurchaseFormSubmit | null = null;

  // --- Envío ---
  onSubmitted(value: PurchaseFormSubmit): void {
    if (this.saving()) return; // sin segundo envío mientras el primero está en curso
    this.lastSubmit = value;
    this.send(value);
  }

  // «Reintentar» del aviso sin conexión: reenvía lo mismo con el mismo requestId.
  retry(): void {
    if (!this.lastSubmit || this.saving()) return;
    this.send(this.lastSubmit);
  }

  // Marca el envío en curso, arma el payload y manda; un solo subscribe ligado a la vida de la página.
  private send(value: PurchaseFormSubmit): void {
    this.saving.set(true);
    this.serverErrors.set({});
    this.notice.set(null);
    this.offline.set(false);
    const payload: CreatePurchasePayload = { requestId: this.requestId, ...value };
    this.purchaseService
      .create(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.onResult(result));
  }

  // Cada motivo de error decide dónde se pinta y si hay que recargar los productos.
  private onResult(result: PurchaseResult): void {
    this.saving.set(false);
    if (result.ok) {
      this.outcome.set(result);
      this.toast.success(this.texts.saved);
      this.stockChanges.notify(); // «Stock general» de atrás vuelve a pedir sus piezas
      return;
    }
    switch (result.reason) {
      case 'not-found':
        this.notice.set(result.message ?? this.texts.saveFailed);
        this.productsResource.reload();
        break;
      case 'conflict':
        this.notice.set(result.message ?? this.texts.saveFailed);
        break;
      case 'offline':
        this.offline.set(true);
        break;
    }
  }

  // «Registrar otra»: formulario vacío, requestId nuevo (es otra entrada) y productos al día.
  onAgain(): void {
    this.outcome.set(null);
    this.requestId = newUuid();
    this.lastSubmit = null;
    this.serverErrors.set({});
    this.notice.set(null);
    this.offline.set(false);
    this.productsResource.reload();
  }

  // X, Escape, «Cerrar» y «Cancelar» cierran el pop-up. Mientras guarda no se puede cerrar.
  close(): void {
    if (this.saving()) return;
    void this.router.navigate(closeModalLink());
  }
}
