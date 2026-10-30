import type { FieldWithError } from './product-form.models';

// Mensajes de cada campo al enviar (HU-04 §2, HU-06 §2).
export const FIELD_MESSAGES: Record<FieldWithError, string> = {
  name: 'Escribe el nombre del producto',
  unitCost: 'El costo debe ser mayor a 0',
  price: 'El precio debe ser mayor a 0',
  units: 'Las piezas deben ser un número entero mayor a 0',
  portionSize: 'Escribe la porción',
};

// Decimales de más o monto fuera de la columna (spec T-08 §3): nunca se redondea en silencio.
export const MONEY_MESSAGES = {
  unitCost: { maxDecimals: 'El costo admite hasta 4 decimales', maxMoney: 'El costo es demasiado grande' },
  price: { maxDecimals: 'El precio admite hasta 2 decimales', maxMoney: 'El precio es demasiado grande' },
};
