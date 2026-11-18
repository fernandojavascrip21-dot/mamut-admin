import type { SetSellerPasswordInput } from '../../interfaces/seller.models';

export interface SellerPasswordFormValue {
  password: string;
  confirmation: string;
}

export type SellerPasswordFormSave = SetSellerPasswordInput;
