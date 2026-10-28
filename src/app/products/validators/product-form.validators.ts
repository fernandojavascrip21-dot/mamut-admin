import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Los campos numéricos llegan como número (lo que escribe el usuario en un input number) o como
// texto (el numeric de Postgres, p. ej. "100.00", al cargar un producto): ambos pasan por Number().
// Vacío (null o '') nunca es válido.
function toNumber(value: unknown): number {
  if (value === null || value === undefined || String(value).trim() === '') return Number.NaN;
  return Number(value);
}

// Número mayor a 0 (precio y costo, HU-04 §2).
export function positiveNumber(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null =>
    toNumber(control.value) > 0 ? null : { positiveNumber: true };
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
// se permite. Solo opina cuando ambos son números positivos, para no duplicar el error de
// «mayor a 0» de cada campo. Error `priceBelowCost`.
export function priceNotBelowCost(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const price = toNumber(group.get('price')?.value);
    const unitCost = toNumber(group.get('unitCost')?.value);
    return price > 0 && unitCost > 0 && price < unitCost ? { priceBelowCost: true } : null;
  };
}
