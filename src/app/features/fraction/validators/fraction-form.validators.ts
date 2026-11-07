import type { ValidatorFn } from '@angular/forms';
import { compareMoney, decimalPlaces, type MoneyScale } from '@shared/utils/money';
import { WHOLE_NUMBER } from '../constants/fraction.constants';
import { MAX_PORTIONS, MIN_PORTIONS } from '../constants/fraction-page.constants';

// Texto obligatorio (la porción de la bolsita): vacío o solo espacios da error; se recorta antes de validar.
export function notBlank(): ValidatorFn {
  return (control) => (String(control.value ?? '').trim() === '' ? { required: true } : null);
}

// Bolsitas: entero de MIN_PORTIONS a MAX_PORTIONS. Se valida el texto antes de convertir, para que
// «2.5» o «abc» den error de formato y no se redondeen en silencio.
export function portionsInRange(): ValidatorFn {
  return (control) => {
    const value = String(control.value ?? '').trim();
    if (value === '') return { required: true };
    if (!WHOLE_NUMBER.test(value)) return { integer: true };
    const portions = Number(value);
    return portions >= MIN_PORTIONS && portions <= MAX_PORTIONS ? null : { range: true };
  };
}

// Precio de la bolsita: obligatorio, mayor que 0, con hasta `scale` decimales y no mayor que `max`.
// Se valida con money.ts (no con Number) para no aceptar ni redondear montos de más decimales.
export function requiredMoney(scale: MoneyScale, max: string): ValidatorFn {
  return (control) => {
    const value = String(control.value ?? '').trim();
    if (value === '') return { required: true };
    const places = decimalPlaces(value);
    if (places === null) return { money: true };
    if (places > scale) return { decimals: true };
    if (compareMoney(value, scale, '0', scale) !== 1) return { min: true };
    if (compareMoney(value, scale, max, scale) === 1) return { max: true };
    return null;
  };
}
