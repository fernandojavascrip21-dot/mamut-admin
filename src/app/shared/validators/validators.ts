import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Texto obligatorio donde solo espacios cuenta como vacío (Validators.required los acepta).
// Lo usan el login (usuario y contraseña) y el nombre del producto.
export function notBlank(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null =>
    String(control.value ?? '').trim() ? null : { notBlank: true };
}
