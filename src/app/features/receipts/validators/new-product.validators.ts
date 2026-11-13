import type { ValidatorFn } from '@angular/forms';
import { MONEY_MAX } from '@shared/constants/money.constants';
import { compareMoney, decimalPlaces } from '@shared/utils/money';
import { NEW_PRODUCT_NAME_MAX } from '../constants/receipts.constants';
import { receiptUnitCost } from './receipt-line.validators';

// Nombre del producto nuevo: obligatorio y hasta el tope del catálogo, contando sin los espacios de los extremos.
export function newProductName(): ValidatorFn {
  return (control) => {
    const length = String(control.value ?? '').trim().length;
    if (length === 0) return { required: true };
    return length > NEW_PRODUCT_NAME_MAX ? { tooLong: true } : null;
  };
}

// Precio de venta: obligatorio, mayor que 0, hasta 2 decimales y dentro de la columna. Se valida el texto
// tal como lo escribió el administrador; un monto con más decimales es error, nunca se redondea.
export function productPrice(): ValidatorFn {
  return (control) => {
    const text = String(control.value ?? '').trim();
    if (text === '') return { required: true };
    const decimals = decimalPlaces(text);
    if (decimals === null || decimals > 2 || compareMoney(text, 2, MONEY_MAX[2], 2) === 1) return { money: true };
    return /[1-9]/.test(text) ? null : { positive: true };
  };
}

// Costo de fábrica del alta. Sin costo leído es obligatorio; con uno leído, vacío significa «usar el leído».
export function productUnitCost(required: boolean): ValidatorFn {
  const format = receiptUnitCost();
  return (control) => {
    const text = String(control.value ?? '').trim();
    if (text === '') return required ? { required: true } : null;
    return format(control);
  };
}
