import { Component, DestroyRef, Injector, computed, inject, signal, viewChild } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Observable } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { ConfirmService } from '@core/confirm/confirm.service';
import { ToastService } from '@core/toast/toast.service';
import { ModalPanelComponent } from '@shared/components/modal-panel/modal-panel.component';
import { isNotFound } from '@shared/utils/http-errors';
import { closeModalLink, leaveModalLink, returnModalLink } from '@shared/utils/modal-links';
import { SellerEditFormComponent } from '../../components/seller-edit-form/seller-edit-form.component';
import type { SellerEditField } from '../../components/seller-edit-form/seller-edit-form.models';
import {
  CONNECTION_HINT, EDIT_BACKEND_MESSAGE_FIELD, EDIT_INVALID_FALLBACK, EDIT_SELLER_LOAD_ERROR, EDIT_SELLER_LOADING,
  EDIT_SELLER_NOT_FOUND, EDIT_SELLER_OFFLINE_TITLE, EDIT_SELLER_TITLE, SELLER_GONE_NOTICE,
  DEACTIVATE_EMAIL_WARNING, REACTIVATE_EMAIL_WARNING_POPUP, STATUS_OFFLINE_NOTICE, deactivateConfirmation,
  removeConfirmation, sellerDeactivatedNotice, sellerReactivatedToast, sellerRemovedNotice,
} from '../../constants/edit-seller-page.constants';
import {
  DUPLICATE_EMAIL, SELLERS_FILTER_PARAM, SELLERS_INACTIVE_PARAM_VALUE, SELLER_HAS_HISTORY, SELLER_HAS_UNITS,
} from '../../constants/sellers.constants';
import type { Seller, SellerDetail, SellerStatusResult, UpdateSellerInput, UpdateSellerResult } from '../../interfaces/seller.models';
import type {
  EditSellerBusy, EditSellerLeaveTarget, EditSellerSaveState, EditSellerState, EditSellerStatusAction,
} from '../../models/edit-seller-page.models';
import { SellerUpdateService } from '../../services/seller-update.service';
import { SellerStatusService } from '../../services/seller-status.service';
import { SellersService } from '../../services/sellers.service';
import { SellerStatusActionsComponent } from './ui/seller-status-actions/seller-status-actions.component';
import type { SellerStatusNotice } from './ui/seller-status-actions/seller-status-actions.models';

// Pop-up «Editar datos» del vendedor (HU-43), ruta `vendedor/:sellerId` del outlet `ventana`. Carga
// al vendedor, deja corregir sus cuatro datos con SellerEditFormComponent y guarda con
// SellerUpdateService. Al guardar avisa con un toast y se cierra; la ficha se refresca sola.
@Component({
  imports: [ButtonDirective, ModalPanelComponent, SellerEditFormComponent, SellerStatusActionsComponent],
  providers: [SellerUpdateService, SellerStatusService],
  selector: 'app-edit-seller-page',
  templateUrl: './edit-seller-page.component.html',
})
export class EditSellerPageComponent implements EditSellerLeaveTarget {
  // --- Dependencias ---
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sellersService = inject(SellersService);
  private readonly updateService = inject(SellerUpdateService);
  private readonly statusService = inject(SellerStatusService);
  // Se resuelve al usarlo: solo las acciones de estado piden confirmación, no abrir ni guardar.
  private readonly injector = inject(Injector);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly title = EDIT_SELLER_TITLE;
  readonly loadingText = EDIT_SELLER_LOADING;
  readonly notFoundText = EDIT_SELLER_NOT_FOUND;
  readonly loadErrorText = EDIT_SELLER_LOAD_ERROR;
  readonly offlineTitle = EDIT_SELLER_OFFLINE_TITLE;
  readonly connectionHint = CONNECTION_HINT;

  private readonly sellerId = this.route.snapshot.paramMap.get('sellerId') ?? '';
  private readonly form = viewChild(SellerEditFormComponent);

  // --- Carga de datos ---
  private readonly sellerResource = rxResource({
    params: () => this.sellerId,
    stream: ({ params: id }) => this.sellersService.getAny(id),
  });
  readonly seller = computed<SellerDetail | null>(() =>
    this.sellerResource.hasValue() ? this.sellerResource.value() : null,
  );

  // --- Estado de la pantalla ---
  private readonly saveState = signal<EditSellerSaveState>('idle');
  readonly serverErrors = signal<Partial<Record<SellerEditField, string>>>({});
  private readonly saved = signal(false);
  // Acción de estado en curso y alerta de su 409 (HU-44).
  private readonly statusAction = signal<EditSellerStatusAction | null>(null);
  readonly statusNotice = signal<SellerStatusNotice>(null);
  private lastInput: UpdateSellerInput | null = null;

  readonly state = computed<EditSellerState>(() => {
    if (this.sellerResource.status() === 'error') {
      return isNotFound(this.sellerResource.error()) ? 'not-found' : 'error';
    }
    if (!this.seller()) return 'loading';
    const save = this.saveState();
    return save === 'idle' ? 'form' : save;
  });

  // --- Datos para el guard de salida ---
  saving(): boolean {
    return this.saveState() === 'saving' || this.statusAction() !== null;
  }

  // Qué tiene ocupado al pop-up: la acción de estado o el guardado del formulario.
  readonly busy = computed<EditSellerBusy>(() => this.statusAction() ?? (this.saveState() === 'saving' ? 'saving' : null));

  // Tras guardar con éxito ya no queda nada pendiente: el cierre no debe preguntar.
  hasUnsavedChanges(): boolean {
    return !this.saved() && (this.form()?.hasChanges() ?? false);
  }

  // --- Interacción ---
  // X, «Cancelar», «Cerrar» y Escape; el guard decide si se puede salir.
  close(): void {
    void this.router.navigate(closeModalLink());
  }

  // «Reintentar» del error de carga.
  retryLoad(): void {
    this.sellerResource.reload();
  }

  // --- Guardado ---
  // Ignora un segundo envío mientras el primero sigue en curso; takeUntilDestroyed evita tocar el
  // estado si el pop-up ya se cerró.
  save(input: UpdateSellerInput): void {
    if (this.saveState() === 'saving') return;
    if (this.statusAction()) return;
    this.lastInput = input;
    this.statusNotice.set(null);
    this.serverErrors.set({});
    this.saveState.set('saving');
    this.updateService
      .update(this.sellerId, input)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.showResult(result));
  }

  // «Reintentar» del aviso sin conexión: reenvía exactamente el mismo payload.
  retrySave(): void {
    if (this.lastInput) this.save(this.lastInput);
  }

  private showResult(result: UpdateSellerResult): void {
    this.saveState.set('idle');
    if (result.ok) {
      this.onSaved(result.seller);
      return;
    }
    switch (result.reason) {
      case 'offline':
        this.saveState.set('offline');
        return;
      case 'not-found':
        this.toastService.error(SELLER_GONE_NOTICE);
        this.saved.set(true);
        this.close();
        return;
      case 'duplicate-email':
        this.toastService.error(DUPLICATE_EMAIL);
        this.serverErrors.set({ email: DUPLICATE_EMAIL });
        return;
      case 'invalid': {
        const message = result.message ?? EDIT_INVALID_FALLBACK;
        this.toastService.error(message);
        const field = EDIT_BACKEND_MESSAGE_FIELD[message];
        if (field) this.serverErrors.set({ [field]: message });
        return;
      }
    }
  }

  private onSaved(seller: Seller): void {
    this.toastService.success(`Datos de «${seller.fullName}» guardados`);
    this.saved.set(true);
    this.close();
  }

  // --- Estado del vendedor (HU-44) ---
  // Confirma con el administrador y desactiva; con cambios sin guardar la confirmación avisa que se pierden.
  async deactivate(): Promise<void> {
    const seller = this.seller();
    if (!seller || this.saving()) return;
    if (!(await this.injector.get(ConfirmService).ask(deactivateConfirmation(seller.fullName, this.form()?.hasChanges() ?? false)))) {
      return;
    }
    this.runStatus('deactivate', this.statusService.deactivate(this.sellerId), seller);
  }

  // Reactivar se deshace desactivando, así que no pide confirmación.
  reactivate(): void {
    const seller = this.seller();
    if (!seller || this.saving()) return;
    this.runStatus('reactivate', this.statusService.reactivate(this.sellerId), seller);
  }

  async remove(): Promise<void> {
    const seller = this.seller();
    if (!seller || this.saving()) return;
    if (!(await this.injector.get(ConfirmService).ask(removeConfirmation(seller.fullName, this.form()?.hasChanges() ?? false)))) {
      return;
    }
    this.runStatus('remove', this.statusService.remove(this.sellerId), seller);
  }

  // «Retirar producto» de la alerta: cambia este pop-up por el de retiro (pasa por el guard de salida).
  returnUnits(): void {
    void this.router.navigate(returnModalLink(this.sellerId));
  }

  private runStatus(action: EditSellerStatusAction, request: Observable<SellerStatusResult>, seller: SellerDetail): void {
    if (this.saving()) return;
    this.statusNotice.set(null);
    this.statusAction.set(action);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      this.statusAction.set(null);
      this.showStatusResult(action, result, seller);
    });
  }

  private showStatusResult(action: EditSellerStatusAction, result: SellerStatusResult, seller: SellerDetail): void {
    if (result.ok) {
      this.onStatusDone(action, result, seller);
      return;
    }
    switch (result.reason) {
      case 'has-units':
        this.statusNotice.set({ message: SELLER_HAS_UNITS, showReturn: true });
        return;
      case 'has-history':
        this.statusNotice.set({ message: SELLER_HAS_HISTORY, showReturn: false });
        return;
      case 'not-found':
        this.toastService.error(SELLER_GONE_NOTICE);
        this.saved.set(true);
        if (action === 'remove') this.leaveToList(seller.active);
        else this.close();
        return;
      case 'offline':
        this.toastService.error(STATUS_OFFLINE_NOTICE[action]);
        return;
    }
  }

  private onStatusDone(action: EditSellerStatusAction, result: Extract<SellerStatusResult, { ok: true }>, seller: SellerDetail): void {
    const name = seller.fullName;
    const failedEmail = result.emailStatus === 'failed' || result.emailStatus === 'skipped';
    this.saved.set(true);
    if (action === 'remove') {
      this.toastService.success(sellerRemovedNotice(name));
      this.leaveToList(seller.active);
      return;
    }
    if (action === 'deactivate') {
      this.toastService.success(sellerDeactivatedNotice(name));
      if (failedEmail) this.toastService.warn(DEACTIVATE_EMAIL_WARNING);
    } else {
      this.toastService.success(sellerReactivatedToast(name));
      if (failedEmail) this.toastService.warn(REACTIVATE_EMAIL_WARNING_POPUP);
    }
    this.close();
  }

  // Cierra el pop-up y va a «Mis vendedores» con el filtro que tenía el vendedor, en una sola navegación.
  private leaveToList(wasActive: boolean): void {
    const queryParams = wasActive ? {} : { [SELLERS_FILTER_PARAM]: SELLERS_INACTIVE_PARAM_VALUE };
    void this.router.navigate(leaveModalLink(['vendedores']), { queryParams });
  }
}
