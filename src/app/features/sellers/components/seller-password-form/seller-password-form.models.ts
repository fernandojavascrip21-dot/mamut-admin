import type { FormControl, FormGroup } from '@angular/forms';
import type { SetSellerPasswordInput } from '../../interfaces/seller.models';

export interface SellerPasswordFormValue {
  password: string;
  confirmation: string;
}

export type SellerPasswordFormSave = SetSellerPasswordInput;

export type SellerPasswordField = 'password' | 'confirmation';

export type SellerPasswordFormGroup = FormGroup<{
  password: FormControl<string>;
  confirmation: FormControl<string>;
}>;
