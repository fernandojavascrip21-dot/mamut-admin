import { ButtonDirective } from 'primeng/button';
import { Password } from 'primeng/password';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MIN_PASSWORD } from '../../constants/sellers.constants';
import type { SetSellerPasswordInput } from '../../interfaces/seller.models';
import { passwordsMatchValidator } from '../../validators/seller-password.validators';
import { INVALID_INPUT_PT, PASSWORD_FIELD_MESSAGES, PASSWORD_FORM_TEXTS } from './seller-password-form.constants';
import type { SellerPasswordField } from './seller-password-form.models';

// Formulario presentacional de «Cambiar contraseña» (HU-45): emite solo { password } por `save`.
// La contraseña vive únicamente en este formulario; la página guarda y decide el cierre.
@Component({
  imports: [ButtonDirective, Password, ReactiveFormsModule],
  selector: 'app-seller-password-form',
  templateUrl: './seller-password-form.component.html',
})
export class SellerPasswordFormComponent {
  // --- Dependencias ---
  private readonly fb = inject(FormBuilder).nonNullable;

  // --- Entradas y salidas ---
  readonly saving = input(false);
  // Error del backend (422) para «Contraseña temporal».
  readonly serverError = input<string | null>(null);
  readonly save = output<SetSellerPasswordInput>();
  readonly cancel = output<void>();

  // --- Formulario y estados ---
  readonly texts = PASSWORD_FORM_TEXTS;
  // p-password no pone aria-invalid en su input interno: se lo pasamos por passthrough.
  readonly invalidPt = INVALID_INPUT_PT;
  form = this.createEmptyForm();
  // Los errores de campo salen al enviar, no al tocar.
  private readonly submitted = signal(false);
  private readonly clientErrors = signal<Partial<Record<SellerPasswordField, string>>>({});
  readonly errors = computed<Partial<Record<SellerPasswordField, string>>>(() => {
    const server = this.serverError();
    return server ? { ...this.clientErrors(), password: server } : this.clientErrors();
  });

  // --- Validación, payload y envío ---
  private createEmptyForm() {
    return this.fb.group({
      password: ['', [Validators.required, Validators.minLength(MIN_PASSWORD)]],
      confirmation: ['', [Validators.required, passwordsMatchValidator()]],
    });
  }

  // Recalcula los mensajes desde el estado de los controles; se llama al enviar.
  private collectErrors(): Partial<Record<SellerPasswordField, string>> {
    const { password, confirmation } = this.form.controls;
    const errors: Partial<Record<SellerPasswordField, string>> = {};
    if (password.hasError('required')) errors.password = PASSWORD_FIELD_MESSAGES.passwordRequired;
    else if (password.invalid) errors.password = PASSWORD_FIELD_MESSAGES.passwordShort;
    if (confirmation.hasError('required')) errors.confirmation = PASSWORD_FIELD_MESSAGES.confirmationRequired;
    else if (confirmation.hasError('mismatch')) errors.confirmation = PASSWORD_FIELD_MESSAGES.mismatch;
    return errors;
  }

  private prepareSavePayload(): SetSellerPasswordInput {
    return { password: this.form.getRawValue().password };
  }

  onSubmit(): void {
    if (this.saving()) return;
    // La confirmación depende de la contraseña: se revalida por si esta cambió después.
    this.form.controls.confirmation.updateValueAndValidity();
    this.submitted.set(true);
    this.clientErrors.set(this.collectErrors());
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.save.emit(this.prepareSavePayload());
  }
}
