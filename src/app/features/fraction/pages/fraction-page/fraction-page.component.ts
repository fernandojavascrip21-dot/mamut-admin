import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, rxResource } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { StockChangesService } from '@core/stock-changes/stock-changes.service';
import { ToastService } from '@core/toast/toast.service';
import { ModalPanelComponent } from '@shared/components/modal-panel/modal-panel.component';
import { closeModalLink } from '@shared/utils/modal-links';
import { newUuid } from '@shared/utils/uuid';
import { FractionFormComponent } from '../../components/fraction-form/fraction-form.component';
import type { FractionFormSubmit, FractionServerErrors } from '../../components/fraction-form/fraction-form.models';
import { FractionResultComponent } from '../../components/fraction-result/fraction-result.component';
import { FRACTION_HISTORY_LINK, FRACTION_PAGE_MESSAGES, FRACTION_PAGE_TEXTS, NO_UNITS_LABEL } from '../../constants/fraction-page.constants';
import { FractionService } from '../../services/fraction.service';
import type { FractionResult } from '../../interfaces/fraction.models';

// Página «Fraccionar» (HU-23), en un pop-up sobre la página actual (ruta `fraccionar` del outlet
// `ventana`): carga los enteros, envía el fraccionado y muestra el resultado. Un requestId por intento:
// se conserva si el envío falla (para que reintentar no fraccione dos veces) y se renueva solo con
// «Fraccionar otro».
@Component({
  imports: [RouterLink, ButtonDirective, Skeleton, ModalPanelComponent, FractionFormComponent, FractionResultComponent],
  selector: 'app-fraction-page',
  templateUrl: './fraction-page.component.html',
})
export class FractionPageComponent {
  // --- Dependencias ---
  private readonly fractionService = inject(FractionService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly stockChanges = inject(StockChangesService);
  private readonly destroyRef = inject(DestroyRef);

  // --- Carga de opciones ---
  readonly texts = FRACTION_PAGE_TEXTS;
  readonly historyLink = FRACTION_HISTORY_LINK;
  readonly optionsResource = rxResource({ stream: () => this.fractionService.getOptions() });
  readonly products = computed(() => this.optionsResource.value() ?? []);

  // --- Estados del envío ---
  // Entero elegido desde el parámetro matricial `producto`; «Fraccionar otro» lo limpia.
  readonly preselectedId = signal<number | null>(this.productFromParams());
  readonly saving = signal(false);
  readonly serverErrors = signal<FractionServerErrors>({});
  readonly notice = signal<string | null>(null);
  readonly outcome = signal<Extract<FractionResult, { ok: true }> | null>(null);
  private requestId = newUuid();

  // --- Carga y envío ---
  // Un solo subscribe: el resultado de la API se traduce a lo que pinta cada campo o aviso.
  onSubmitted(value: FractionFormSubmit): void {
    if (this.saving()) return; // sin segundo POST mientras el primero está en curso
    this.saving.set(true);
    this.serverErrors.set({});
    this.notice.set(null);
    this.fractionService
      .create({ requestId: this.requestId, ...value })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.onResult(result));
  }

  // Cada motivo de error decide dónde se pinta y si hay que recargar las piezas de bodega.
  private onResult(result: FractionResult): void {
    this.saving.set(false);
    if (result.ok) {
      this.outcome.set(result);
      this.toast.success(FRACTION_PAGE_TEXTS.saved);
      this.stockChanges.notify(); // las páginas de stock detrás del pop-up recargan sus piezas
      return;
    }
    switch (result.reason) {
      case 'no-units':
        this.serverErrors.set({ product: NO_UNITS_LABEL });
        this.optionsResource.reload();
        break;
      case 'price-below-cost':
        this.serverErrors.set({ price: result.message ?? FRACTION_PAGE_MESSAGES.priceBelowCost });
        break;
      case 'portions-invalid':
        this.serverErrors.set({ portions: result.message ?? FRACTION_PAGE_MESSAGES.portionsInvalid });
        break;
      case 'conflict':
        this.notice.set(result.message ?? FRACTION_PAGE_MESSAGES.saveFailed);
        this.optionsResource.reload();
        break;
      case 'offline':
        this.notice.set(FRACTION_PAGE_MESSAGES.saveFailed);
        break;
    }
  }

  // «Fraccionar otro»: formulario vacío, requestId nuevo (es otro fraccionado) y opciones al día.
  onAgain(): void {
    this.outcome.set(null);
    this.requestId = newUuid();
    this.preselectedId.set(null);
    this.serverErrors.set({});
    this.notice.set(null);
    this.optionsResource.reload();
  }

  // X, Escape y «Ver stock general» cierran el pop-up. Mientras guarda no se puede cerrar.
  close(): void {
    if (this.saving()) return;
    void this.router.navigate(closeModalLink());
  }

  // `producto` se acepta solo si es un id entero positivo; el formulario descarta el que no está en la lista.
  private productFromParams(): number | null {
    const raw = this.route.snapshot.paramMap.get('producto');
    const id = Number(raw);
    return raw !== null && Number.isInteger(id) && id > 0 ? id : null;
  }
}
