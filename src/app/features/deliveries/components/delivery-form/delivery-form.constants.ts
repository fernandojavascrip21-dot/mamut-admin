import type { FieldWithError } from './delivery-form.models';

// Mensajes de cada campo al enviar (spec HU-11 §2).
export const FIELD_MESSAGES: Record<FieldWithError, string> = {
  sellerId: 'Elige a quién se las dejas',
  productId: 'Elige el producto',
  qty: 'Las piezas deben ser un número entero mayor a 0',
  unitCostWithShipping: 'El costo debe ser mayor a 0',
  unitPrice: 'El precio debe ser mayor a 0',
};

export const NOT_ENOUGH_UNITS_ERROR = 'No hay piezas suficientes';

// Decimales de más o monto fuera de la columna (spec T-08 §3): nunca se redondea en silencio.
export const MONEY_MESSAGES = {
  unitCostWithShipping: {
    maxDecimals: 'El costo admite hasta 4 decimales',
    maxMoney: 'El costo es demasiado grande',
  },
  unitPrice: {
    maxDecimals: 'El precio admite hasta 2 decimales',
    maxMoney: 'El precio es demasiado grande',
  },
};
