import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Piezas como texto entero mayor a 0. Vacío → `required`; decimal, cero, negativo o no numérico →
// `integer`. El tope (máximo de un integer de Postgres) lo valida el backend con 422.
export function wholeQuantity(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '').trim();
    if (value === '') return { required: true };
    return /^\d+$/.test(value) && Number(value) > 0 ? null : { integer: true };
  };
}
