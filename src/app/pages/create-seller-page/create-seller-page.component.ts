import {
  Component, DestroyRef, ElementRef, OnInit, Signal, afterRenderEffect, effect, inject, signal, viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { normalizePhone } from '@sellers/rules/seller.rules';
import { SellerSaveService } from '@sellers/services/seller-save.service';
import { tenDigitPhone } from '@sellers/validators/seller-form.validators';
import { PhonePipe } from '@shared/pipes/phone.pipe';
import { ToastService } from '@shared/toast.service';
import { notBlank } from '@shared/validators';
import type { CreateSellerInput, CreateSellerResult, Seller } from '@sellers/interfaces/seller.models';
import {
  BACKEND_MESSAGE_FIELD, DUPLICATE_EMAIL, FIELD_MESSAGES, MIN_PASSWORD, OFFLINE_MESSAGE,
} from '../constants/create-seller-page.constants';
import type { CreateSellerState, SellerField } from '../models/create-seller-page.models';

// Pantalla 15 (/admin/vendedores/nuevo, HU-08): alta de un vendedor con nombre, teléfono, correo
// para entrar (el «usuario», spec T-10) y contraseña temporal. Termina en «Vendedor dado de
// alta», desde donde se puede dar de alta otro sin recargar.
@Component({
  imports: [ReactiveFormsModule, RouterLink, PhonePipe],
  providers: [SellerSaveService],
  selector: 'app-create-seller-page',
  templateUrl: './create-seller-page.component.html',
})
export class CreateSellerPageComponent implements OnInit {
  // --- Dependencias ---
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly saveService = inject(SellerSaveService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  // --- Formulario y estados ---
  form = this.createEmptyForm();
  readonly state = signal<CreateSellerState>('form');
  readonly fieldErrors = signal<Partial<Record<SellerField, string>>>({});
  readonly createdSeller = signal<Seller | null>(null);
  readonly showPassword = signal(false);
  private readonly focusField = signal<SellerField | null>(null);
  private lastInput: CreateSellerInput | null = null;

  private readonly fullNameInput = viewChild<ElementRef<HTMLInputElement>>('fullNameInput');
  private readonly phoneInput = viewChild<ElementRef<HTMLInputElement>>('phoneInput');
  private readonly emailInput = viewChild<ElementRef<HTMLInputElement>>('emailInput');
  private readonly passwordInput = viewChild<ElementRef<HTMLInputElement>>('passwordInput');
  private readonly inputs: Record<SellerField, Signal<ElementRef<HTMLInputElement> | undefined>> = {
    fullName: this.fullNameInput,
    phone: this.phoneInput,
    email: this.emailInput,
    password: this.passwordInput,
  };

  // --- Ciclo de vida e inicialización ---
  constructor() {
    // Mientras guarda (o está sin conexión) el formulario queda deshabilitado, sin perder lo escrito.
    effect(() => {
      const busy = this.state() === 'saving' || this.state() === 'offline';
      if (busy) this.form.disable({ emitEvent: false });
      else this.form.enable({ emitEvent: false });
    });

    // El foco va al campo con error cuando ya está habilitado y pintado (tras validar o tras un 409/422).
    afterRenderEffect(() => {
      const field = this.focusField();
      if (!field || this.state() !== 'form') return;
      this.inputs[field]()?.nativeElement.focus();
      this.focusField.set(null);
    });
  }

  // Estructura y reglas del formulario; no hay datos que cargar (es un alta).
  ngOnInit(): void {
    this.form = this.createEmptyForm();
  }

  private createEmptyForm() {
    return this.fb.group({
      fullName: ['', [notBlank()]],
      phone: ['', [notBlank(), tenDigitPhone()]],
      email: ['', [notBlank(), Validators.email]],
      password: ['', [Validators.required, Validators.minLength(MIN_PASSWORD)]],
    });
  }

  // --- Interacción ---
  togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  // --- Validación, payload y envío ---
  // Si el formulario es inválido, pinta el error de cada campo, lleva el foco al primero y no
  // envía. Ignora un segundo envío mientras el primero sigue en curso.
  onSubmit(): void {
    if (this.state() === 'saving') return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.showFieldErrors();
      return;
    }
    this.save(this.prepareSavePayload());
  }

  // Botón «Reintentar» del aviso sin conexión: reenvía exactamente lo mismo.
  retry(): void {
    if (this.lastInput) this.save(this.lastInput);
  }

  // «Dar de alta otro vendedor»: formulario vacío, sin errores ni contraseña visible.
  startNewSeller(): void {
    this.form = this.createEmptyForm();
    this.lastInput = null;
    this.fieldErrors.set({});
    this.showPassword.set(false);
    this.createdSeller.set(null);
    this.state.set('form');
  }

  // Nombre y correo sin espacios en los extremos; el teléfono ya solo con dígitos (el backend
  // también lo normaliza). La contraseña va tal cual: un espacio puede ser parte de ella.
  prepareSavePayload(): CreateSellerInput {
    const raw = this.form.getRawValue();
    return {
      fullName: raw.fullName.trim(),
      phone: normalizePhone(raw.phone) ?? raw.phone,
      email: raw.email.trim(),
      password: raw.password,
    };
  }

  private save(input: CreateSellerInput): void {
    this.lastInput = input;
    this.fieldErrors.set({});
    this.state.set('saving');
    this.saveService
      .create(input)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.showResult(result));
  }

  private showResult(result: CreateSellerResult): void {
    if (result.ok) {
      this.toastService.success(`Vendedor «${result.seller.fullName}» dado de alta`);
      this.createdSeller.set(result.seller);
      this.state.set('created');
      return;
    }
    if (result.reason === 'offline') {
      this.toastService.error(OFFLINE_MESSAGE);
      this.state.set('offline');
      return;
    }
    const message = result.reason === 'duplicate-email' ? DUPLICATE_EMAIL : result.message ?? OFFLINE_MESSAGE;
    const field = result.reason === 'duplicate-email' ? 'email' : BACKEND_MESSAGE_FIELD[message];
    this.toastService.error(message);
    if (field) {
      this.fieldErrors.set({ [field]: message });
      this.focusField.set(field);
    }
    this.state.set('form');
  }

  private showFieldErrors(): void {
    const errors: Partial<Record<SellerField, string>> = {};
    for (const field of ['fullName', 'phone', 'email', 'password'] as const) {
      const control = this.form.controls[field];
      if (control.valid) continue;
      const empty = control.hasError('notBlank') || control.hasError('required');
      errors[field] = empty ? FIELD_MESSAGES[field].required : FIELD_MESSAGES[field].invalid;
    }
    this.fieldErrors.set(errors);
    const first = (['fullName', 'phone', 'email', 'password'] as const).find((field) => errors[field]);
    this.focusField.set(first ?? null);
  }
}
