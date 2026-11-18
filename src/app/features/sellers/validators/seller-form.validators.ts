import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { normalizePhone } from '../rules/seller.rules';

// Largo lógico: se cuenta sin los espacios de los extremos, como se guarda. Un valor vacío no da
// error, porque el campo es opcional.
export function maxTrimmedLength(max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const length = String(control.value ?? '').trim().length;
    return length > max ? { maxTrimmedLength: { max, actual: length } } : null;
  };
}

// Teléfono de 10 dígitos, aceptando espacios, guiones y paréntesis al escribirlo. Un campo
// vacío no da este error: de eso se encarga `notBlank`, para mostrar un solo mensaje a la vez.
export function tenDigitPhone(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '');
    if (value.trim() === '') return null;
    return normalizePhone(value) ? null : { tenDigitPhone: true };
  };
}
