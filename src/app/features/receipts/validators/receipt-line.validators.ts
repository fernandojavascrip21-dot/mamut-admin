import type { ValidationErrors, ValidatorFn } from '@angular/forms';
import { MONEY_MAX } from '@shared/constants/money.constants';
import { compareMoney } from '@shared/utils/money';
import { MAX_QTY, QTY_DIGITS } from '../constants/receipts.constants';

// Piezas de un renglón: obligatorias, entero de 1 en adelante y no más que el tope del backend.
// Se valida el texto tal como lo escribe el administrador; un decimal, un cero o un signo son «integer».
export function receiptQty(): ValidatorFn {
  return (control): ValidationErrors | null => {
    const value = String(control.value ?? '').trim();
    if (value === '') return { required: true };
    if (!QTY_DIGITS.test(value) || Number(value) < 1) return { integer: true };
    if (Number(value) > MAX_QTY) return { tooLarge: true };
    return null;
  };
}

// Costo leído: vacío es «sin costo» (válido). Si no, hasta 4 decimales y de 0 a MONEY_MAX[4]. Nunca se
// redondea: un monto con más decimales es error, no se corta en silencio.
export function receiptUnitCost(): ValidatorFn {
  return (control): ValidationErrors | null => {
    const value = String(control.value ?? '').trim();
    if (value === '') return null;
    // compareMoney devuelve null si el texto no es un monto de escala 4 (signo, letras, más decimales).
    const aboveMax = compareMoney(value, 4, MONEY_MAX[4], 4);
    if (aboveMax === null || aboveMax === 1) return { cost: true };
    return null;
  };
}
