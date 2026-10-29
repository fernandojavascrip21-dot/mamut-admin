import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { normalizePhone } from '../rules/seller.rules';

// Teléfono de 10 dígitos, aceptando espacios, guiones y paréntesis al escribirlo. Un campo
// vacío no da este error: de eso se encarga `notBlank`, para mostrar un solo mensaje a la vez.
export function tenDigitPhone(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '');
    if (value.trim() === '') return null;
    return normalizePhone(value) ? null : { tenDigitPhone: true };
  };
}
