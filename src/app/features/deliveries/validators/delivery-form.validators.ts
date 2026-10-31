import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { compareMoney, decimalPlaces, toMinorUnits, type MoneyScale } from '@shared/utils/money';
import { MAX_QTY } from '../constants/create-delivery-page.constants';

// Piezas: texto con solo dígitos, entero mayor a 0 y que quepa en un integer de Postgres.
// Vacío, decimales, signo o texto dan error `positiveInteger`.
export function positiveInteger(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const text = String(control.value ?? '').trim();
    const valid = /^\d+$/.test(text) && Number(text) > 0 && Number(text) <= MAX_QTY;
    return valid ? null : { positiveInteger: true };
  };
}

// Monto opcional (precio y costo propios del vendedor, RF-26 y RF-27): vacío = usar el general, así
// que es válido. Si se escribe, tiene que ser decimal mayor a 0 (`notPositive`), con a lo más `scale`
// decimales (`maxDecimals`) y dentro de la columna (`maxMoney`). Nunca se redondea en silencio (T-08).
export function optionalMoney(scale: MoneyScale, max: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const text = String(control.value ?? '').trim();
    if (text === '') return null;
    const decimals = decimalPlaces(text);
    if (decimals === null || !/[1-9]/.test(text)) return { notPositive: true };
    if (decimals > scale) return { maxDecimals: { scale } };
    const tooBig =
      toMinorUnits(text, scale) === null || compareMoney(text, scale, max, scale) === 1;
    return tooBig ? { maxMoney: true } : null;
  };
}
