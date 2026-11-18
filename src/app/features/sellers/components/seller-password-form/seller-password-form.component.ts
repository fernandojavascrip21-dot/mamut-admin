import { Component, input, output } from '@angular/core';
import type { SetSellerPasswordInput } from '../../interfaces/seller.models';

// Esqueleto (HU-45): solo la superficie pública; el formulario se implementa en el paso 5.
@Component({
  imports: [],
  selector: 'app-seller-password-form',
  templateUrl: './seller-password-form.component.html',
})
export class SellerPasswordFormComponent {
  readonly saving = input(false);
  readonly serverError = input<string | null>(null);
  readonly save = output<SetSellerPasswordInput>();
  readonly cancel = output<void>();
}
