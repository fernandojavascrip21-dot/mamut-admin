import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { ToastService } from '@core/toast/toast.service';
import { ModalPanelComponent } from '@shared/components/modal-panel/modal-panel.component';
import { isNotFound } from '@shared/utils/http-errors';
import { closeModalLink } from '@shared/utils/modal-links';
import { SellerPasswordFormComponent } from '../../components/seller-password-form/seller-password-form.component';
import {
  SELLER_PASSWORD_CONNECTION_HINT, SELLER_PASSWORD_EMAIL_WARNING, SELLER_PASSWORD_INACTIVE,
  SELLER_PASSWORD_INVALID_FALLBACK, SELLER_PASSWORD_LOAD_ERROR, SELLER_PASSWORD_LOADING,
  SELLER_PASSWORD_NOT_FOUND, SELLER_PASSWORD_OFFLINE_TITLE, SELLER_PASSWORD_TITLE, sellerPasswordChangedNotice,
} from '../../constants/seller-password-page.constants';
import type { SellerDetail, SellerPasswordResult, SetSellerPasswordInput } from '../../interfaces/seller.models';
import type { SellerPasswordPageState, SellerPasswordSaveState } from '../../models/seller-password-page.models';
import { SellerPasswordService } from '../../services/seller-password.service';
import { SellersService } from '../../services/sellers.service';

// Pop-up «Cambiar contraseña» (HU-45), ruta `vendedor/:sellerId/contrasena` del outlet `ventana`.
// Carga al vendedor, deja escribir la contraseña temporal con SellerPasswordFormComponent y guarda con
// SellerPasswordService. La contraseña vive solo en el formulario; aquí no se guarda en ningún signal.
@Component({
  imports: [ButtonDirective, ModalPanelComponent, SellerPasswordFormComponent],
  providers: [SellerPasswordService],
  selector: 'app-seller-password-page',
  templateUrl: './seller-password-page.component.html',
})
export class SellerPasswordPageComponent {
  // --- Dependencias ---
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sellersService = inject(SellersService);
  private readonly passwordService = inject(SellerPasswordService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly title = SELLER_PASSWORD_TITLE;
  readonly loadingText = SELLER_PASSWORD_LOADING;
  readonly loadErrorText = SELLER_PASSWORD_LOAD_ERROR;
  readonly notFoundText = SELLER_PASSWORD_NOT_FOUND;
  readonly inactiveText = SELLER_PASSWORD_INACTIVE;
  readonly offlineTitle = SELLER_PASSWORD_OFFLINE_TITLE;
  readonly connectionHint = SELLER_PASSWORD_CONNECTION_HINT;

  private readonly sellerId = this.route.snapshot.paramMap.get('sellerId') ?? '';

  // --- Carga de datos ---
  private readonly sellerResource = rxResource({
    params: () => this.sellerId,
    stream: ({ params: id }) => this.sellersService.getAny(id),
  });
  readonly seller = computed<SellerDetail | null>(() =>
    this.sellerResource.hasValue() ? this.sellerResource.value() : null,
  );

  // --- Estado de la pantalla ---
  private readonly saveState = signal<SellerPasswordSaveState>('idle');
  // Solo el mensaje del backend (nunca la contraseña).
  readonly serverError = signal<string | null>(null);
  // Último payload, para «Reintentar» sin volver a pedir lo escrito; se suelta al terminar.
  private lastInput: SetSellerPasswordInput | null = null;

  readonly state = computed<SellerPasswordPageState>(() => {
    if (this.sellerResource.status() === 'error') {
      return isNotFound(this.sellerResource.error()) ? 'not-found' : 'error';
    }
    const seller = this.seller();
    if (!seller) return 'loading';
    if (!seller.active) return 'inactive';
    return this.saveState() === 'not-found' ? 'save-not-found' : 'ready';
  });
  readonly offline = computed(() => this.saveState() === 'offline');

  // Lo lee modalSavingGuard: con el guardado en curso el pop-up no se cierra.
  saving(): boolean {
    return this.saveState() === 'saving';
  }

  // --- Interacción ---
  close(): void {
    void this.router.navigate(closeModalLink());
  }

  retryLoad(): void {
    this.sellerResource.reload();
  }

  // --- Guardado ---
  // Ignora un segundo envío mientras el primero corre; takeUntilDestroyed evita tocar el estado tras cerrar.
  save(input: SetSellerPasswordInput): void {
    if (this.saving()) return;
    this.lastInput = input;
    this.serverError.set(null);
    this.saveState.set('saving');
    this.passwordService
      .change(this.sellerId, input)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.showResult(result));
  }

  retrySave(): void {
    if (this.lastInput) this.save(this.lastInput);
  }

  private showResult(result: SellerPasswordResult): void {
    if (result.ok) {
      this.lastInput = null;
      this.saveState.set('idle');
      if (result.emailStatus === 'sent') {
        this.toastService.success(sellerPasswordChangedNotice(this.seller()?.fullName ?? ''));
      } else {
        this.toastService.warn(SELLER_PASSWORD_EMAIL_WARNING);
      }
      this.close();
      return;
    }
    switch (result.reason) {
      case 'invalid':
        this.saveState.set('idle');
        this.serverError.set(result.message ?? SELLER_PASSWORD_INVALID_FALLBACK);
        return;
      case 'not-found':
        this.saveState.set('not-found');
        return;
      case 'offline':
        this.saveState.set('offline');
        return;
    }
  }
}
