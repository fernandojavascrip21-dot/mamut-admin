import type { HoldingFieldWithError } from './holding-edit-form.models';

// Mensajes de cada campo al enviar.
export const HOLDING_FIELD_MESSAGES: Record<HoldingFieldWithError, string> = {
  qty: 'Las piezas deben ser un número entero de 0 o más',
  unitCostWithShipping: 'El costo debe ser mayor a 0',
  unitPrice: 'El precio debe ser mayor a 0',
};
