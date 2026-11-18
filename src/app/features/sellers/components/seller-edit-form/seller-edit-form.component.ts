import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import {
  Component, ElementRef, OnInit, Signal, afterRenderEffect, computed, effect, inject, input, output, signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { formatPhone } from '@shared/utils/phone';
import { notBlank } from '@shared/validators/validators';
import { MAX_BUSINESS_NAME } from '../../constants/sellers.constants';
import type { Seller, UpdateSellerInput } from '../../interfaces/seller.models';
import { normalizePhone } from '../../rules/seller.rules';
import { maxTrimmedLength, tenDigitPhone } from '../../validators/seller-form.validators';
import { EDIT_FIELD_MESSAGES } from './seller-edit-form.constants';
import type { SellerEditField } from './seller-edit-form.models';

// Formulario presentacional de «Editar datos» (HU-43): recibe al vendedor por `seller`, emite los
// cuatro datos por `save` y avisa `cancel`. La consulta y el guardado son de la página.
@Component({
  imports: [ButtonDirective, InputText, ReactiveFormsModule],
  selector: 'app-seller-edit-form',
  templateUrl: './seller-edit-form.component.html',
})
export class SellerEditFormComponent implements OnInit {
  // --- Dependencias ---
  private readonly fb = inject(FormBuilder).nonNullable;

  // --- Entradas y salidas ---
  readonly seller = input.required<Seller>();
  // Mientras guarda (o sin conexión) el formulario queda deshabilitado.
  readonly saving = input(false);
  // Errores que vienen del backend (409 / 422), por campo.
  readonly serverErrors = input<Partial<Record<SellerEditField, string>>>({});
  readonly save = output<UpdateSellerInput>();
  readonly cancel = output<void>();

  // --- Formulario y estados ---
  form = this.createEmptyForm();
  // Errores de validación: solo aparecen al enviar, no al tocar el campo.
  private readonly clientErrors = signal<Partial<Record<SellerEditField, string>>>({});
  readonly errors = computed(() => ({ ...this.clientErrors(), ...this.serverErrors() }));
  private readonly focusField = signal<SellerEditField | null>(null);
  private readonly fieldOrder: SellerEditField[] = ['fullName', 'businessName', 'phone', 'email'];

  private readonly fullNameInput = viewChild<ElementRef<HTMLInputElement>>('fullNameInput');
  private readonly businessInput = viewChild<ElementRef<HTMLInputElement>>('businessInput');
  private readonly phoneInput = viewChild<ElementRef<HTMLInputElement>>('phoneInput');
  private readonly emailInput = viewChild<ElementRef<HTMLInputElement>>('emailInput');
  private readonly inputs: Record<SellerEditField, Signal<ElementRef<HTMLInputElement> | undefined>> = {
    fullName: this.fullNameInput,
    businessName: this.businessInput,
    phone: this.phoneInput,
    email: this.emailInput,
  };

  // --- Ciclo de vida e inicialización ---
  constructor() {
    // Mientras guarda el formulario queda deshabilitado, sin perder lo escrito.
    effect(() => {
      if (this.saving()) this.form.disable({ emitEvent: false });
      else this.form.enable({ emitEvent: false });
    });

    // Un error del backend lleva el foco a su campo (el primero en orden de pantalla).
    effect(() => {
      const errors = this.serverErrors();
      const first = this.fieldOrder.find((field) => errors[field]);
      if (first) this.focusField.set(first);
    });

    // El foco se mueve cuando el campo ya está habilitado y pintado.
    afterRenderEffect(() => {
      const field = this.focusField();
      if (!field || this.saving()) return;
      this.inputs[field]()?.nativeElement.focus();
      this.focusField.set(null);
    });
  }

  ngOnInit(): void {
    this.form = this.createEmptyForm();
    this.loadInitialValue();
  }

  private createEmptyForm() {
    return this.fb.group({
      fullName: ['', [notBlank()]],
      businessName: ['', [maxTrimmedLength(MAX_BUSINESS_NAME)]],
      phone: ['', [notBlank(), tenDigitPhone()]],
      email: ['', [notBlank(), Validators.email]],
    });
  }

  // --- Getters ---
  // El guard de salida de la página pregunta si hay algo escrito sin guardar.
  hasChanges(): boolean {
    return this.form.dirty;
  }

  // --- Carga de datos ---
  // El teléfono se precarga con espacios (como lo muestra la app) y se envía solo con dígitos.
  private loadInitialValue(): void {
    const seller = this.seller();
    this.form.patchValue({
      fullName: seller.fullName,
      businessName: seller.businessName ?? '',
      phone: formatPhone(seller.phone),
      email: seller.email ?? '',
    });
  }

  // --- Validación, payload y envío ---
  // Inválido: pinta todos los errores, enfoca el primero y no emite.
  onSubmit(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.showFieldErrors();
      return;
    }
    this.clientErrors.set({});
    this.save.emit(this.prepareSavePayload());
  }

  // Nombre, negocio y correo recortados; negocio vacío = null; teléfono solo con dígitos.
  prepareSavePayload(): UpdateSellerInput {
    const raw = this.form.getRawValue();
    const businessName = raw.businessName.trim();
    return {
      fullName: raw.fullName.trim(),
      businessName: businessName === '' ? null : businessName,
      phone: normalizePhone(raw.phone) ?? raw.phone,
      email: raw.email.trim(),
    };
  }

  private showFieldErrors(): void {
    const errors: Partial<Record<SellerEditField, string>> = {};
    for (const field of this.fieldOrder) {
      const control = this.form.controls[field];
      if (control.valid) continue;
      const empty = control.hasError('notBlank') || control.hasError('required');
      errors[field] = empty ? EDIT_FIELD_MESSAGES[field].required : EDIT_FIELD_MESSAGES[field].invalid;
    }
    this.clientErrors.set(errors);
    this.focusField.set(this.fieldOrder.find((field) => errors[field]) ?? null);
  }
}
