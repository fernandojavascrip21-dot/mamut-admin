import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Piezas como texto entero mayor a 0. Vacío → `required`; decimal, cero, negativo o no numérico →
// `integer`. El tope por titular («Solo tiene N») depende del producto elegido, así que lo revisa el
// formulario, no este validador.
export function wholeQuantity(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '').trim();
    if (value === '') return { required: true };
    return /^\d+$/.test(value) && Number(value) > 0 ? null : { integer: true };
  };
}
