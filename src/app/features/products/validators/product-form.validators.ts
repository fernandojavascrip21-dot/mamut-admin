import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { compareMoney, decimalPlaces, toMinorUnits, type MoneyScale } from '@shared/utils/money';

// Piezas: llegan como número (input number) o texto; ambos pasan por Number(). Vacío (null o '')
// nunca es válido. El dinero no pasa por aquí: se lee como texto (spec T-08).
function toNumber(value: unknown): number {
  if (value === null || value === undefined || String(value).trim() === '') return Number.NaN;
  return Number(value);
}

// Texto del campo de dinero tal cual lo escribió el usuario (o como llegó de Postgres), sin espacios.
function moneyText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

// Monto decimal mayor a 0 (precio y costo, HU-04 §2). Se revisa como texto: es válido si tiene
// formato decimal y algún dígito distinto de 0, sin convertirlo a número flotante (spec T-08).
// Vacío, notación científica, comas o signo dan error.
export function positiveNumber(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const text = moneyText(control.value);
    return decimalPlaces(text) !== null && /[1-9]/.test(text) ? null : { positiveNumber: true };
  };
}

// Decimales de más (spec T-08 §3): precio hasta 2, costo hasta 4. Nunca se redondea en silencio.
// Un texto que no es decimal lo reporta positiveNumber. Error `maxDecimals`.
export function maxDecimals(scale: MoneyScale): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const decimals = decimalPlaces(moneyText(control.value));
    return decimals !== null && decimals > scale ? { maxDecimals: { scale } } : null;
  };
}

// Máximo de la columna (spec T-08 §3), p. ej. MONEY_MAX[2] para el precio. Un monto con tantos
// dígitos que no cabe exacto en un entero también es demasiado grande. Error `maxMoney`.
export function maxMoney(max: string, scale: MoneyScale): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const text = moneyText(control.value);
    const decimals = decimalPlaces(text);
    if (decimals === null || decimals > scale) return null;
    const tooBig = toMinorUnits(text, scale) === null || compareMoney(text, scale, max, scale) === 1;
    return tooBig ? { maxMoney: true } : null;
  };
}

// Entero mayor a 0 (piezas que entran en el alta, HU-04 §2).
export function positiveInteger(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = toNumber(control.value);
    return Number.isInteger(value) && value > 0 ? null : { positiveInteger: true };
  };
}

// Validador de grupo: la porción es obligatoria solo si `fractionable` está marcado. Va en el
// grupo y no en el campo porque depende de otro control. Error `portionRequired`.
export function portionRequiredWhenFractionable(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const fractionable = group.get('fractionable')?.value === true;
    const portionSize = String(group.get('portionSize')?.value ?? '').trim();
    return fractionable && !portionSize ? { portionRequired: true } : null;
  };
}

// Validador de grupo (HU-06 §2): el precio nunca puede quedar por debajo del costo; igual sí
// se permite. Compara en unidades enteras, precio con escala 2 y costo con escala 4 (spec T-08).
// Solo opina cuando ambos son montos válidos y positivos, para no duplicar los errores de cada
// campo. Error `priceBelowCost`.
export function priceNotBelowCost(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const price = moneyText(group.get('price')?.value);
    const unitCost = moneyText(group.get('unitCost')?.value);
    if (!/[1-9]/.test(price) || !/[1-9]/.test(unitCost)) return null;
    return compareMoney(price, 2, unitCost, 4) === -1 ? { priceBelowCost: true } : null;
  };
}
