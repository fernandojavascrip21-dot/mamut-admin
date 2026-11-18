import { Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { ToastService } from '@core/toast/toast.service';
import { ModalPanelComponent } from '@shared/components/modal-panel/modal-panel.component';
import { isNotFound } from '@shared/utils/http-errors';
import { closeModalLink } from '@shared/utils/modal-links';
import { SellerEditFormComponent } from '../../components/seller-edit-form/seller-edit-form.component';
import type { SellerEditField } from '../../components/seller-edit-form/seller-edit-form.models';
import {
  CONNECTION_HINT, EDIT_BACKEND_MESSAGE_FIELD, EDIT_DUPLICATE_EMAIL, EDIT_SELLER_LOAD_ERROR, EDIT_SELLER_LOADING,
  EDIT_SELLER_NOT_FOUND, EDIT_SELLER_OFFLINE_TITLE, EDIT_SELLER_TITLE, SELLER_GONE_NOTICE,
} from '../../constants/edit-seller-page.constants';
import type { Seller, SellerDetail, UpdateSellerInput, UpdateSellerResult } from '../../interfaces/seller.models';
import type {
  EditSellerLeaveTarget, EditSellerSaveState, EditSellerState,
} from '../../models/edit-seller-page.models';
import { SellerUpdateService } from '../../services/seller-update.service';
import { SellersService } from '../../services/sellers.service';

// Pop-up «Editar datos» del vendedor (HU-43), ruta `vendedor/:sellerId` del outlet `ventana`. Carga
// al vendedor, deja corregir sus cuatro datos con SellerEditFormComponent y guarda con
// SellerUpdateService. Al guardar avisa con un toast y se cierra; la ficha se refresca sola.
@Component({
  imports: [ButtonDirective, ModalPanelComponent, SellerEditFormComponent],
  providers: [SellerUpdateService],
  selector: 'app-edit-seller-page',
  templateUrl: './edit-seller-page.component.html',
})
export class EditSellerPageComponent implements EditSellerLeaveTarget {
  // --- Dependencias ---
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sellersService = inject(SellersService);
  private readonly updateService = inject(SellerUpdateService);
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
    stream: ({ params: id }) => this.sellersService.get(id),
  });
  readonly seller = computed<SellerDetail | null>(() =>
    this.sellerResource.hasValue() ? this.sellerResource.value() : null,
  );

  // --- Estado de la pantalla ---
  private readonly saveState = signal<EditSellerSaveState>('idle');
  readonly serverErrors = signal<Partial<Record<SellerEditField, string>>>({});
  private readonly saved = signal(false);
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
    return this.saveState() === 'saving';
  }

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
    this.lastInput = input;
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
        this.toastService.error(EDIT_DUPLICATE_EMAIL);
        this.serverErrors.set({ email: EDIT_DUPLICATE_EMAIL });
        return;
      case 'invalid': {
        const message = result.message ?? EDIT_SELLER_OFFLINE_TITLE;
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
}
