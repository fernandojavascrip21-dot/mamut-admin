import type { SellerEditField } from './seller-edit-form.models';

// Mensaje de cada campo del formulario «Editar datos» cuando no cumple su regla.
export const EDIT_FIELD_MESSAGES: Record<SellerEditField, { required: string; invalid: string }> = {
  fullName: { required: 'Escribe el nombre del vendedor', invalid: 'Escribe el nombre del vendedor' },
  businessName: {
    required: '',
    invalid: 'El nombre del negocio debe tener como máximo 80 caracteres',
  },
  phone: { required: 'Escribe el teléfono del vendedor', invalid: 'El teléfono debe tener 10 dígitos' },
  email: { required: 'Escribe el correo para entrar', invalid: 'El correo no es válido' },
};
