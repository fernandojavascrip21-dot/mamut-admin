import { Component, input, output } from '@angular/core';
import type { Seller, UpdateSellerInput } from '../../interfaces/seller.models';
import type { SellerEditField } from './seller-edit-form.models';

// Formulario presentacional de «Editar datos» (HU-43): recibe al vendedor y emite los cuatro datos.
@Component({
  imports: [],
  selector: 'app-seller-edit-form',
  templateUrl: './seller-edit-form.component.html',
})
export class SellerEditFormComponent {
  readonly seller = input.required<Seller>();
  // Mientras guarda (o sin conexión) el formulario queda deshabilitado.
  readonly saving = input(false);
  // Errores que vienen del backend (409 / 422), por campo.
  readonly serverErrors = input<Partial<Record<SellerEditField, string>>>({});

  readonly save = output<UpdateSellerInput>();
  readonly cancel = output<void>();
}
