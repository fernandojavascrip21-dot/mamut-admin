import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, type Observable, from, switchMap } from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { ConfirmService } from '@core/confirm/confirm.service';
import { StockChangesService } from '@core/stock-changes/stock-changes.service';
import { ToastService } from '@core/toast/toast.service';
import { ViewingService } from '@core/viewing/viewing.service';
import { ModalPanelComponent } from '@shared/components/modal-panel/modal-panel.component';
import { closeModalLink } from '@shared/utils/modal-links';
import { isNotFound } from '@shared/utils/http-errors';
import { newUuid } from '@shared/utils/uuid';
import { ShrinkageFormComponent } from '../../components/shrinkage-form/shrinkage-form.component';
import type { ShrinkageFormSubmit, ShrinkageServerErrors } from '../../components/shrinkage-form/shrinkage-form.models';
import { ShrinkageResultComponent } from '../../components/shrinkage-result/shrinkage-result.component';
import { SHRINKAGE_PAGE_TEXTS } from '../../constants/shrinkage-page.constants';
import type { CreateShrinkagePayload, ShrinkageOptions, ShrinkageResult } from '../../interfaces/shrinkage.models';
import type { ShrinkagePageState } from '../../models/shrinkage-page.models';
import { shrinkageConfirmMessage } from '../../rules/shrinkage-confirm.rules';
import { ShrinkageService } from '../../services/shrinkage.service';

// «Registrar merma» (HU-25), en un pop-up sobre la página actual (ruta `merma` del outlet `ventana`).
// El titular lo fija el enlace: `vendedor` (su id) o la bodega. Pide confirmación, envía con un
// requestId por intento y muestra el resultado. El requestId se conserva si el envío falla (para que
// reintentar no registre dos mermas) y se renueva solo con «Registrar otra».
@Component({
  imports: [ButtonDirective, Skeleton, ModalPanelComponent, ShrinkageFormComponent, ShrinkageResultComponent],
  selector: 'app-shrinkage-page',
  templateUrl: './shrinkage-page.component.html',
})
export class ShrinkagePageComponent {
  // --- Dependencias ---
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly shrinkageService = inject(ShrinkageService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly stockChanges = inject(StockChangesService);
  private readonly viewing = inject(ViewingService);
  private readonly destroyRef = inject(DestroyRef);

  readonly texts = SHRINKAGE_PAGE_TEXTS;
  // Parámetro matricial `vendedor` del enlace; null = la bodega.
  private readonly sellerId = this.route.snapshot.paramMap.get('vendedor');

  // --- Carga de opciones ---
  readonly optionsResource = rxResource({
    stream: () => this.shrinkageService.getOptions(this.sellerId ?? undefined),
  });
  // value() lanza en estado de error: se lee solo cuando hay un valor (un error de carga no lo tiene).
  readonly options = computed<ShrinkageOptions | null>(() =>
    this.optionsResource.hasValue() ? this.optionsResource.value() : null,
  );
  // «De <nombre>» cuando el titular es un vendedor; «De la bodega» si el enlace no trae vendedor.
  readonly subtitle = computed(() => {
    const holder = this.options()?.holder;
    if (holder) return `De ${holder.fullName}`;
    return this.sellerId === null ? this.texts.warehouseSubtitle : null;
  });
  readonly emptyText = computed(() => {
    const holder = this.options()?.holder;
    return holder ? `${holder.fullName} ${this.texts.emptySuffix}` : this.texts.emptyWarehouse;
  });

  // --- Estados del envío ---
  readonly saving = signal(false);
  readonly serverErrors = signal<ShrinkageServerErrors>({});
  readonly notice = signal<string | null>(null);
  readonly offline = signal(false);
  readonly outcome = signal<Extract<ShrinkageResult, { ok: true }> | null>(null);
  readonly state = computed<ShrinkagePageState>(() => {
    if (this.optionsResource.status() === 'error' && !this.optionsResource.hasValue()) {
      const sellerGone = this.sellerId !== null && isNotFound(this.optionsResource.error());
      return sellerGone ? 'not-found' : 'error';
    }
    if (this.outcome()) return 'result';
    const loaded = this.options();
    if (!loaded) return 'loading';
    return loaded.products.length === 0 ? 'empty' : 'form';
  });
  // Un requestId por intento: se renueva solo con «Registrar otra».
  private requestId = newUuid();
  private lastSubmit: ShrinkageFormSubmit | null = null;
  // Entre que se pide la confirmación y se responde no se acepta otro envío.
  private confirming = false;

  constructor() {
    // Como «Retirar»: el pop-up de un vendedor deja a ese vendedor elegido en «Viendo».
    effect(() => {
      const holder = this.options()?.holder;
      if (holder) this.viewing.select(holder.id);
    });
  }

  // --- Envío ---
  // Pide la confirmación; solo si acepta se manda. Un solo subscribe: la confirmación y el POST van en
  // el mismo pipe.
  onSubmitted(value: ShrinkageFormSubmit): void {
    const loaded = this.options();
    if (!loaded || this.saving() || this.confirming) return; // sin segundo envío mientras confirma o guarda
    const product = loaded.products.find((item) => item.productId === value.productId);
    const reason = loaded.reasons.find((item) => item.code === value.reason);
    if (!product || !reason) return;
    this.lastSubmit = value;
    this.confirming = true;
    from(
      this.confirm.ask({
        title: this.texts.title,
        message: shrinkageConfirmMessage({
          qty: value.qty,
          productName: product.name,
          holder: loaded.holder,
          reasonLabel: reason.label,
        }),
        confirmLabel: this.texts.confirmLabel,
        cancelLabel: this.texts.cancel,
        tone: 'danger',
      }),
    )
      .pipe(
        switchMap((accepted) => {
          this.confirming = false;
          return accepted ? this.submit(value) : EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => this.onResult(result));
  }

  // «Reintentar» del aviso sin conexión: reenvía lo mismo con el mismo requestId, sin volver a preguntar.
  retry(): void {
    if (!this.lastSubmit || this.saving()) return;
    this.submit(this.lastSubmit)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.onResult(result));
  }

  // Marca el envío en curso y arma el payload con el titular que fijó el enlace.
  private submit(value: ShrinkageFormSubmit): Observable<ShrinkageResult> {
    this.saving.set(true);
    this.serverErrors.set({});
    this.notice.set(null);
    this.offline.set(false);
    const payload: CreateShrinkagePayload = {
      requestId: this.requestId,
      holderProfileId: this.options()?.holder?.id ?? null,
      ...value,
    };
    return this.shrinkageService.create(payload);
  }

  // Cada motivo de error decide dónde se pinta y si hay que recargar las opciones.
  private onResult(result: ShrinkageResult): void {
    this.saving.set(false);
    if (result.ok) {
      this.outcome.set(result);
      this.toast.success(this.texts.saved);
      this.stockChanges.notify(); // «Stock general» de atrás vuelve a pedir sus piezas
      return;
    }
    switch (result.reason) {
      case 'no-units':
        this.serverErrors.set({ qty: result.message ?? this.texts.noUnits });
        this.optionsResource.reload();
        break;
      case 'not-found':
        this.notice.set(result.message ?? this.texts.saveFailed);
        this.optionsResource.reload();
        break;
      case 'conflict':
        this.notice.set(result.message ?? this.texts.saveFailed);
        break;
      case 'offline':
        this.offline.set(true);
        break;
    }
  }

  // «Registrar otra»: formulario vacío, requestId nuevo (es otra merma) y opciones al día.
  onAgain(): void {
    this.outcome.set(null);
    this.requestId = newUuid();
    this.lastSubmit = null;
    this.serverErrors.set({});
    this.notice.set(null);
    this.offline.set(false);
    this.optionsResource.reload();
  }

  // X, Escape, «Cerrar» y «Cancelar» cierran el pop-up. Mientras guarda no se puede cerrar.
  close(): void {
    if (this.saving()) return;
    void this.router.navigate(closeModalLink());
  }
}
