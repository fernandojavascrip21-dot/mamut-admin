import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { MAX_RETURN_QTY } from '../constants/sellers.constants';

// Piezas: texto con solo dígitos, entero mayor a 0 y que quepa en un integer de Postgres.
// Vacío, decimales, signo o texto dan error `wholePositiveUnits`.
export function wholePositiveUnits(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const text = String(control.value ?? '').trim();
    const valid = /^\d+$/.test(text) && Number(text) > 0 && Number(text) <= MAX_RETURN_QTY;
    return valid ? null : { wholePositiveUnits: true };
  };
}

// Piezas que no pasan de las que el vendedor tiene del producto elegido. `getMax` se lee en cada
// validación (cambia con el producto) y devuelve null mientras no hay producto. Si el texto no es
// un entero válido no da este error: de eso se encarga `wholePositiveUnits`, para mostrar un solo
// mensaje a la vez.
export function maxUnits(getMax: () => number | null): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const text = String(control.value ?? '').trim();
    const max = getMax();
    if (max === null || !/^\d+$/.test(text)) return null;
    return Number(text) > max ? { maxUnits: { max } } : null;
  };
}
